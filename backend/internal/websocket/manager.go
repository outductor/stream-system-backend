package websocket

import (
	"strconv"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

type Client struct {
	ID         string
	Conn       *websocket.Conn
	Manager    *Manager
	Send       chan []byte
	LastPing   time.Time
}

type Manager struct {
	clients    map[string]*Client
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
	logger     *logrus.Logger
}

func NewManager(logger *logrus.Logger) *Manager {
	return &Manager{
		clients:    make(map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		logger:     logger,
	}
}

func (m *Manager) Register(client *Client) {
	m.register <- client
}

func (m *Manager) Unregister(client *Client) {
	m.unregister <- client
}

func (m *Manager) Run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case client := <-m.register:
			m.mu.Lock()
			m.clients[client.ID] = client
			count := len(m.clients)
			m.mu.Unlock()
			
			// Send current viewer count to all clients
			m.broadcastViewerCount()

		case client := <-m.unregister:
			m.mu.Lock()
			if _, ok := m.clients[client.ID]; ok {
				delete(m.clients, client.ID)
				close(client.Send)
				count := len(m.clients)
				m.mu.Unlock()
				
				// Send updated viewer count to all clients
				m.broadcastViewerCount()
			} else {
				m.mu.Unlock()
			}

		case <-ticker.C:
			// Ping all clients to keep connection alive
			m.pingClients()
		}
	}
}

func (m *Manager) GetViewerCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.clients)
}

func (m *Manager) broadcastViewerCount() {
	count := m.GetViewerCount()
	message := []byte(`{"type":"viewer_count","count":` + strconv.Itoa(count) + `}`)
	
	m.mu.RLock()
	clients := make([]*Client, 0, len(m.clients))
	for _, client := range m.clients {
		clients = append(clients, client)
	}
	m.mu.RUnlock()

	for _, client := range clients {
		select {
		case client.Send <- message:
		default:
			// Client's send channel is full, skip
		}
	}
}

func (m *Manager) pingClients() {
	m.mu.RLock()
	clients := make([]*Client, 0, len(m.clients))
	for _, client := range m.clients {
		clients = append(clients, client)
	}
	m.mu.RUnlock()

	pingMessage := []byte(`{"type":"ping"}`)
	for _, client := range clients {
		select {
		case client.Send <- pingMessage:
			client.LastPing = time.Now()
		default:
			// Client is not responsive, disconnect
			m.unregister <- client
		}
	}
}

func NewClient(conn *websocket.Conn, manager *Manager) *Client {
	return &Client{
		ID:       uuid.New().String(),
		Conn:     conn,
		Manager:  manager,
		Send:     make(chan []byte, 256),
		LastPing: time.Now(),
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.Manager.unregister <- c
		c.Conn.Close()
	}()

	if err := c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
		c.Manager.logger.Errorf("Failed to set read deadline: %v", err)
		return
	}
	c.Conn.SetPongHandler(func(string) error {
		if err := c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
			c.Manager.logger.Errorf("Failed to set read deadline: %v", err)
		}
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.Manager.logger.Errorf("WebSocket error: %v", err)
			}
			break
		}
		
		// Handle pong messages
		if string(message) == `{"type":"pong"}` {
			c.LastPing = time.Now()
		}
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			if err := c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
				c.Manager.logger.Errorf("Failed to set write deadline: %v", err)
				return
			}
			if !ok {
				if err := c.Conn.WriteMessage(websocket.CloseMessage, []byte{}); err != nil {
					c.Manager.logger.Errorf("Failed to write close message: %v", err)
				}
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			if err := c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
				c.Manager.logger.Errorf("Failed to set write deadline: %v", err)
				return
			}
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}