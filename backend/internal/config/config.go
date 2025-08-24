package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server      ServerConfig
	Database    DatabaseConfig
	LogLevel    string
	EventEndTime *time.Time
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

	// Load EVENT_END_TIME if specified
	// Support multiple formats for better usability
	if eventEndTimeStr := os.Getenv("EVENT_END_TIME"); eventEndTimeStr != "" {
		var eventEndTime time.Time
		var err error

		// Try different formats
		formats := []string{
			time.RFC3339,           // 2006-01-02T15:04:05Z07:00
			"2006-01-02T15:04:05",  // 2006-01-02T15:04:05 (assumes Asia/Tokyo)
			"2006-01-02 15:04:05",  // 2006-01-02 15:04:05 (assumes Asia/Tokyo)
			"2006-01-02",           // 2006-01-02 (end of day in specified timezone)
		}

		for _, format := range formats {
			eventEndTime, err = time.Parse(format, eventEndTimeStr)
			if err == nil {
				// If only date was provided (YYYY-MM-DD), set to end of day
				if format == "2006-01-02" {
					// Get timezone from EVENT_TIMEZONE or default to Asia/Tokyo
					tzStr := getEnv("EVENT_TIMEZONE", "Asia/Tokyo")
					loc, tzErr := time.LoadLocation(tzStr)
					if tzErr != nil {
						return nil, fmt.Errorf("invalid EVENT_TIMEZONE: %v", tzErr)
					}
					// Set to 23:59:59 in the specified timezone
					eventEndTime = time.Date(eventEndTime.Year(), eventEndTime.Month(), eventEndTime.Day(), 23, 59, 59, 0, loc)
				} else if format == "2006-01-02T15:04:05" || format == "2006-01-02 15:04:05" {
					// If no timezone info, use EVENT_TIMEZONE or Asia/Tokyo
					tzStr := getEnv("EVENT_TIMEZONE", "Asia/Tokyo")
					loc, tzErr := time.LoadLocation(tzStr)
					if tzErr != nil {
						return nil, fmt.Errorf("invalid EVENT_TIMEZONE: %v", tzErr)
					}
					eventEndTime = time.Date(eventEndTime.Year(), eventEndTime.Month(), eventEndTime.Day(), 
						eventEndTime.Hour(), eventEndTime.Minute(), eventEndTime.Second(), 0, loc)
				}
				break
			}
		}

		if err != nil {
			return nil, fmt.Errorf("invalid EVENT_END_TIME format. Use YYYY-MM-DD, YYYY-MM-DDTHH:MM:SS, or RFC3339 format")
		}

		cfg.EventEndTime = &eventEndTime
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