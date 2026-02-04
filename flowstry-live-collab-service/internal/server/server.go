package server

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/flowstry/live-collab-service/internal/config"
	"github.com/flowstry/live-collab-service/internal/hub"
	"github.com/flowstry/live-collab-service/internal/message"
	"github.com/flowstry/live-collab-service/internal/session"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/rs/cors"
)

// Server represents the HTTP/WebSocket server
type Server struct {
	cfg            *config.Config
	router         *mux.Router
	hub            *hub.Hub
	sessionManager *session.Manager
	upgrader       websocket.Upgrader
}

// NewServer creates a new server instance
func NewServer(cfg *config.Config, sessionManager *session.Manager, h *hub.Hub) *Server {
	s := &Server{
		cfg:            cfg,
		router:         mux.NewRouter(),
		hub:            h,
		sessionManager: sessionManager,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  cfg.WebSocket.ReadBufferSize,
			WriteBufferSize: cfg.WebSocket.WriteBufferSize,
			CheckOrigin: func(r *http.Request) bool {
				// In production, validate against allowed origins
				return true
			},
		},
	}

	s.setupRoutes()
	return s
}

// setupRoutes configures all HTTP routes
func (s *Server) setupRoutes() {
	// Health check
	s.router.HandleFunc("/health", s.handleHealth).Methods("GET")

	// WebSocket endpoint
	s.router.HandleFunc("/ws", s.handleWebSocket).Methods("GET")

	// REST API routes
	api := s.router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/sessions", s.handleCreateSession).Methods("POST")
	api.HandleFunc("/sessions/{id}", s.handleGetSession).Methods("GET")
}

// Handler returns the HTTP handler with CORS middleware
func (s *Server) Handler() http.Handler {
	c := cors.New(cors.Options{
		AllowedOrigins:   s.cfg.CORS.AllowedOrigins,
		AllowedMethods:   s.cfg.CORS.AllowedMethods,
		AllowedHeaders:   s.cfg.CORS.AllowedHeaders,
		AllowCredentials: s.cfg.CORS.AllowCredentials,
	})

	return c.Handler(s.router)
}

// handleHealth returns server health status
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "healthy",
		"sessions": s.sessionManager.GetSessionCount(),
	})
}

