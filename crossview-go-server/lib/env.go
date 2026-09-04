package lib

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/viper"
)

type Env struct {
	AdminUserName     string `mapstructure:"ADMIN_USERNAME"`
	AdminPassword     string `mapstructure:"ADMIN_PASSWORD"`
	ServerPort        string `mapstructure:"SERVER_PORT"`
	Environment       string `mapstructure:"ENV"`
	LogOutput         string `mapstructure:"LOG_OUTPUT"`
	LogLevel          string `mapstructure:"LOG_LEVEL"`
	SessionSecret     string `mapstructure:"SESSION_SECRET"`
	CORSOrigin        string `mapstructure:"CORS_ORIGIN"`
	AuthMode          string `mapstructure:"AUTH_MODE"`
	AuthTrustedHeader string `mapstructure:"AUTH_TRUSTED_HEADER"`
	AuthCreateUsers   bool   `mapstructure:"AUTH_CREATE_USERS"`
	AuthDefaultRole   string `mapstructure:"AUTH_DEFAULT_ROLE"`

	DBUsername    string `mapstructure:"DB_USER"`
	DBPassword    string `mapstructure:"DB_PASS"`
	DBHost        string `mapstructure:"DB_HOST"`
	DBPort        string `mapstructure:"DB_PORT"`
	DBName        string `mapstructure:"DB_NAME"`
	DBSSLMode     string `mapstructure:"DB_SSL_MODE"`
	DBSSLRootCert string `mapstructure:"DB_SSL_ROOT_CERT"`
	DBSSLCert     string `mapstructure:"DB_SSL_CERT"`
	DBSSLKey      string `mapstructure:"DB_SSL_KEY"`
	DBEnabled     bool   `mapstructure:"DB_ENABLED"`

	OIDCEnabled bool `mapstructure:"OIDC_ENABLED"`
	SAMLEnabled bool `mapstructure:"SAML_ENABLED"`

	ContextAliases string `mapstructure:"CONTEXT_ALIASES"`
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
	env.DBSSLMode = firstNonEmpty(
		os.Getenv("DB_SSL_MODE"),
		os.Getenv("DB_SSLMODE"),
		getConfigValue("database.ssl.mode", viper.GetString("DB_SSL_MODE"), "disable"),
	)

	env.DBSSLRootCert = firstNonEmpty(
		os.Getenv("DB_SSL_ROOT_CERT"),
		os.Getenv("DB_SSLROOTCERT"),
		getConfigValue("database.ssl.rootCert", viper.GetString("DB_SSL_ROOT_CERT"), ""),
	)

	env.DBSSLCert = firstNonEmpty(
		os.Getenv("DB_SSL_CERT"),
		os.Getenv("DB_SSLCERT"),
		getConfigValue("database.ssl.cert", viper.GetString("DB_SSL_CERT"), ""),
	)

	env.DBSSLKey = firstNonEmpty(
		os.Getenv("DB_SSL_KEY"),
		os.Getenv("DB_SSLKEY"),
		getConfigValue("database.ssl.key", viper.GetString("DB_SSL_KEY"), ""),
	)

	env.SessionSecret = getEnvOrDefault("SESSION_SECRET",
		getConfigValue("server.session.secret", viper.GetString("SESSION_SECRET"),
			"crossview-secret-key-change-in-production"))

	env.CORSOrigin = getEnvOrDefault("CORS_ORIGIN",
		getConfigValue("server.cors.origin", viper.GetString("CORS_ORIGIN"),
			"http://localhost:5173"))
	env.AuthMode = getEnvOrDefault("AUTH_MODE", getEnvOrDefault("AUTH_MODE",
		getConfigValue("server.auth.mode", viper.GetString("AUTH_MODE"), "session")))

	env.AdminUserName = getEnvOrDefault("ADMIN_USERNAME", getEnvOrDefault("ADMIN_USERNAME",
		getConfigValue("server.admin.username", viper.GetString("ADMIN_USERNAME"), "admin")))

	env.AdminPassword = getEnvOrDefault("ADMIN_PASSWORD", getEnvOrDefault("ADMIN_PASSWORD",
		getConfigValue("server.admin.password", viper.GetString("ADMIN_PASSWORD"), "password")))

	env.AuthTrustedHeader = getEnvOrDefault("AUTH_TRUSTED_HEADER", getEnvOrDefault("AUTH_TRUSTED_HEADER",
		getConfigValue("server.auth.header.trustedHeader", viper.GetString("AUTH_TRUSTED_HEADER"), "X-Auth-User")))
	env.AuthDefaultRole = getEnvOrDefault("AUTH_DEFAULT_ROLE",
		getConfigValue("server.auth.header.defaultRole", viper.GetString("AUTH_DEFAULT_ROLE"), "viewer"))

	env.OIDCEnabled = firstNonEmpty(
		os.Getenv("OIDC_ENABLED"),
		viper.GetString("sso.oidc.enabled"),
	) == "true"

	env.SAMLEnabled = firstNonEmpty(
		os.Getenv("SAML_ENABLED"),
		viper.GetString("sso.saml.enabled"),
	) == "true"

	env.DBEnabled = firstNonEmpty(
		os.Getenv("DB_ENABLED"),
		viper.GetString("database.enabled"),
	) == "true"

	env.AuthCreateUsers = firstNonEmpty(
		os.Getenv("AUTH_CREATE_USERS"),
		viper.GetString("server.auth.header.createUsers"),
		"true",
	) == "true"

	env.ContextAliases = loadContextAliasesFromEnvOrConfig()

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

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func loadContextAliasesFromEnvOrConfig() string {
	if raw := strings.TrimSpace(os.Getenv("CONTEXT_ALIASES")); raw != "" {
		return raw
	}
	if raw := strings.TrimSpace(os.Getenv("CROSSVIEW_CONTEXT_ALIASES")); raw != "" {
		return raw
	}

	candidates := []string{"server.contextAliases", "crossview-context-aliases"}
	for _, key := range candidates {
		if !viper.IsSet(key) {
			continue
		}
		if aliases := normalizeContextAliases(viper.Get(key)); len(aliases) > 0 {
			b, err := json.Marshal(aliases)
			if err != nil {
				return ""
			}
			return string(b)
		}
	}

	return ""
}

func normalizeContextAliases(raw interface{}) map[string]string {
	result := map[string]string{}

	switch v := raw.(type) {
	case map[string]string:
		for k, val := range v {
			if strings.TrimSpace(k) == "" || strings.TrimSpace(val) == "" {
				continue
			}
			result[k] = val
		}
	case map[string]interface{}:
		for k, val := range v {
			vs, ok := val.(string)
			if !ok || strings.TrimSpace(k) == "" || strings.TrimSpace(vs) == "" {
				continue
			}
			result[k] = vs
		}
	case map[interface{}]interface{}:
		for k, val := range v {
			ks, ok := k.(string)
			if !ok || strings.TrimSpace(ks) == "" {
				continue
			}
			vs, ok := val.(string)
			if !ok || strings.TrimSpace(vs) == "" {
				continue
			}
			result[ks] = vs
		}
	case []interface{}:
		for _, item := range v {
			aliases := normalizeContextAliases(item)
			for k, val := range aliases {
				result[k] = val
			}
		}
	case string:
		parsed := map[string]string{}
		if err := json.Unmarshal([]byte(v), &parsed); err == nil {
			for k, val := range parsed {
				if strings.TrimSpace(k) == "" || strings.TrimSpace(val) == "" {
					continue
				}
				result[k] = val
			}
		}
	}

	return result
}
