package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	RTMP     RTMPConfig
	HLS      HLSConfig
	LogLevel string
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

type RTMPConfig struct {
	Port      int
	StreamKey string
}

type HLSConfig struct {
	OutputDir string
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
		RTMP: RTMPConfig{
			Port:      getEnvAsInt("RTMP_PORT", 1935),
			StreamKey: getEnv("RTMP_STREAM_KEY", "djevent2024"),
		},
		HLS: HLSConfig{
			OutputDir: getEnv("HLS_OUTPUT_DIR", "./media"),
		},
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}

	if cfg.RTMP.StreamKey == "" {
		return nil, fmt.Errorf("RTMP_STREAM_KEY is required")
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