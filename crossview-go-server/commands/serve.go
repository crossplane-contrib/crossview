package commands

import (
	"crossview-go-server/api/middlewares"
	"crossview-go-server/api/routes"
	"crossview-go-server/lib"
	"crossview-go-server/models"
	"crossview-go-server/services"

	"github.com/spf13/cobra"
	"golang.org/x/crypto/bcrypt"
)

// ServeCommand test command
type ServeCommand struct{}

func (s *ServeCommand) Short() string {
	return "serve application"
}

func (s *ServeCommand) Setup(cmd *cobra.Command) {}

func (s *ServeCommand) Run() lib.CommandRunner {
	return func(
		middleware middlewares.Middlewares,
		env lib.Env,
		router lib.RequestHandler,
		route routes.Routes,
		logger lib.Logger,
		database lib.Database,
		k8sService services.KubernetesServiceInterface,
	) {
		logger.Info("Starting server initialization...")

		if database.DB != nil {
			sqlDB, err := database.DB.DB()
			if err != nil {
				logger.Errorf("Failed to get underlying SQL DB: %v", err)
				logger.Panicf("Failed to get underlying SQL DB: %v", err)
			}
			logger.Info("Pinging database...")
			if err := sqlDB.Ping(); err != nil {
				logger.Errorf("Failed to ping database: %v", err)
				logger.Panicf("Failed to ping database: %v", err)
			}
			logger.Info("Database ping successful")
			logger.Info("Running database migrations...")
			userRepo := models.NewUserRepository(database.DB)
			if err := userRepo.AutoMigrate(); err != nil {
				logger.Errorf("Migration error details: %+v", err)
				logger.Errorf("Migration error type: %T", err)
				logger.Errorf("Migration error string: %s", err.Error())
				logger.Errorf("Migration error wrapped: %#v", err)
				sqlDB, pingErr := database.DB.DB()
				if pingErr == nil {
					if pingErr := sqlDB.Ping(); pingErr != nil {
						logger.Errorf("Database connection is broken after migration error: %v", pingErr)
					} else {
						logger.Info("Database connection is still valid after migration error")
					}
				}
				logger.Panicf("Failed to run database migrations: %v", err)
			}
			logger.Info("Database migrations completed successfully")

			eventRepo := models.NewResourceEventRepository(database.DB)
			if err := eventRepo.AutoMigrate(); err != nil {
				logger.Warnf("Failed to migrate resource_events table: %v", err)
			}
			metricRepo := models.NewResourceMetricRepository(database.DB)
			if err := metricRepo.AutoMigrate(); err != nil {
				logger.Warnf("Failed to migrate resource_metrics table: %v", err)
			}
			if env.AuthMode == "session" && env.DBEnabled {
				hasAdmin, err := userRepo.HasAdmin()
				if err != nil {
					logger.Errorf("Failed to check for admin user: %v", err)
					logger.Panicf("Failed to check for admin user: %v", err)
				}
				if !hasAdmin {
					logger.Info("no admin user found. Creating admin user...")
					err = createAdmin(env, *userRepo)
					if err != nil {
						logger.Errorf("Database connection is broken after migration error: %v", err)
					}
				}
			}

		}

		if database.DB != nil {
			metricRepoForCollector := models.NewResourceMetricRepository(database.DB)
			collector := services.NewMetricsCollector(logger, k8sService, metricRepoForCollector, 300, 90)
			collector.Start()
		}

		middleware.Setup()
		route.Setup()

		logger.Info("Running server")
		if env.ServerPort == "" {
			_ = router.Gin.Run()
		} else {
			_ = router.Gin.Run(":" + env.ServerPort)
		}

	}
}

func NewServeCommand() *ServeCommand {
	return &ServeCommand{}
}

func createAdmin(env lib.Env, userRepository models.UserRepository) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(env.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	err = userRepository.Create(&models.User{
		Username:     env.AdminUserName,
		Email:        env.AdminUserName + "@" + env.AdminUserName + ".com",
		PasswordHash: string(hash),
		Role:         "admin",
	})
	if err != nil {
		return err
	}
	return nil
}