// handleWebSocket upgrades HTTP to WebSocket and handles the connection
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	// Read the first message which should be join_session
	_, data, err := conn.ReadMessage()
	if err != nil {
		log.Printf("Error reading initial message: %v", err)
		conn.Close()
		return
	}

	msg, err := message.ParseMessage(data)
	if err != nil {
		sendWSError(conn, message.ErrCodeInvalidMessage, "Invalid message format")
		conn.Close()
		return
	}

	if msg.Type != message.MsgTypeJoinSession {
		sendWSError(conn, message.ErrCodeInvalidMessage, "First message must be join_session")
		conn.Close()
		return
	}

	// Parse join payload
	var joinPayload message.JoinSessionPayload
	if err := msg.GetPayload(&joinPayload); err != nil {
		sendWSError(conn, message.ErrCodeInvalidPayload, "Invalid join_session payload")
		conn.Close()
		return
	}

	authUserID := ""
	if s.cfg.Auth.JWTSecret == "" && joinPayload.Token != "" {
		sendWSError(conn, message.ErrCodeUnauthorized, "Token authentication is not configured")
		conn.Close()
		return
	}
	if s.cfg.Auth.JWTSecret != "" {
		if joinPayload.Token == "" {
			sendWSError(conn, message.ErrCodeUnauthorized, "Authorization token required")
			conn.Close()
			return
		}
		claims, err := s.parseJoinToken(joinPayload.Token)
		if err != nil {
			sendWSError(conn, message.ErrCodeUnauthorized, "Invalid or expired token")
			conn.Close()
			return
		}
		authUserID = claims.UserID
		joinPayload.DisplayName = claims.DisplayName
		if claims.AvatarURL != "" {
			joinPayload.AvatarURL = claims.AvatarURL
		}
		if joinPayload.DiagramID != "" && joinPayload.DiagramID != claims.DiagramID {
			sendWSError(conn, message.ErrCodeUnauthorized, "Diagram mismatch")
			conn.Close()
			return
		}
		joinPayload.DiagramID = claims.DiagramID
	}

	if joinPayload.DisplayName == "" {
		sendWSError(conn, message.ErrCodeInvalidPayload, "Display name is required")
		conn.Close()
		return
	}

	var sess *session.Session
	var user *message.UserInfo
	var existingUsers []*message.UserInfo
	var responseType string

	if joinPayload.SessionID == "" && joinPayload.DiagramID != "" {
		if existingSession, ok := s.sessionManager.FindSessionByDiagramID(joinPayload.DiagramID); ok {
			joinPayload.SessionID = existingSession.ID
		}
	}

	if joinPayload.SessionID == "" {
		// Create new session
		metadata := make(map[string]interface{})
		if joinPayload.DiagramID != "" {
			metadata["diagramId"] = joinPayload.DiagramID
		}

		var newSession *session.Session
		var newUser *message.UserInfo
		
		if authUserID != "" {
			sess, usr, e := s.sessionManager.CreateAndJoinSessionWithUser(authUserID, joinPayload.DisplayName, joinPayload.AvatarURL, metadata)
			if e != nil {
				sendWSError(conn, message.ErrCodeInternalError, "Failed to create session")
				conn.Close()
				return
			}
			newSession = sess
			newUser = &message.UserInfo{
				ID:          usr.ID,
				DisplayName: usr.DisplayName,
				Color:       usr.Color,
				IsAnonymous: usr.IsAnonymous,
				AvatarURL:   usr.AvatarURL,
			}
		} else {
			sess, usr, e := s.sessionManager.CreateAndJoinSession(joinPayload.DisplayName, joinPayload.AvatarURL, metadata)
			if e != nil {
				sendWSError(conn, message.ErrCodeInternalError, "Failed to create session")
				conn.Close()
				return
			}
			newSession = sess
			newUser = &message.UserInfo{
				ID:          usr.ID,
				DisplayName: usr.DisplayName,
				Color:       usr.Color,
				IsAnonymous: usr.IsAnonymous,
				AvatarURL:   usr.AvatarURL,
			}
		}


		sess = newSession
		user = newUser
		responseType = message.MsgTypeSessionCreated

		log.Printf("New session created: %s by %s", sess.ID, user.DisplayName)

	} else {
		// Join existing session
		if joinPayload.DiagramID != "" {
			existingSession, err := s.sessionManager.GetSession(joinPayload.SessionID)
			if err != nil {
				if err == session.ErrSessionNotFound {
					sendWSError(conn, message.ErrCodeSessionNotFound, "Session not found")
				} else {
					sendWSError(conn, message.ErrCodeInternalError, "Failed to join session")
				}
				conn.Close()
				return
			}
			if val, ok := existingSession.GetMetadata("diagramId"); ok {
				if diagramID, ok := val.(string); ok && diagramID != joinPayload.DiagramID {
					sendWSError(conn, message.ErrCodeUnauthorized, "Diagram mismatch")
					conn.Close()
					return
				}
			}
		}

		var existingSession *session.Session
		var newUserData *message.UserInfo
		var err error
		
		if authUserID != "" {
			sess, usr, e := s.sessionManager.JoinSessionWithUser(joinPayload.SessionID, authUserID, joinPayload.DisplayName, joinPayload.AvatarURL)
			if e != nil {
				err = e
			} else {
				existingSession = sess
				newUserData = &message.UserInfo{
					ID:          usr.ID,
					DisplayName: usr.DisplayName,
					Color:       usr.Color,
					IsAnonymous: usr.IsAnonymous,
					AvatarURL:   usr.AvatarURL,
				}
			}
		} else {
			sess, usr, e := s.sessionManager.JoinSession(joinPayload.SessionID, joinPayload.DisplayName, joinPayload.AvatarURL)
			if e != nil {
				err = e
			} else {
				existingSession = sess
				newUserData = &message.UserInfo{
					ID:          usr.ID,
					DisplayName: usr.DisplayName,
					Color:       usr.Color,
					IsAnonymous: usr.IsAnonymous,
					AvatarURL:   usr.AvatarURL,
				}
			}
		}
		if err != nil {
			if err == session.ErrSessionNotFound {
				sendWSError(conn, message.ErrCodeSessionNotFound, "Session not found")
			} else if err == session.ErrSessionFull {
				sendWSError(conn, message.ErrCodeSessionFull, "Session is full")
			} else if errors.Is(err, session.ErrUserAlreadyInSession) {
				sendWSError(conn, message.ErrCodeInvalidPayload, "User already in session")
			} else {
				sendWSError(conn, message.ErrCodeInternalError, "Failed to join session")
			}
			conn.Close()
			return
		}

		sess = existingSession
		user = newUserData
		responseType = message.MsgTypeSessionJoined

		// Get existing users for the response
		for _, u := range sess.GetUsers() {
			if u.ID != newUserData.ID {
				existingUsers = append(existingUsers, &message.UserInfo{
					ID:          u.ID,
					DisplayName: u.DisplayName,
					Color:       u.Color,
					IsAnonymous: u.IsAnonymous,
					AvatarURL:   u.AvatarURL,
				})
			}
		}

		log.Printf("User %s joined session %s", user.DisplayName, sess.ID)
	}

	// Create the response
	response := message.NewMessage(responseType, sess.ID, user.ID)
	sessionInfo := &message.SessionInfo{
		ID:        sess.ID,
		CreatedAt: sess.CreatedAt.UnixMilli(),
		CreatorID: sess.CreatorID,
		UserCount: sess.UserCount(),
		Metadata:  sess.Metadata,
	}

	if responseType == message.MsgTypeSessionCreated {
		response.SetPayload(&message.SessionCreatedPayload{
			SessionID: sess.ID,
			User:      user,
			Session:   sessionInfo,
		})
	} else {
		response.SetPayload(&message.SessionJoinedPayload{
			SessionID: sess.ID,
			User:      user,
			Users:     existingUsers,
			Session:   sessionInfo,
		})
	}

	responseData, _ := response.ToJSON()

	// Send response before starting pumps
	if err := conn.WriteMessage(websocket.TextMessage, responseData); err != nil {
		log.Printf("Error sending join response: %v", err)
		s.sessionManager.LeaveSession(sess.ID, user.ID)
		conn.Close()
		return
	}

	// Get the actual user object from session for the client
	actualUser, _ := sess.GetUser(user.ID)

	// Create client and start pumps
	_ = s.hub.NewClient(conn, actualUser, sess.ID)

	// Broadcast user joined to others (if joining existing session)
	if responseType == message.MsgTypeSessionJoined {
		s.hub.BroadcastUserJoinedExcept(sess.ID, user.ID, user)
	}
}

