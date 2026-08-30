package config

import (
	"encoding/json"
	"net/http"
	"strconv"

	"crossview-go-server/lib"

	"github.com/gin-gonic/gin"
)

type ConfigController struct {
	logger lib.Logger
	env    lib.Env
}

func NewConfigController(logger lib.Logger, env lib.Env) ConfigController {
	return ConfigController{
		logger: logger,
		env:    env,
	}
}

func (c *ConfigController) GetDatabaseConfig(ctx *gin.Context) {
	port, _ := strconv.Atoi(c.env.DBPort)
	if port == 0 {
		port = 5432
	}

	ctx.JSON(http.StatusOK, gin.H{
		"host":     c.env.DBHost,
		"port":     port,
		"database": c.env.DBName,
		"username": c.env.DBUsername,
	})
}

func (c *ConfigController) GetContextAliases(ctx *gin.Context) {
	aliases := map[string]string{}
	if raw := c.env.ContextAliases; raw != "" {
		if err := json.Unmarshal([]byte(raw), &aliases); err != nil {
			c.logger.Warnf("Invalid CROSSVIEW_CONTEXT_ALIASES JSON: %v", err)
			aliases = map[string]string{}
		}
	}
	ctx.JSON(http.StatusOK, aliases)
}
