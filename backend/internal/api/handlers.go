package api

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/dj-event/stream-system/internal/config"
	"github.com/dj-event/stream-system/internal/db"
	"github.com/dj-event/stream-system/internal/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	gorillaWs "github.com/gorilla/websocket"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/sirupsen/logrus"
)

type Handler struct {
	db        *db.DB
	logger    *logrus.Logger
	config    *config.Config
	wsManager *websocket.Manager
	upgrader  gorillaWs.Upgrader
}

func NewHandler(database *db.DB, logger *logrus.Logger, cfg *config.Config) *Handler {
	wsManager := websocket.NewManager(logger)
	go wsManager.Run()

	return &Handler{
		db:        database,
		logger:    logger,
		config:    cfg,
		wsManager: wsManager,
		upgrader: gorillaWs.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// Allow all origins in development
				// In production, you should check the origin
				return true
			},
		},
	}
}

func (h *Handler) GetStreamStatus(w http.ResponseWriter, r *http.Request) {
	currentNext, err := h.db.GetCurrentNextDJ()
	if err != nil {
		h.logger.Errorf("Failed to get current/next DJ: %v", err)
		currentNext = &db.CurrentNextDJ{}
	}

	// Check if stream is live by checking HLS file exists and is recent
	isLive := h.checkStreamIsLive()

	viewerCount := h.wsManager.GetViewerCount()

	status := StreamStatus{
		IsLive:      isLive,
		ViewerCount: &viewerCount,
	}

	if currentNext.CurrentDJName != nil {
		status.CurrentDj = currentNext.CurrentDJName
		status.CurrentStartTime = currentNext.CurrentStartTime
		status.CurrentEndTime = currentNext.CurrentEndTime
	}

	if currentNext.NextDJName != nil {
		status.NextDj = currentNext.NextDJName
		status.NextStartTime = currentNext.NextStartTime
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(status)
}

func (h *Handler) GetReservations(w http.ResponseWriter, r *http.Request) {
	reservations, err := h.db.GetReservations()
	if err != nil {
		h.logger.Errorf("Failed to get reservations: %v", err)
		h.sendError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to get reservations")
		return
	}

	// Filter reservations within event period if configured
	filteredReservations := []db.Reservation{}
	for _, res := range reservations {
		// Skip reservations before event start
		if h.config.EventStartTime != nil && res.StartTime.Before(*h.config.EventStartTime) {
			continue
		}
		// Skip reservations after event end
		if h.config.EventEndTime != nil && res.EndTime.After(*h.config.EventEndTime) {
			continue
		}
		filteredReservations = append(filteredReservations, res)
	}

	apiReservations := make([]Reservation, len(filteredReservations))
	for i, res := range filteredReservations {
		apiReservations[i] = Reservation{
			Id:        openapi_types.UUID(res.ID),
			DjName:    res.DJName,
			StartTime: res.StartTime,
			EndTime:   res.EndTime,
			CreatedAt: res.CreatedAt,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(apiReservations)
}

var passcodePattern = regexp.MustCompile(`^[0-9]{4}$`)

func (h *Handler) CreateReservation(w http.ResponseWriter, r *http.Request) {
	var req CreateReservationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body")
		return
	}

	// Validate DJ name (1-100 characters, rune-based for emoji support)
	djNameLen := utf8.RuneCountInString(req.DjName)
	if djNameLen == 0 {
		h.sendError(w, http.StatusBadRequest, "INVALID_DJ_NAME", "DJ name is required")
		return
	}
	if djNameLen > 100 {
		h.sendError(w, http.StatusBadRequest, "INVALID_DJ_NAME", "DJ name must be at most 100 characters")
		return
	}

	// Validate passcode (4 digits)
	if !passcodePattern.MatchString(req.Passcode) {
		h.sendError(w, http.StatusBadRequest, "INVALID_PASSCODE", "Passcode must be exactly 4 digits")
		return
	}

	if req.StartTime.Minute()%15 != 0 || req.StartTime.Second() != 0 {
		h.sendError(w, http.StatusBadRequest, "INVALID_TIME_INTERVAL", "Start time must be on 15-minute intervals")
		return
	}

	if req.EndTime.Minute()%15 != 0 || req.EndTime.Second() != 0 {
		h.sendError(w, http.StatusBadRequest, "INVALID_TIME_INTERVAL", "End time must be on 15-minute intervals")
		return
	}

	if req.StartTime.Before(time.Now()) {
		h.sendError(w, http.StatusBadRequest, "PAST_TIME", "Cannot create reservation in the past")
		return
	}

	if !req.EndTime.After(req.StartTime) {
		h.sendError(w, http.StatusBadRequest, "INVALID_TIME_RANGE", "End time must be after start time")
		return
	}

	if req.EndTime.Sub(req.StartTime) > time.Hour {
		h.sendError(w, http.StatusBadRequest, "DURATION_TOO_LONG", "Reservation duration cannot exceed 1 hour")
		return
	}

	// Check if reservation start time is before event start time
	if h.config.EventStartTime != nil && req.StartTime.Before(*h.config.EventStartTime) {
		h.sendError(w, http.StatusBadRequest, "BEFORE_EVENT_START", "Reservation cannot start before event start time")
		return
	}

	// Check if reservation end time exceeds event end time
	if h.config.EventEndTime != nil && req.EndTime.After(*h.config.EventEndTime) {
		h.sendError(w, http.StatusBadRequest, "EXCEEDS_EVENT_END", "Reservation cannot extend beyond event end time")
		return
	}

	reservation, err := h.db.CreateReservation(req.DjName, req.StartTime, req.EndTime, req.Passcode)
	if err != nil {
		h.logger.Errorf("Failed to create reservation: %v", err)
		errStr := err.Error()
		if strings.Contains(errStr, "no_overlap") {
			h.sendError(w, http.StatusConflict, "TIME_CONFLICT", "Time slot is already reserved")
		} else if strings.Contains(errStr, "valid_time_range") {
			h.sendError(w, http.StatusBadRequest, "INVALID_TIME_RANGE", "End time must be after start time")
		} else if strings.Contains(errStr, "max_duration") {
			h.sendError(w, http.StatusBadRequest, "DURATION_TOO_LONG", "Reservation duration cannot exceed 1 hour")
		} else if strings.Contains(errStr, "time_interval") {
			h.sendError(w, http.StatusBadRequest, "INVALID_TIME_INTERVAL", "Times must be on 15-minute intervals")
		} else {
			h.sendError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to create reservation")
		}
		return
	}

	apiReservation := Reservation{
		Id:        openapi_types.UUID(reservation.ID),
		DjName:    reservation.DJName,
		StartTime: reservation.StartTime,
		EndTime:   reservation.EndTime,
		CreatedAt: reservation.CreatedAt,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(apiReservation)
}

func (h *Handler) DeleteReservation(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "reservationId")
	id, err := uuid.Parse(idStr)
	if err != nil {
		h.sendError(w, http.StatusBadRequest, "INVALID_ID", "Invalid reservation ID")
		return
	}

	var req struct {
		Passcode string `json:"passcode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body")
		return
	}

	err = h.db.DeleteReservation(id, req.Passcode)
	if err != nil {
		if err.Error() == "invalid passcode" {
			h.sendError(w, http.StatusUnauthorized, "INVALID_PASSCODE", "Invalid passcode")
			return
		}
		if err.Error() == "reservation not found" {
			h.sendError(w, http.StatusNotFound, "NOT_FOUND", "Reservation not found")
			return
		}
		h.logger.Errorf("Failed to delete reservation: %v", err)
		h.sendError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to delete reservation")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetEventConfig(w http.ResponseWriter, r *http.Request) {
	config := EventConfig{}

	if h.config.EventStartTime != nil {
		config.EventStartTime = h.config.EventStartTime
	}

	if h.config.EventEndTime != nil {
		config.EventEndTime = h.config.EventEndTime
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(config)
}

func (h *Handler) GetAvailableSlots(w http.ResponseWriter, r *http.Request) {
	startTimeStr := r.URL.Query().Get("startTime")
	if startTimeStr == "" {
		h.sendError(w, http.StatusBadRequest, "INVALID_TIME_RANGE", "startTime parameter is required")
		return
	}

	startTime, err := time.Parse(time.RFC3339, startTimeStr)
	if err != nil {
		h.sendError(w, http.StatusBadRequest, "INVALID_TIME_RANGE", "Invalid startTime format, must be ISO 8601 UTC")
		return
	}

	// Default to 72 hours if endTime is not provided
	endTime := startTime.Add(72 * time.Hour)
	endTimeStr := r.URL.Query().Get("endTime")
	if endTimeStr != "" {
		parsedEndTime, err := time.Parse(time.RFC3339, endTimeStr)
		if err != nil {
			h.sendError(w, http.StatusBadRequest, "INVALID_TIME_RANGE", "Invalid endTime format, must be ISO 8601 UTC")
			return
		}
		endTime = parsedEndTime
	}

	// Validate time range
	if endTime.Before(startTime) {
		h.sendError(w, http.StatusBadRequest, "INVALID_TIME_RANGE", "endTime must be after startTime")
		return
	}

	// Enforce 72-hour maximum range
	maxRange := 72 * time.Hour
	if endTime.Sub(startTime) > maxRange {
		h.sendError(w, http.StatusBadRequest, "RANGE_TOO_LARGE", "Query range cannot exceed 72 hours")
		return
	}

	// Apply event start time cutoff if configured
	if h.config.EventStartTime != nil && startTime.Before(*h.config.EventStartTime) {
		startTime = *h.config.EventStartTime
	}

	// Apply event end time cutoff if configured
	if h.config.EventEndTime != nil && endTime.After(*h.config.EventEndTime) {
		endTime = *h.config.EventEndTime
	}

	// Re-validate after clamping (request range entirely outside event bounds)
	if !endTime.After(startTime) {
		h.sendError(w, http.StatusBadRequest, "OUTSIDE_EVENT_BOUNDS", "Requested time range is outside the event period")
		return
	}

	slots, err := h.db.GetAvailableSlotsInRange(startTime, endTime)
	if err != nil {
		h.logger.Errorf("Failed to get available slots: %v", err)
		h.sendError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to get available slots")
		return
	}

	apiSlots := make([]TimeSlot, len(slots))
	for i, slot := range slots {
		apiSlots[i] = TimeSlot{
			StartTime: slot.StartTime,
			EndTime:   slot.EndTime,
			Available: slot.Available,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(apiSlots)
}

func (h *Handler) sendError(w http.ResponseWriter, statusCode int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(Error{
		Code:    ErrorCode(code),
		Message: message,
	})
}

func (h *Handler) checkStreamIsLive() bool {
	// Check if stream is live by requesting HLS manifest through Nginx
	client := &http.Client{
		Timeout: 1500 * time.Millisecond,
	}

	// Request through Nginx (internal Docker network)
	resp, err := client.Get("http://nginx/hls/stream-endpoint/index.m3u8")
	if err != nil {
		h.logger.Debugf("Stream check failed: %v", err)
		return false
	}
	defer resp.Body.Close()

	// If we get 200 OK, stream is live
	return resp.StatusCode == http.StatusOK
}
