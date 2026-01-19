package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server         ServerConfig
	Database       DatabaseConfig
	LogLevel       string
	EventStartTime *time.Time
	EventEndTime   *time.Time
	EventTimezone  string
}

type ServerConfig struct {
	Port int
	Host string
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	DBName   string
	SSLMode  string
}

func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Port: getEnvAsInt("SERVER_PORT", 8080),
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvAsInt("DB_PORT", 5432),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			DBName:   getEnv("DB_NAME", "stream_system"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}

	// Get timezone from EVENT_TIMEZONE or default to Asia/Tokyo
	tzStr := getEnv("EVENT_TIMEZONE", "Asia/Tokyo")
	loc, tzErr := time.LoadLocation(tzStr)
	if tzErr != nil {
		return nil, fmt.Errorf("invalid EVENT_TIMEZONE: %v", tzErr)
	}
	cfg.EventTimezone = tzStr

	// Load EVENT_START_TIME if specified
	// Only supports "YYYY-MM-DD HH:MM:SS" format
	if eventStartTimeStr := os.Getenv("EVENT_START_TIME"); eventStartTimeStr != "" {
		// Parse time in "2006-01-02 15:04:05" format
		eventStartTime, err := time.ParseInLocation("2006-01-02 15:04:05", eventStartTimeStr, loc)
		if err != nil {
			// If parsing fails, try date-only format and set to start of day
			eventStartTime, err = time.ParseInLocation("2006-01-02", eventStartTimeStr, loc)
			if err != nil {
				return nil, fmt.Errorf("invalid EVENT_START_TIME format. Use YYYY-MM-DD HH:MM:SS format")
			}
			// Set to 00:00:00 for date-only input
			eventStartTime = time.Date(eventStartTime.Year(), eventStartTime.Month(), eventStartTime.Day(), 0, 0, 0, 0, loc)
		}

		cfg.EventStartTime = &eventStartTime
	}

	// Load EVENT_END_TIME if specified
	// Only supports "YYYY-MM-DD HH:MM:SS" format
	if eventEndTimeStr := os.Getenv("EVENT_END_TIME"); eventEndTimeStr != "" {
		// Parse time in "2006-01-02 15:04:05" format
		eventEndTime, err := time.ParseInLocation("2006-01-02 15:04:05", eventEndTimeStr, loc)
		if err != nil {
			// If parsing fails, try date-only format and set to end of day
			eventEndTime, err = time.ParseInLocation("2006-01-02", eventEndTimeStr, loc)
			if err != nil {
				return nil, fmt.Errorf("invalid EVENT_END_TIME format. Use YYYY-MM-DD HH:MM:SS format")
			}
			// Set to 23:59:59 for date-only input
			eventEndTime = time.Date(eventEndTime.Year(), eventEndTime.Month(), eventEndTime.Day(), 23, 59, 59, 0, loc)
		}

		cfg.EventEndTime = &eventEndTime
	}

	// Validate that start time is before end time if both are set
	if cfg.EventStartTime != nil && cfg.EventEndTime != nil {
		if cfg.EventStartTime.After(*cfg.EventEndTime) {
			return nil, fmt.Errorf("EVENT_START_TIME must be before EVENT_END_TIME")
		}
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
