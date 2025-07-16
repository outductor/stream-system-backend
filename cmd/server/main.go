package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/dj-event/stream-system/internal/api"
	"github.com/dj-event/stream-system/internal/config"
	"github.com/dj-event/stream-system/internal/db"
	"github.com/dj-event/stream-system/internal/rtmp"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/sirupsen/logrus"
)

func main() {
	logger := logrus.New()
	logger.SetFormatter(&logrus.TextFormatter{
		FullTimestamp: true,
	})

	cfg, err := config.Load()
	if err != nil {
		logger.Fatalf("Failed to load config: %v", err)
	}

	level, err := logrus.ParseLevel(cfg.LogLevel)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)

	if err := os.MkdirAll(cfg.HLS.OutputDir, 0755); err != nil {
		logger.Fatalf("Failed to create output directory: %v", err)
	}

	database, err := db.New(db.Config{
		Host:     cfg.Database.Host,
		Port:     cfg.Database.Port,
		User:     cfg.Database.User,
		Password: cfg.Database.Password,
		DBName:   cfg.Database.DBName,
		SSLMode:  cfg.Database.SSLMode,
	}, logger)
	if err != nil {
		logger.Fatalf("Failed to connect to database: %v", err)
	}
	defer database.Close()

	if err := database.Migrate(); err != nil {
		logger.Fatalf("Failed to run migrations: %v", err)
	}

	rtmpAddr := fmt.Sprintf(":%d", cfg.RTMP.Port)
	rtmpServer := rtmp.NewServer(rtmpAddr, cfg.RTMP.StreamKey, cfg.HLS.OutputDir, logger)
	if err := rtmpServer.Start(); err != nil {
		logger.Fatalf("Failed to start RTMP server: %v", err)
	}

	rtmpURL := fmt.Sprintf("rtmp://localhost:%d/live/%s", cfg.RTMP.Port, cfg.RTMP.StreamKey)
	hlsURL := fmt.Sprintf("http://localhost:%d/hls/stream.m3u8", cfg.Server.Port)

	handler := api.NewHandler(database, rtmpServer, rtmpURL, hlsURL, logger)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/stream/status", handler.GetStreamStatus)
		r.Get("/reservations", handler.GetReservations)
		r.Post("/reservations", handler.CreateReservation)
		r.Delete("/reservations/{reservationId}", handler.DeleteReservation)
		r.Get("/available-slots", handler.GetAvailableSlots)
	})

	hlsDir := filepath.Join(cfg.HLS.OutputDir, "hls")
	r.Handle("/hls/*", http.StripPrefix("/hls/", http.FileServer(http.Dir(hlsDir))))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	srv := &http.Server{
		Addr:    fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		Handler: r,
	}

	go func() {
		logger.Infof("HTTP server listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("HTTP server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Errorf("Server forced to shutdown: %v", err)
	}

	logger.Info("Server exited")
}