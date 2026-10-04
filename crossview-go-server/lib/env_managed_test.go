package lib

import (
	"os"
	"testing"
)

func TestNewEnv_ManagedTuningDefaults(t *testing.T) {
	for _, k := range []string{"MANAGED_CACHE_TTL_SECONDS", "MANAGED_PAGE_SIZE", "MANAGED_MAX_ITEMS_PER_TYPE", "MANAGED_MAX_CONCURRENCY"} {
		os.Unsetenv(k)
	}
	os.Unsetenv("CONFIG_PATH")

	env := NewEnv()

	if env.ManagedCacheTTLSeconds != DefaultManagedCacheTTLSeconds {
		t.Errorf("expected default TTL %d, got %d", DefaultManagedCacheTTLSeconds, env.ManagedCacheTTLSeconds)
	}
	if env.ManagedPageSize != DefaultManagedPageSize {
		t.Errorf("expected default page size %d, got %d", DefaultManagedPageSize, env.ManagedPageSize)
	}
	if env.ManagedMaxItemsPerType != DefaultManagedMaxItemsPerType {
		t.Errorf("expected default max items %d, got %d", DefaultManagedMaxItemsPerType, env.ManagedMaxItemsPerType)
	}
	if env.ManagedMaxConcurrency != DefaultManagedMaxConcurrency {
		t.Errorf("expected default concurrency %d, got %d", DefaultManagedMaxConcurrency, env.ManagedMaxConcurrency)
	}
	if env.ManagedCacheTTL().Seconds() != float64(DefaultManagedCacheTTLSeconds) {
		t.Errorf("expected TTL duration %ds, got %v", DefaultManagedCacheTTLSeconds, env.ManagedCacheTTL())
	}
}

func TestNewEnv_ManagedTuningFromEnv(t *testing.T) {
	os.Setenv("MANAGED_CACHE_TTL_SECONDS", "60")
	os.Setenv("MANAGED_PAGE_SIZE", "250")
	os.Setenv("MANAGED_MAX_ITEMS_PER_TYPE", "20000")
	os.Setenv("MANAGED_MAX_CONCURRENCY", "4")
	defer func() {
		os.Unsetenv("MANAGED_CACHE_TTL_SECONDS")
		os.Unsetenv("MANAGED_PAGE_SIZE")
		os.Unsetenv("MANAGED_MAX_ITEMS_PER_TYPE")
		os.Unsetenv("MANAGED_MAX_CONCURRENCY")
	}()

	env := NewEnv()

	if env.ManagedCacheTTLSeconds != 60 {
		t.Errorf("expected TTL 60, got %d", env.ManagedCacheTTLSeconds)
	}
	if env.ManagedPageSize != 250 {
		t.Errorf("expected page size 250, got %d", env.ManagedPageSize)
	}
	if env.ManagedMaxItemsPerType != 20000 {
		t.Errorf("expected max items 20000, got %d", env.ManagedMaxItemsPerType)
	}
	if env.ManagedMaxConcurrency != 4 {
		t.Errorf("expected concurrency 4, got %d", env.ManagedMaxConcurrency)
	}
}

func TestNewEnv_ManagedTuningIgnoresInvalidValues(t *testing.T) {
	os.Setenv("MANAGED_PAGE_SIZE", "not-a-number")
	os.Setenv("MANAGED_MAX_CONCURRENCY", "-5")
	defer func() {
		os.Unsetenv("MANAGED_PAGE_SIZE")
		os.Unsetenv("MANAGED_MAX_CONCURRENCY")
	}()

	env := NewEnv()

	if env.ManagedPageSize != DefaultManagedPageSize {
		t.Errorf("expected fallback to default page size, got %d", env.ManagedPageSize)
	}
	if env.ManagedMaxConcurrency != DefaultManagedMaxConcurrency {
		t.Errorf("expected fallback to default concurrency, got %d", env.ManagedMaxConcurrency)
	}
}
