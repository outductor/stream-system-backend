package api

import (
	"time"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// StreamStatus represents the current stream status
type StreamStatus struct {
	IsLive           bool                   `json:"isLive"`
	CurrentDj        *string                `json:"currentDj,omitempty"`
	NextDj           *string                `json:"nextDj,omitempty"`
	CurrentStartTime *time.Time             `json:"currentStartTime,omitempty"`
	CurrentEndTime   *time.Time             `json:"currentEndTime,omitempty"`
	NextStartTime    *time.Time             `json:"nextStartTime,omitempty"`
}

// Reservation represents a DJ time slot reservation
type Reservation struct {
	Id        openapi_types.UUID `json:"id"`
	DjName    string             `json:"djName"`
	StartTime time.Time          `json:"startTime"`
	EndTime   time.Time          `json:"endTime"`
	CreatedAt time.Time          `json:"createdAt"`
}

// CreateReservationRequest represents a request to create a new reservation
type CreateReservationRequest struct {
	DjName    string    `json:"djName"`
	StartTime time.Time `json:"startTime"`
	EndTime   time.Time `json:"endTime"`
	Passcode  string    `json:"passcode"`
}

// TimeSlot represents an available or occupied time slot
type TimeSlot struct {
	StartTime time.Time `json:"startTime"`
	EndTime   time.Time `json:"endTime"`
	Available bool      `json:"available"`
}

// ErrorCode represents possible error codes
type ErrorCode string

const (
	TimeConflict        ErrorCode = "TIME_CONFLICT"
	PastTime           ErrorCode = "PAST_TIME"
	InvalidTimeInterval ErrorCode = "INVALID_TIME_INTERVAL"
	DurationTooLong    ErrorCode = "DURATION_TOO_LONG"
	InvalidPasscode    ErrorCode = "INVALID_PASSCODE"
	InvalidTimeRange   ErrorCode = "INVALID_TIME_RANGE"
	RangeTooLarge      ErrorCode = "RANGE_TOO_LARGE"
)

// Error represents an API error response
type Error struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}