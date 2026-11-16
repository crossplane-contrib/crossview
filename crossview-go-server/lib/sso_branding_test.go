package lib

import (
	"testing"

	"github.com/spf13/viper"
)

func TestOIDCProviderBranding(t *testing.T) {
	name, icon := viper.Get("sso.oidc.providerName"), viper.Get("sso.oidc.providerIcon")
	t.Cleanup(func() {
		viper.Set("sso.oidc.providerName", name)
		viper.Set("sso.oidc.providerIcon", icon)
	})
	t.Setenv("OIDC_PROVIDER_NAME", "")
	t.Setenv("OIDC_PROVIDER_ICON", "")
	viper.Set("sso.oidc.providerName", "")
	viper.Set("sso.oidc.providerIcon", "")
	config := getOIDCConfig("true")
	if config.ProviderName != "" || config.ProviderIcon != "" {
		t.Fatalf("branding defaults should remain empty: %+v", config)
	}

	viper.Set("sso.oidc.providerName", "Company SSO")
	viper.Set("sso.oidc.providerIcon", "/images/company.svg")
	config = getOIDCConfig("true")
	if config.ProviderName != "Company SSO" || config.ProviderIcon != "/images/company.svg" {
		t.Fatal("config file branding was not loaded")
	}

	t.Setenv("OIDC_PROVIDER_NAME", "Environment SSO")
	t.Setenv("OIDC_PROVIDER_ICON", "https://example.com/icon.svg")
	config = getOIDCConfig("true")
	if config.ProviderName != "Environment SSO" || config.ProviderIcon != "https://example.com/icon.svg" {
		t.Fatal("environment branding must override config file values")
	}
}

func TestSAMLProviderBranding(t *testing.T) {
	name, icon := viper.Get("sso.saml.providerName"), viper.Get("sso.saml.providerIcon")
	t.Cleanup(func() {
		viper.Set("sso.saml.providerName", name)
		viper.Set("sso.saml.providerIcon", icon)
	})
	t.Setenv("SAML_PROVIDER_NAME", "")
	t.Setenv("SAML_PROVIDER_ICON", "")
	viper.Set("sso.saml.providerName", "")
	viper.Set("sso.saml.providerIcon", "")
	config := getSAMLConfig("true")
	if config.ProviderName != "" || config.ProviderIcon != "" {
		t.Fatal("branding defaults should remain empty")
	}

	viper.Set("sso.saml.providerName", "Company SAML")
	viper.Set("sso.saml.providerIcon", "/images/company.svg")
	config = getSAMLConfig("true")
	if config.ProviderName != "Company SAML" || config.ProviderIcon != "/images/company.svg" {
		t.Fatal("config file branding was not loaded")
	}

	t.Setenv("SAML_PROVIDER_NAME", "Environment SAML")
	t.Setenv("SAML_PROVIDER_ICON", "https://example.com/icon.svg")
	config = getSAMLConfig("true")
	if config.ProviderName != "Environment SAML" || config.ProviderIcon != "https://example.com/icon.svg" {
		t.Fatal("environment branding must override config file values")
	}
}
