package middlewares

import (
	"net/http"

	"crossview-go-server/lib"
	"crossview-go-server/models"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type SessionAuthMiddleware struct {
	handler lib.RequestHandler
	logger  lib.Logger
	env     lib.Env
}

func NewSessionAuthMiddleware(handler lib.RequestHandler, logger lib.Logger, env lib.Env) SessionAuthMiddleware {
	return SessionAuthMiddleware{
		handler: handler,
		logger:  logger,
		env:     env,
	}
}

func (m SessionAuthMiddleware) Setup() {
	m.logger.Info("Setting up session auth middleware")
}

func (m SessionAuthMiddleware) Handler() gin.HandlerFunc {
	return func(c *gin.Context) {
		session := sessions.Default(c)
		userID := session.Get("userId")

		id, validID := userID.(uint)
		if !validID || id == 0 || (!m.env.DBEnabled && SSOIdentity(session) == nil) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		c.Set("userId", userID)
		c.Next()
	}
}

func RequireAdmin(userRepo *models.UserRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		if userRepo.DB() == nil {
			user := SSOIdentity(sessions.Default(c))
			if user == nil || user.Role != "admin" {
				c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
				c.Abort()
				return
			}
			c.Set("userId", user.ID)
			c.Next()
			return
		}
		var userID uint
		if id, exists := c.Get("userId"); exists && id != nil {
			switch v := id.(type) {
			case uint:
				userID = v
			case int:
				userID = uint(v)
			case float64:
				userID = uint(v)
			default:
				userID = 0
			}
		}
		if userID == 0 {
			session := sessions.Default(c)
			if sid := session.Get("userId"); sid != nil {
				userID = sid.(uint)
			}
		}
		if userID == 0 {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			c.Abort()
			return
		}
		user, err := userRepo.FindByID(userID)
		if err != nil || user == nil || user.Role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			c.Abort()
			return
		}
		c.Set("userId", userID)
		c.Next()
	}
}
