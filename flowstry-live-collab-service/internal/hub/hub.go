package hub

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/flowstry/live-collab-service/internal/message"
	"github.com/flowstry/live-collab-service/internal/session"
	"github.com/flowstry/live-collab-service/internal/user"
	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the peer
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer
	pongWait = 60 * time.Second

	// Send pings to peer with this period (must be less than pongWait)
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer
	maxMessageSize = 512 * 1024 // 512KB
)

// Client represents a connected WebSocket client
type Client struct {
	hub       *Hub
	conn      *websocket.Conn
	send      chan []byte
	user      *user.User
	sessionID string
	
	// For presence throttling
	lastCursorBroadcast time.Time
	cursorThrottleMs    int
}

// Hub maintains the set of active clients and broadcasts messages
type Hub struct {
	// Session manager
	sessionManager *session.Manager

	// Registered clients grouped by session
	sessions   map[string]map[*Client]bool
	sessionsMu sync.RWMutex

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Inbound messages to process
	messages chan *clientMessage

	// Shutdown signal
	shutdown chan struct{}

	// Configuration
	cursorThrottleMs int
}

// clientMessage wraps a message with its sender
type clientMessage struct {
	client  *Client
	message *message.Message
	raw     []byte
}

// NewHub creates a new Hub instance
func NewHub(sessionManager *session.Manager, cursorThrottleMs int) *Hub {
	return &Hub{
		sessionManager:   sessionManager,
		sessions:         make(map[string]map[*Client]bool),
		register:         make(chan *Client),
		unregister:       make(chan *Client),
		messages:         make(chan *clientMessage, 256),
		shutdown:         make(chan struct{}),
		cursorThrottleMs: cursorThrottleMs,
	}
}

// Run starts the hub's main loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.registerClient(client)

		case client := <-h.unregister:
			h.unregisterClient(client)

		case cm := <-h.messages:
			h.handleMessage(cm)

		case <-h.shutdown:
			h.shutdownAll()
			return
		}
	}
}

// Stop signals the hub to shutdown
func (h *Hub) Stop() {
	close(h.shutdown)
}

// registerClient adds a client to its session
func (h *Hub) registerClient(client *Client) {
	h.sessionsMu.Lock()
	defer h.sessionsMu.Unlock()

	if _, ok := h.sessions[client.sessionID]; !ok {
		h.sessions[client.sessionID] = make(map[*Client]bool)
	}
	h.sessions[client.sessionID][client] = true

	log.Printf("Client registered: user=%s session=%s", client.user.ID, client.sessionID)
}

// unregisterClient removes a client and cleans up
func (h *Hub) unregisterClient(client *Client) {
	h.sessionsMu.Lock()
	if clients, ok := h.sessions[client.sessionID]; ok {
		if _, ok := clients[client]; ok {
			delete(clients, client)
			close(client.send)

			// Notify other users in the session
			h.broadcastUserLeftLocked(client)

			// Remove from session manager
			_ = h.sessionManager.LeaveSession(client.sessionID, client.user.ID)

			// Clean up empty session map entry
			if len(clients) == 0 {
				delete(h.sessions, client.sessionID)
			}
		}
	}
	h.sessionsMu.Unlock()

	log.Printf("Client unregistered: user=%s session=%s", client.user.ID, client.sessionID)
}

// broadcastUserLeftLocked broadcasts user left message (must hold sessionsMu lock)
func (h *Hub) broadcastUserLeftLocked(client *Client) {
	msg := message.NewMessage(message.MsgTypeUserLeft, client.sessionID, client.user.ID)
	payload := &message.UserLeftPayload{
		UserID:      client.user.ID,
		DisplayName: client.user.DisplayName,
	}
	if err := msg.SetPayload(payload); err != nil {
		log.Printf("Error creating user left message: %v", err)
		return
	}

	data, err := msg.ToJSON()
	if err != nil {
		log.Printf("Error serializing user left message: %v", err)
		return
	}

	if clients, ok := h.sessions[client.sessionID]; ok {
		for c := range clients {
			if c != client {
				select {
				case c.send <- data:
				default:
					// Client send buffer full, skip
				}
			}
		}
	}
}

