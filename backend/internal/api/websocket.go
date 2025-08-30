package api

import (
	"net/http"

	"github.com/dj-event/stream-system/internal/websocket"
)

func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		h.logger.Errorf("Failed to upgrade connection: %v", err)
		return
	}

	client := websocket.NewClient(conn, h.wsManager)
	h.wsManager.Register(client)

	// Start goroutines for reading and writing
	go client.WritePump()
	go client.ReadPump()
}
