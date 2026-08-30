package routes

import (
	"crossview-go-server/api/controllers/config"
	"crossview-go-server/lib"
)

type ConfigRoutes struct {
	logger     lib.Logger
	handler    lib.RequestHandler
	controller config.ConfigController
}

func NewConfigRoutes(
	logger lib.Logger,
	handler lib.RequestHandler,
	controller config.ConfigController,
) ConfigRoutes {
	return ConfigRoutes{
		logger:     logger,
		handler:    handler,
		controller: controller,
	}
}

func (r ConfigRoutes) Setup() {
	r.logger.Info("Setting up config routes")
	api := r.handler.Gin.Group("/api")
	{
		api.GET("/config/database", r.controller.GetDatabaseConfig)
		api.GET("/config/context-aliases", r.controller.GetContextAliases)
	}
}