// BroadcastUserJoinedExcept broadcasts user joined message to all clients except the new user
func (h *Hub) BroadcastUserJoinedExcept(sessionID, userID string, userInfo *message.UserInfo) {
	h.sessionsMu.RLock()
	defer h.sessionsMu.RUnlock()

	msg := message.NewMessage(message.MsgTypeUserJoined, sessionID, "")
	payload := &message.UserJoinedPayload{
		User: userInfo,
	}
	if err := msg.SetPayload(payload); err != nil {
		log.Printf("Error creating user joined message: %v", err)
		return
	}

	data, err := msg.ToJSON()
	if err != nil {
		log.Printf("Error serializing user joined message: %v", err)
		return
	}

	// Send to all clients except the new user
	if clients, ok := h.sessions[sessionID]; ok {
		for client := range clients {
			if client.user.ID != userID {
				select {
				case client.send <- data:
				default:
					// Client send buffer full, skip
				}
			}
		}
	}
}

// handleMessage routes incoming messages to appropriate handlers
func (h *Hub) handleMessage(cm *clientMessage) {
	switch cm.message.Type {
	case message.MsgTypeAction:
		h.handleAction(cm)
	case message.MsgTypeCursorMove:
		h.handleCursorMove(cm)
	case message.MsgTypeSelectionChange:
		h.handleSelectionChange(cm)
	case message.MsgTypeViewportChange:
		h.handleViewportChange(cm)
	case message.MsgTypeLaserPointer:
		h.handleLaserPointer(cm)
	case message.MsgTypePing:
		h.handlePing(cm)
	default:
		log.Printf("Unknown message type: %s", cm.message.Type)
	}
}

// handleAction broadcasts shape operations to other users in the session
func (h *Hub) handleAction(cm *clientMessage) {
	// Create broadcast message
	broadcastMsg := message.NewMessage(message.MsgTypeActionBroadcast, cm.client.sessionID, cm.client.user.ID)
	broadcastMsg.Payload = cm.message.Payload

	data, err := broadcastMsg.ToJSON()
	if err != nil {
		log.Printf("Error serializing action broadcast: %v", err)
		return
	}

	h.broadcastToSessionExcept(cm.client.sessionID, cm.client, data)
}

// handleCursorMove broadcasts cursor position with throttling
func (h *Hub) handleCursorMove(cm *clientMessage) {
	// Throttle cursor updates
	now := time.Now()
	if now.Sub(cm.client.lastCursorBroadcast) < time.Duration(cm.client.cursorThrottleMs)*time.Millisecond {
		return
	}
	cm.client.lastCursorBroadcast = now

	// Parse cursor position
	var cursorPayload message.CursorMovePayload
	if err := cm.message.GetPayload(&cursorPayload); err != nil {
		log.Printf("Error parsing cursor move payload: %v", err)
		return
	}

	// Update user's cursor position
	cm.client.user.UpdateCursor(cursorPayload.X, cursorPayload.Y)

	// Broadcast presence update
	presenceMsg := message.NewMessage(message.MsgTypePresenceUpdate, cm.client.sessionID, cm.client.user.ID)
	presencePayload := &message.PresenceUpdatePayload{
		UserID: cm.client.user.ID,
		Cursor: &cursorPayload,
	}
	if err := presenceMsg.SetPayload(presencePayload); err != nil {
		return
	}

	data, _ := presenceMsg.ToJSON()
	h.broadcastToSessionExcept(cm.client.sessionID, cm.client, data)
}

// handleSelectionChange broadcasts selection changes
func (h *Hub) handleSelectionChange(cm *clientMessage) {
	var selectionPayload message.SelectionChangePayload
	if err := cm.message.GetPayload(&selectionPayload); err != nil {
		log.Printf("Error parsing selection change payload: %v", err)
		return
	}

	// Update user's selection
	cm.client.user.UpdateSelection(selectionPayload.ShapeIDs)

	// Broadcast presence update
	presenceMsg := message.NewMessage(message.MsgTypePresenceUpdate, cm.client.sessionID, cm.client.user.ID)
	presencePayload := &message.PresenceUpdatePayload{
		UserID:    cm.client.user.ID,
		Selection: &selectionPayload,
	}
	if err := presenceMsg.SetPayload(presencePayload); err != nil {
		return
	}

	data, _ := presenceMsg.ToJSON()
	h.broadcastToSessionExcept(cm.client.sessionID, cm.client, data)
}

// handleViewportChange broadcasts viewport changes
func (h *Hub) handleViewportChange(cm *clientMessage) {
	var viewportPayload message.ViewportChangePayload
	if err := cm.message.GetPayload(&viewportPayload); err != nil {
		log.Printf("Error parsing viewport change payload: %v", err)
		return
	}

	// Update user's viewport
	cm.client.user.UpdateViewport(viewportPayload.X, viewportPayload.Y, viewportPayload.Zoom)

	// Broadcast presence update
	presenceMsg := message.NewMessage(message.MsgTypePresenceUpdate, cm.client.sessionID, cm.client.user.ID)
	presencePayload := &message.PresenceUpdatePayload{
		UserID:   cm.client.user.ID,
		Viewport: &viewportPayload,
	}
	if err := presenceMsg.SetPayload(presencePayload); err != nil {
		return
	}

	data, _ := presenceMsg.ToJSON()
	h.broadcastToSessionExcept(cm.client.sessionID, cm.client, data)
}

