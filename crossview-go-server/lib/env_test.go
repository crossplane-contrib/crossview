package lib

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewEnv(t *testing.T) {
	env := NewEnv()

	if env.ServerPort == "" {
		t.Error("Expected ServerPort to have a default value")
	}

	if env.DBHost == "" {
		t.Error("Expected DBHost to have a default value")
	}

	if env.DBPort == "" {
		t.Error("Expected DBPort to have a default value")
	}

	if env.DBName == "" {
		t.Error("Expected DBName to have a default value")
	}
}

func TestNewEnv_WithEnvironmentVariables(t *testing.T) {
	os.Setenv("SERVER_PORT", "8080")
	os.Setenv("DB_HOST", "test-host")
	defer func() {
		os.Unsetenv("SERVER_PORT")
		os.Unsetenv("DB_HOST")
	}()

	env := NewEnv()

	if env.ServerPort != "8080" {
		t.Errorf("Expected ServerPort to be '8080', got '%s'", env.ServerPort)
	}

	if env.DBHost != "test-host" {
		t.Errorf("Expected DBHost to be 'test-host', got '%s'", env.DBHost)
	}
}

func TestGetEnvOrDefault(t *testing.T) {
	os.Setenv("TEST_VAR", "test-value")
	defer os.Unsetenv("TEST_VAR")

	result := getEnvOrDefault("TEST_VAR", "default")
	if result != "test-value" {
		t.Errorf("Expected 'test-value', got '%s'", result)
	}

	result = getEnvOrDefault("NON_EXISTENT_VAR", "default")
	if result != "default" {
		t.Errorf("Expected 'default', got '%s'", result)
	}
}

func TestNewEnv_LoadsContextAliasesFromServerConfig(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.yaml")
	config := "server:\n  contextAliases:\n    kind-kind: my-kind\n    dev: DEV\n"
	if err := os.WriteFile(configPath, []byte(config), 0644); err != nil {
		t.Fatalf("failed to write temp config: %v", err)
	}

	os.Setenv("CONFIG_PATH", configPath)
	os.Unsetenv("CROSSVIEW_CONTEXT_ALIASES")
	defer os.Unsetenv("CONFIG_PATH")

	env := NewEnv()
	if env.ContextAliases != "{\"dev\":\"DEV\",\"kind-kind\":\"my-kind\"}" && env.ContextAliases != "{\"kind-kind\":\"my-kind\",\"dev\":\"DEV\"}" {
		t.Errorf("unexpected context aliases value: %s", env.ContextAliases)
	}
}

func TestNewEnv_LoadsContextAliasesFromLegacyConfigKey(t *testing.T) {
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.yaml")
	config := "crossview-context-aliases:\n  - kind-kind: my-kind\n"
	if err := os.WriteFile(configPath, []byte(config), 0644); err != nil {
		t.Fatalf("failed to write temp config: %v", err)
	}

	os.Setenv("CONFIG_PATH", configPath)
	os.Unsetenv("CROSSVIEW_CONTEXT_ALIASES")
	defer os.Unsetenv("CONFIG_PATH")

	env := NewEnv()
	if env.ContextAliases != "{\"kind-kind\":\"my-kind\"}" {
		t.Errorf("expected legacy key aliases to load, got: %s", env.ContextAliases)
	}
}
