package db

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

func (db *DB) GetReservations(date *time.Time) ([]Reservation, error) {
	var reservations []Reservation
	var query string
	var args []interface{}

	if date != nil {
		startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
		endOfDay := startOfDay.Add(24 * time.Hour)
		
		query = `
			SELECT id, dj_name, start_time, end_time, passcode, created_at
			FROM reservations
			WHERE start_time >= $1 AND start_time < $2
			ORDER BY start_time
		`
		args = []interface{}{startOfDay, endOfDay}
	} else {
		today := time.Now().Truncate(24 * time.Hour)
		dayAfterTomorrow := today.Add(48 * time.Hour)
		
		query = `
			SELECT id, dj_name, start_time, end_time, passcode, created_at
			FROM reservations
			WHERE start_time >= $1 AND start_time < $2
			ORDER BY start_time
		`
		args = []interface{}{today, dayAfterTomorrow}
	}

	err := db.Select(&reservations, query, args...)
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

	reservations, err := db.GetReservations(&date)
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
				if (currentTime.Before(reservation.EndTime) && slotEnd.After(reservation.StartTime)) {
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

type TimeSlot struct {
	StartTime time.Time
	EndTime   time.Time
	Available bool
}