// handleCreateSession creates a new session via REST API
func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DisplayName string                 `json:"displayName"`
		DiagramID   string                 `json:"diagramId,omitempty"`
		AvatarURL   string                 `json:"avatarUrl,omitempty"`
		Metadata    map[string]interface{} `json:"metadata,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.DisplayName == "" {
		http.Error(w, "Display name is required", http.StatusBadRequest)
		return
	}

	metadata := req.Metadata
	if metadata == nil {
		metadata = make(map[string]interface{})
	}
	if req.DiagramID != "" {
		metadata["diagramId"] = req.DiagramID
	}

	sess, user, err := s.sessionManager.CreateAndJoinSession(req.DisplayName, req.AvatarURL, metadata)
	if err != nil {
		http.Error(w, "Failed to create session", http.StatusInternalServerError)
		return
	}

	// Return the session info (user can then connect via WebSocket)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sessionId": sess.ID,
		"user": map[string]interface{}{
			"id":          user.ID,
			"displayName": user.DisplayName,
			"color":       user.Color,
		},
		"session": map[string]interface{}{
			"id":        sess.ID,
			"createdAt": sess.CreatedAt.UnixMilli(),
			"creatorId": sess.CreatorID,
			"userCount": sess.UserCount(),
			"metadata":  sess.Metadata,
		},
	})
}

// handleGetSession returns session information
func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	sess, err := s.sessionManager.GetSession(sessionID)
	if err != nil {
		if err == session.ErrSessionNotFound {
			http.Error(w, "Session not found", http.StatusNotFound)
		} else {
			http.Error(w, "Failed to get session", http.StatusInternalServerError)
		}
		return
	}

	users := sess.GetUsers()
	userInfos := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		userInfos = append(userInfos, map[string]interface{}{
			"id":          u.ID,
			"displayName": u.DisplayName,
			"color":       u.Color,
			"isAnonymous": u.IsAnonymous,
			"avatarUrl":   u.AvatarURL,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":        sess.ID,
		"createdAt": sess.CreatedAt.UnixMilli(),
		"creatorId": sess.CreatorID,
		"userCount": sess.UserCount(),
		"users":     userInfos,
		"metadata":  sess.Metadata,
	})
}

// sendWSError sends an error message over WebSocket
func sendWSError(conn *websocket.Conn, code, msg string) {
	errMsg := message.NewMessage(message.MsgTypeError, "", "")
	errMsg.SetPayload(&message.ErrorPayload{
		Code:    code,
		Message: msg,
	})
	data, _ := errMsg.ToJSON()
	conn.WriteMessage(websocket.TextMessage, data)
}

type joinTokenClaims struct {
	UserID      string `json:"userId"`
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
	DiagramID   string `json:"diagramId"`
	WorkspaceID string `json:"workspaceId"`
	jwt.RegisteredClaims
}

func (s *Server) parseJoinToken(tokenString string) (*joinTokenClaims, error) {
	if s.cfg.Auth.JWTSecret == "" {
		return nil, errors.New("jwt secret not configured")
	}

	claims := &joinTokenClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.cfg.Auth.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}

	if claims.UserID == "" || claims.DisplayName == "" || claims.DiagramID == "" {
		return nil, errors.New("invalid token claims")
	}
	// Verify issuer
	if s.cfg.Auth.JWTIssuer != "" && claims.Issuer != s.cfg.Auth.JWTIssuer {
		return nil, errors.New("invalid issuer")
	}
	// Verify audience  
	if s.cfg.Auth.JWTAudience != "" {
		found := false
		for _, aud := range claims.Audience {
			if aud == s.cfg.Auth.JWTAudience {
				found = true
				break
			}
		}
		if !found {
			return nil, errors.New("invalid audience")
		}
	}

	return claims, nil
}
