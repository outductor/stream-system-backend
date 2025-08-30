package db

import (
	"github.com/google/uuid"
	"time"
)

type Reservation struct {
	ID        uuid.UUID `db:"id"`
	DJName    string    `db:"dj_name"`
	StartTime time.Time `db:"start_time"`
	EndTime   time.Time `db:"end_time"`
	Passcode  string    `db:"passcode"`
	CreatedAt time.Time `db:"created_at"`
}

type StreamSession struct {
	ID            uuid.UUID  `db:"id"`
	ReservationID *uuid.UUID `db:"reservation_id"`
	StartedAt     time.Time  `db:"started_at"`
	EndedAt       *time.Time `db:"ended_at"`
	RTMPKey       string     `db:"rtmp_key"`
	ViewerCount   int        `db:"viewer_count"`
	PeakViewers   int        `db:"peak_viewers"`
}

type ViewerStats struct {
	ID          int       `db:"id"`
	SessionID   uuid.UUID `db:"session_id"`
	Timestamp   time.Time `db:"timestamp"`
	ViewerCount int       `db:"viewer_count"`
}

type CurrentNextDJ struct {
	CurrentDJName    *string    `db:"current_dj_name"`
	CurrentStartTime *time.Time `db:"current_start_time"`
	CurrentEndTime   *time.Time `db:"current_end_time"`
	NextDJName       *string    `db:"next_dj_name"`
	NextStartTime    *time.Time `db:"next_start_time"`
	NextEndTime      *time.Time `db:"next_end_time"`
}
