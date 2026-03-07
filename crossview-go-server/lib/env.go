package lib

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

type Env struct {
	ServerPort                string `mapstructure:"SERVER_PORT"`
	Environment               string `mapstructure:"ENV"`
	LogOutput                 string `mapstructure:"LOG_OUTPUT"`
	LogLevel                  string `mapstructure:"LOG_LEVEL"`
	DBUsername                string `mapstructure:"DB_USER"`
	DBPassword                string `mapstructure:"DB_PASS"`
	DBHost                    string `mapstructure:"DB_HOST"`
	DBPort                    string `mapstructure:"DB_PORT"`
	DBName                    string `mapstructure:"DB_NAME"`
	SessionSecret             string `mapstructure:"SESSION_SECRET"`
	CORSOrigin                string `mapstructure:"CORS_ORIGIN"`
	AuthMode                  string `mapstructure:"AUTH_MODE"`
	AuthTrustedHeader         string `mapstructure:"AUTH_TRUSTED_HEADER"`
	AuthCreateUsers           bool   `mapstructure:"AUTH_CREATE_USERS"`
	AuthDefaultRole           string `mapstructure:"AUTH_DEFAULT_ROLE"`
	KubeServer                string `mapstructure:"KUBE_SERVER"`
	KubeInsecureSkipTLSVerify bool   `mapstructure:"KUBE_INSECURE_SKIP_TLS_VERIFY"`
}

func NewEnv() Env {
	env := Env{}

	viper.SetEnvPrefix("")
	viper.AutomaticEnv()

	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		wd, _ := os.Getwd()
		possiblePaths := []string{
			filepath.Join(wd, "config", "config.yaml"),
			filepath.Join(wd, "..", "config", "config.yaml"),
			filepath.Join(wd, "..", "..", "config", "config.yaml"),
		}
		for _, path := range possiblePaths {
			if _, err := os.Stat(path); err == nil {
				configPath = path
				break
			}
		}
	}

	if configPath != "" {
		if _, err := os.Stat(configPath); err == nil {
			viper.SetConfigType("yaml")
			viper.SetConfigFile(configPath)
			viper.ReadInConfig()
		}
	}

	env.ServerPort = getEnvOrDefault("PORT", getEnvOrDefault("SERVER_PORT",
		getConfigValue("server.port", viper.GetString("SERVER_PORT"), "3001")))

	env.Environment = getEnvOrDefault("NODE_ENV", getEnvOrDefault("ENV",
		viper.GetString("ENV")))
	env.LogOutput = getEnvOrDefault("LOG_OUTPUT", viper.GetString("LOG_OUTPUT"))
	env.LogLevel = getEnvOrDefault("LOG_LEVEL",
		getConfigValue("server.log.level", viper.GetString("LOG_LEVEL"), ""))

	env.DBUsername = getEnvOrDefault("DB_USER", getEnvOrDefault("DB_USERNAME",
		getConfigValue("database.username", viper.GetString("DB_USER"), "postgres")))
	env.DBPassword = getEnvOrDefault("DB_PASS", getEnvOrDefault("DB_PASSWORD",
		getConfigValue("database.password", viper.GetString("DB_PASS"), "postgres")))
	env.DBHost = getEnvOrDefault("DB_HOST",
		getConfigValue("database.host", viper.GetString("DB_HOST"), "localhost"))
	env.DBPort = getEnvOrDefault("DB_PORT",
		getConfigValue("database.port", viper.GetString("DB_PORT"), "5432"))
	env.DBName = getEnvOrDefault("DB_NAME", getEnvOrDefault("DB_DATABASE",
		getConfigValue("database.database", viper.GetString("DB_NAME"), "crossview")))

	env.SessionSecret = getEnvOrDefault("SESSION_SECRET",
		getConfigValue("server.session.secret", viper.GetString("SESSION_SECRET"),
			"crossview-secret-key-change-in-production"))

	env.CORSOrigin = getEnvOrDefault("CORS_ORIGIN",
		getConfigValue("server.cors.origin", viper.GetString("CORS_ORIGIN"),
			"http://localhost:5173"))
	env.AuthMode = getEnvOrDefault("AUTH_MODE", getEnvOrDefault("AUTH_MODE",
		getConfigValue("server.auth.mode", viper.GetString("AUTH_MODE"), "session")))
	env.AuthTrustedHeader = getEnvOrDefault("AUTH_TRUSTED_HEADER", getEnvOrDefault("AUTH_TRUSTED_HEADER",
		getConfigValue("server.auth.header.trustedHeader", viper.GetString("AUTH_TRUSTED_HEADER"), "X-Auth-User")))
	env.AuthDefaultRole = getEnvOrDefault("AUTH_DEFAULT_ROLE",
		getConfigValue("server.auth.header.defaultRole", viper.GetString("AUTH_DEFAULT_ROLE"), "viewer"))
	env.KubeServer = getEnvOrDefault("KUBE_SERVER",
		getConfigValue("kube.server", viper.GetString("KUBE_SERVER"), ""))
	if v := os.Getenv("KUBE_INSECURE_SKIP_TLS_VERIFY"); v != "" {
		env.KubeInsecureSkipTLSVerify = v == "true" || v == "1"
	} else if viper.IsSet("kube.insecureSkipTLSVerify") {
		env.KubeInsecureSkipTLSVerify = viper.GetBool("kube.insecureSkipTLSVerify")
	}
	if v := os.Getenv("AUTH_CREATE_USERS"); v != "" {
		env.AuthCreateUsers = v == "true" || v == "1"
	} else if viper.IsSet("server.auth.header.createUsers") {
		env.AuthCreateUsers = viper.GetBool("server.auth.header.createUsers")
	} else {
		env.AuthCreateUsers = true
	}
	return env
}

func getConfigValue(key, envValue, defaultValue string) string {
	if envValue != "" {
		return envValue
	}
	if viper.IsSet(key) {
		val := viper.Get(key)
		if val != nil {
			switch v := val.(type) {
			case string:
				return v
			case int, int32, int64:
				return fmt.Sprintf("%d", v)
			case float64:
				return fmt.Sprintf("%.0f", v)
			default:
				return viper.GetString(key)
			}
		}
	}
	return defaultValue
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	if defaultValue != "" {
		return defaultValue
	}
	return ""
}