// handleLaserPointer broadcasts laser pointer events to other users
func (h *Hub) handleLaserPointer(cm *clientMessage) {
	var laserPayload message.LaserPointerPayload
	if err := cm.message.GetPayload(&laserPayload); err != nil {
		log.Printf("Error parsing laser pointer payload: %v", err)
		return
	}

	broadcastMsg := message.NewMessage(message.MsgTypeLaserPointer, cm.client.sessionID, cm.client.user.ID)
	if err := broadcastMsg.SetPayload(&laserPayload); err != nil {
		return
	}

	data, _ := broadcastMsg.ToJSON()
	h.broadcastToSessionExcept(cm.client.sessionID, cm.client, data)
}

// handlePing responds with pong
func (h *Hub) handlePing(cm *clientMessage) {
	pongMsg := message.NewMessage(message.MsgTypePong, cm.client.sessionID, "")
	data, _ := pongMsg.ToJSON()

	select {
	case cm.client.send <- data:
	default:
	}
}

// broadcastToSessionExcept sends a message to all clients in a session except the sender
func (h *Hub) broadcastToSessionExcept(sessionID string, except *Client, data []byte) {
	h.sessionsMu.RLock()
	defer h.sessionsMu.RUnlock()

	if clients, ok := h.sessions[sessionID]; ok {
		for client := range clients {
			if client != except {
				select {
				case client.send <- data:
				default:
					// Client buffer full, message dropped
				}
			}
		}
	}
}

// broadcastToSession sends a message to all clients in a session
func (h *Hub) broadcastToSession(sessionID string, data []byte) {
	h.sessionsMu.RLock()
	defer h.sessionsMu.RUnlock()

	if clients, ok := h.sessions[sessionID]; ok {
		for client := range clients {
			select {
			case client.send <- data:
			default:
			}
		}
	}
}

// sendToClient sends a message to a specific client
func (h *Hub) sendToClient(client *Client, data []byte) {
	select {
	case client.send <- data:
	default:
	}
}

// shutdownAll closes all client connections
func (h *Hub) shutdownAll() {
	h.sessionsMu.Lock()
	defer h.sessionsMu.Unlock()

	for _, clients := range h.sessions {
		for client := range clients {
			close(client.send)
		}
	}
	h.sessions = make(map[string]map[*Client]bool)
}

// GetSessionClientCount returns the number of connected clients in a session
func (h *Hub) GetSessionClientCount(sessionID string) int {
	h.sessionsMu.RLock()
	defer h.sessionsMu.RUnlock()

	if clients, ok := h.sessions[sessionID]; ok {
		return len(clients)
	}
	return 0
}

// NewClient creates a new client and starts its read/write pumps
func (h *Hub) NewClient(conn *websocket.Conn, u *user.User, sessionID string) *Client {
	client := &Client{
		hub:              h,
		conn:             conn,
		send:             make(chan []byte, 256),
		user:             u,
		sessionID:        sessionID,
		cursorThrottleMs: h.cursorThrottleMs,
	}

	// Register the client
	h.register <- client

	// Start pumps
	go client.writePump()
	go client.readPump()

	return client
}

// readPump reads messages from the WebSocket connection
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse the message
		msg, err := message.ParseMessage(data)
		if err != nil {
			log.Printf("Error parsing message: %v", err)
			c.sendError(message.ErrCodeInvalidMessage, "Invalid message format")
			continue
		}

		// Set session and user IDs from client context
		msg.SessionID = c.sessionID
		msg.UserID = c.user.ID

		// Send to hub for processing
		c.hub.messages <- &clientMessage{
			client:  c,
			message: msg,
			raw:     data,
		}
	}
}

// writePump writes messages to the WebSocket connection
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// sendError sends an error message to the client
func (c *Client) sendError(code, msg string) {
	errMsg := message.NewMessage(message.MsgTypeError, c.sessionID, "")
	payload := &message.ErrorPayload{
		Code:    code,
		Message: msg,
	}
	errMsg.SetPayload(payload)
	data, _ := json.Marshal(errMsg)

	select {
	case c.send <- data:
	default:
	}
}

// SendMessage sends a message directly to this client
func (c *Client) SendMessage(data []byte) {
	select {
	case c.send <- data:
	default:
	}
}
