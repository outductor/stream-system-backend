package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/dj-event/stream-system/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
	"github.com/sirupsen/logrus"
)

type Handler struct {
	db     *db.DB
	logger *logrus.Logger
}

func NewHandler(database *db.DB, logger *logrus.Logger) *Handler {
	return &Handler{
		db:     database,
		logger: logger,
	}
}

func (h *Handler) GetStreamStatus(w http.ResponseWriter, r *http.Request) {
	currentNext, err := h.db.GetCurrentNextDJ()
	if err != nil {
		h.logger.Errorf("Failed to get current/next DJ: %v", err)
		currentNext = &db.CurrentNextDJ{}
	}

	// TODO: somehow compute this state
	isLive := true

	status := StreamStatus{
		IsLive: isLive,
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
	json.NewEncoder(w).Encode(status)
}

func (h *Handler) GetReservations(w http.ResponseWriter, r *http.Request) {
	reservations, err := h.db.GetReservations()
	if err != nil {
		h.logger.Errorf("Failed to get reservations: %v", err)
		h.sendError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to get reservations")
		return
	}

	apiReservations := make([]Reservation, len(reservations))
	for i, res := range reservations {
		apiReservations[i] = Reservation{
			Id:        openapi_types.UUID(res.ID),
			DjName:    res.DJName,
			StartTime: res.StartTime,
			EndTime:   res.EndTime,
			CreatedAt: res.CreatedAt,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(apiReservations)
}

func (h *Handler) CreateReservation(w http.ResponseWriter, r *http.Request) {
	var req CreateReservationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.sendError(w, http.StatusBadRequest, "INVALID_REQUEST", "Invalid request body")
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

	if req.EndTime.Sub(req.StartTime) > time.Hour {
		h.sendError(w, http.StatusBadRequest, "DURATION_TOO_LONG", "Reservation duration cannot exceed 1 hour")
		return
	}

	reservation, err := h.db.CreateReservation(req.DjName, req.StartTime, req.EndTime, req.Passcode)
	if err != nil {
		h.logger.Errorf("Failed to create reservation: %v", err)
		h.sendError(w, http.StatusBadRequest, "TIME_CONFLICT", "Time slot is already reserved")
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
	json.NewEncoder(w).Encode(apiReservation)
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
	json.NewEncoder(w).Encode(apiSlots)
}

func (h *Handler) sendError(w http.ResponseWriter, statusCode int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(Error{
		Code:    ErrorCode(code),
		Message: message,
	})
}
