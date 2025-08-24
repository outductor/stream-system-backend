package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dj-event/stream-system/internal/api"
	"github.com/dj-event/stream-system/internal/config"
	"github.com/dj-event/stream-system/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
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

	handler := api.NewHandler(database, logger, cfg)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/stream/status", handler.GetStreamStatus)
		r.Get("/reservations", handler.GetReservations)
		r.Post("/reservations", handler.CreateReservation)
		r.Delete("/reservations/{reservationId}", handler.DeleteReservation)
		r.Get("/available-slots", handler.GetAvailableSlots)
		r.Get("/event-config", handler.GetEventConfig)
		r.Get("/ws/viewer", handler.HandleWebSocket)
	})

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
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