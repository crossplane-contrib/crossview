package auth

import (
	"crypto/rand"
	"net/http"

	"crossview-go-server/lib"
	"crossview-go-server/models"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

type AuthController struct {
	logger   lib.Logger
	userRepo *models.UserRepository
	env      lib.Env
}

func NewAuthController(logger lib.Logger, db lib.Database, env lib.Env) AuthController {
	userRepo := models.NewUserRepository(db.DB)
	return AuthController{
		logger:   logger,
		userRepo: userRepo,
		env:      env,
	}
}

func (c *AuthController) Check(ctx *gin.Context) {
	hasAdmin, _ := c.userRepo.HasAdmin()
	hasUsers, _ := c.userRepo.Count()
	dbEnabled := c.userRepo.DB() != nil
	unauthenticated := gin.H{
		"authenticated":   false,
		"hasAdmin":        hasAdmin,
		"hasUsers":        hasUsers > 0,
		"authMode":        c.env.AuthMode,
		"databaseEnabled": dbEnabled,
	}
	userResponse := func(user *models.User) gin.H {
		return gin.H{
			"authenticated":   true,
			"user": gin.H{
				"id":       user.ID,
				"username": user.Username,
				"email":    user.Email,
				"role":     user.Role,
			},
			"hasAdmin":        hasAdmin,
			"hasUsers":        hasUsers > 0,
			"authMode":        c.env.AuthMode,
			"databaseEnabled": dbEnabled,
		}
	}

	switch c.env.AuthMode {
	case "header":
		username := ctx.GetHeader(c.env.AuthTrustedHeader)
		if username == "" {
			ctx.JSON(http.StatusOK, unauthenticated)
			return
		}
		user, err := c.userRepo.FindByUsername(username)
		if err != nil || user == nil {
			if !c.env.AuthCreateUsers {
				ctx.JSON(http.StatusOK, unauthenticated)
				return
			}
			user = &models.User{
				Username: username,
				Email:    username + "@header.local",
				Role:     c.env.AuthDefaultRole,
			}
			if err := user.SetPassword(authRandomPassword()); err != nil {
				c.logger.Error("Check header: failed to set password: " + err.Error())
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
				return
			}
			if err := c.userRepo.Create(user); err != nil {
				c.logger.Error("Check header: failed to create user: " + err.Error())
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
				return
			}
		}
		ctx.JSON(http.StatusOK, userResponse(user))
		return
	case "none":
		user, err := c.userRepo.FindByUsername("anonymous")
		if err != nil || user == nil {
			user = &models.User{
				Username: "anonymous",
				Email:    "anonymous@local",
				Role:     "viewer",
			}
			if err := user.SetPassword(authRandomPassword()); err != nil {
				c.logger.Error("Check none: failed to set password: " + err.Error())
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
				return
			}
			if err := c.userRepo.Create(user); err != nil {
				c.logger.Error("Check none: failed to create anonymous user: " + err.Error())
				ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
				return
			}
		}
		ctx.JSON(http.StatusOK, userResponse(user))
		return
	default:
		session := sessions.Default(ctx)
		userID := session.Get("userId")
		if userID == nil {
			ctx.JSON(http.StatusOK, unauthenticated)
			return
		}
		uid, _ := userID.(uint)
		user, err := c.userRepo.FindByID(uid)
		if err != nil || user == nil {
			if c.userRepo.DB() == nil {
				user = &models.User{
					ID:       uid,
					Username: sessionString(session.Get("username")),
					Email:    sessionString(session.Get("email")),
					Role:     sessionString(session.Get("userRole")),
				}
			} else {
				ctx.JSON(http.StatusOK, unauthenticated)
				return
			}
		}
		ctx.JSON(http.StatusOK, userResponse(user))
	}
}

func sessionString(v interface{}) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

func authRandomPassword() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 32)
	rand.Read(b)
	for i := range b {
		b[i] = charset[b[i]%byte(len(charset))]
	}
	return string(b)
}

func (c *AuthController) Login(ctx *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Username and password are required"})
		return
	}

	user, err := c.userRepo.FindByUsername(req.Username)
	if err != nil || user == nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !user.VerifyPassword(req.Password) {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	session := sessions.Default(ctx)
	session.Set("userId", user.ID)
	session.Set("userRole", user.Role)
	if err := session.Save(); err != nil {
		c.logger.Error("Failed to save session: " + err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create session"})
		return
	}

	c.logger.Infof("User logged in successfully: userId=%d, username=%s, role=%s", user.ID, user.Username, user.Role)

	ctx.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}

func (c *AuthController) Logout(ctx *gin.Context) {
	session := sessions.Default(ctx)
	session.Clear()
	if err := session.Save(); err != nil {
		c.logger.Error("Failed to clear session: " + err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to logout"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"success": true})
}

func (c *AuthController) Register(ctx *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Username, email, and password are required"})
		return
	}

	hasUsers, _ := c.userRepo.Count()
	if hasUsers > 0 {
		ctx.JSON(http.StatusForbidden, gin.H{"error": "Registration is disabled. Please contact an administrator."})
		return
	}

	existingUser, _ := c.userRepo.FindByUsername(req.Username)
	if existingUser != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Username already exists"})
		return
	}

	existingEmail, _ := c.userRepo.FindByEmail(req.Email)
	if existingEmail != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Email already exists"})
		return
	}

	user := &models.User{
		Username: req.Username,
		Email:    req.Email,
		Role:     "admin",
	}

	if err := user.SetPassword(req.Password); err != nil {
		c.logger.Error("Failed to hash password: " + err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	if err := c.userRepo.Create(user); err != nil {
		c.logger.Error("Failed to create user: " + err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	session := sessions.Default(ctx)
	session.Set("userId", user.ID)
	session.Set("userRole", user.Role)
	if err := session.Save(); err != nil {
		c.logger.Error("Failed to save session: " + err.Error())
	}

	c.logger.Infof("User registered successfully: userId=%d, username=%s, email=%s, role=%s", user.ID, user.Username, user.Email, user.Role)

	ctx.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
			"email":    user.Email,
			"role":     user.Role,
		},
	})
}
