package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func (db *DB) GetReservations() ([]Reservation, error) {
	var reservations []Reservation
	
	// Get all reservations ordered by start time
	query := `
		SELECT id, dj_name, start_time, end_time, passcode, created_at
		FROM reservations
		ORDER BY start_time
	`
	
	err := db.Select(&reservations, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get reservations: %w", err)
	}

	return reservations, nil
}

func (db *DB) CreateReservation(djName string, startTime, endTime time.Time, passcode string) (*Reservation, error) {
	reservation := Reservation{
		ID:        uuid.New(),
		DJName:    djName,
		StartTime: startTime,
		EndTime:   endTime,
		Passcode:  passcode,
		CreatedAt: time.Now(),
	}

	query := `
		INSERT INTO reservations (id, dj_name, start_time, end_time, passcode, created_at)
		VALUES (:id, :dj_name, :start_time, :end_time, :passcode, :created_at)
	`

	_, err := db.NamedExec(query, reservation)
	if err != nil {
		return nil, fmt.Errorf("failed to create reservation: %w", err)
	}

	return &reservation, nil
}

func (db *DB) DeleteReservation(id uuid.UUID, passcode string) error {
	var storedPasscode string
	err := db.Get(&storedPasscode, "SELECT passcode FROM reservations WHERE id = $1", id)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("reservation not found")
		}
		return fmt.Errorf("failed to get reservation: %w", err)
	}

	if storedPasscode != passcode {
		return fmt.Errorf("invalid passcode")
	}

	result, err := db.Exec("DELETE FROM reservations WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete reservation: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("reservation not found")
	}

	return nil
}

func (db *DB) GetCurrentNextDJ() (*CurrentNextDJ, error) {
	var dj CurrentNextDJ
	query := `SELECT * FROM current_next_dj`

	err := db.Get(&dj, query)
	if err != nil {
		return nil, fmt.Errorf("failed to get current/next DJ: %w", err)
	}

	return &dj, nil
}

func (db *DB) GetAvailableSlots(date time.Time) ([]TimeSlot, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	reservations, err := db.GetReservations()
	if err != nil {
		return nil, err
	}

	slots := []TimeSlot{}
	currentTime := startOfDay

	for currentTime.Before(endOfDay) {
		slotEnd := currentTime.Add(15 * time.Minute)

		if slotEnd.After(time.Now()) {
			available := true

			for _, reservation := range reservations {
				if currentTime.Before(reservation.EndTime) && slotEnd.After(reservation.StartTime) {
					available = false
					break
				}
			}

			slots = append(slots, TimeSlot{
				StartTime: currentTime,
				EndTime:   slotEnd,
				Available: available,
			})
		}

		currentTime = slotEnd
	}

	return slots, nil
}

func (db *DB) GetAvailableSlotsInRange(startTime, endTime time.Time) ([]TimeSlot, error) {
	// Get reservations that might overlap with our time range
	reservations, err := db.GetReservationsInRange(startTime.Add(-1*time.Hour), endTime.Add(1*time.Hour))
	if err != nil {
		return nil, err
	}

	slots := []TimeSlot{}
	
	// Round startTime down to the nearest 15-minute interval
	startMinutes := startTime.Minute()
	roundedStart := startTime.Truncate(time.Hour).Add(time.Duration(startMinutes/15*15) * time.Minute)
	if roundedStart.Before(startTime) {
		roundedStart = roundedStart.Add(15 * time.Minute)
	}

	currentTime := roundedStart
	
	// Generate 15-minute slots from the rounded start time to end time
	for currentTime.Before(endTime) {
		slotEnd := currentTime.Add(15 * time.Minute)
		
		// Only include slots that start at or after the original startTime
		if currentTime.Before(startTime) {
			currentTime = slotEnd
			continue
		}

		available := true

		// Check if this slot conflicts with any existing reservations
		for _, reservation := range reservations {
			if currentTime.Before(reservation.EndTime) && slotEnd.After(reservation.StartTime) {
				available = false
				break
			}
		}

		slots = append(slots, TimeSlot{
			StartTime: currentTime,
			EndTime:   slotEnd,
			Available: available,
		})

		currentTime = slotEnd
	}

	return slots, nil
}

func (db *DB) GetReservationsInRange(startTime, endTime time.Time) ([]Reservation, error) {
	var reservations []Reservation
	
	query := `
		SELECT id, dj_name, start_time, end_time, passcode, created_at
		FROM reservations
		WHERE start_time < $2 AND end_time > $1
		ORDER BY start_time
	`
	
	err := db.Select(&reservations, query, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to get reservations in range: %w", err)
	}

	return reservations, nil
}

type TimeSlot struct {
	StartTime time.Time
	EndTime   time.Time
	Available bool
}
