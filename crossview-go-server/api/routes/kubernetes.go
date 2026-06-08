package routes

import (
	"crossview-go-server/api/controllers/kubernetes"
	"crossview-go-server/api/middlewares"
	"crossview-go-server/lib"
)

type KubernetesRoutes struct {
	logger          lib.Logger
	handler         lib.RequestHandler
	controller      kubernetes.KubernetesController
	watchController *kubernetes.WatchController
	authMiddleware  middlewares.AuthMiddleware
}

func NewKubernetesRoutes(
	logger lib.Logger,
	handler lib.RequestHandler,
	controller kubernetes.KubernetesController,
	watchController *kubernetes.WatchController,
	authMiddleware middlewares.AuthMiddleware,
) KubernetesRoutes {
	return KubernetesRoutes{
		logger:          logger,
		handler:         handler,
		controller:      controller,
		watchController: watchController,
		authMiddleware:  authMiddleware,
	}
}

func (r KubernetesRoutes) Setup() {
	r.logger.Info("Setting up Kubernetes routes")
	api := r.handler.Gin.Group("/api")
	{
		api.GET("/kubernetes/status", r.controller.GetStatus)
		api.POST("/kubernetes/context", r.authMiddleware.Handler(), r.controller.SetContext)
		api.PUT("/kubernetes/context", r.authMiddleware.Handler(), r.controller.SetContext)
		api.GET("/kubernetes/context", r.authMiddleware.Handler(), r.controller.GetCurrentContext)
		api.GET("/kubernetes/contexts", r.authMiddleware.Handler(), r.controller.GetContexts)
		api.GET("/kubernetes/connection", r.authMiddleware.Handler(), r.controller.CheckConnection)
		api.POST("/kubernetes/kubeconfig", r.authMiddleware.Handler(), r.controller.AddKubeConfig)
		api.GET("/contexts", r.authMiddleware.Handler(), r.controller.GetContexts)
		api.GET("/contexts/current", r.authMiddleware.Handler(), r.controller.GetCurrentContext)
		api.POST("/contexts/current", r.authMiddleware.Handler(), r.controller.SetContext)
		api.POST("/contexts/add", r.authMiddleware.Handler(), r.controller.AddKubeConfig)
		api.DELETE("/contexts", r.authMiddleware.Handler(), r.controller.RemoveContext)
		api.GET("/resources", r.authMiddleware.Handler(), r.controller.GetResources)
		api.GET("/resource", r.authMiddleware.Handler(), r.controller.GetResource)
		api.GET("/events", r.authMiddleware.Handler(), r.controller.GetEvents)
		api.GET("/managed", r.authMiddleware.Handler(), r.controller.GetManagedResources)
		api.GET("/resource/tree", r.authMiddleware.Handler(), r.controller.GetResourceTree)
		api.GET("/resource/drift", r.authMiddleware.Handler(), r.controller.GetResourceDrift)
		api.GET("/resource/history", r.authMiddleware.Handler(), r.controller.GetResourceHistory)
		api.GET("/history/recent", r.authMiddleware.Handler(), r.controller.GetRecentHistory)
		api.GET("/metrics/summary", r.authMiddleware.Handler(), r.controller.GetMetricsSummary)
		api.GET("/metrics/health-trend", r.authMiddleware.Handler(), r.controller.GetHealthTrend)
		api.GET("/watch", r.authMiddleware.Handler(), r.watchController.WatchResources)
	}
}
