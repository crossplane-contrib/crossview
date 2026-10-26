package lib

import (
	"os"

	"github.com/spf13/viper"
)

type SSOConfig struct {
	Enabled bool
	OIDC    OIDCConfig
	SAML    SAMLConfig
}

type OIDCConfig struct {
	Enabled            bool
	Issuer             string
	ClientId           string
	ClientSecret       string
	AuthorizationURL   string
	TokenURL           string
	UserInfoURL        string
	CallbackURL        string
	Scope              string
	UsernameAttribute  string
	EmailAttribute     string
	FirstNameAttribute string
	LastNameAttribute  string
	ProviderName       string
	ProviderIcon       string
}

type SAMLConfig struct {
	Enabled            bool
	EntryPoint         string
	Issuer             string
	Cert               string
	CallbackURL        string
	UsernameAttribute  string
	EmailAttribute     string
	FirstNameAttribute string
	LastNameAttribute  string
}

func GetSSOConfig(env Env) SSOConfig {
	oidcEnabledStr := firstNonEmpty(
		os.Getenv("OIDC_ENABLED"),
		viper.GetString("sso.oidc.enabled"),
	)
	samlEnabledStr := firstNonEmpty(
		os.Getenv("SAML_ENABLED"),
		viper.GetString("sso.saml.enabled"),
	)

	oidcEnabled := oidcEnabledStr == "true"
	samlEnabled := samlEnabledStr == "true"

	// SSO is considered enabled if at least one provider is enabled
	enabled := oidcEnabled || samlEnabled

	return SSOConfig{
		Enabled: enabled,
		OIDC:    getOIDCConfig(oidcEnabledStr),
		SAML:    getSAMLConfig(samlEnabledStr),
	}
}

func getOIDCConfig(enabledStr string) OIDCConfig {
	return OIDCConfig{
		Enabled: enabledStr == "true",
		Issuer: firstNonEmpty(
			os.Getenv("OIDC_ISSUER"),
			viper.GetString("sso.oidc.issuer"),
			"",
		),
		ClientId: firstNonEmpty(
			os.Getenv("OIDC_CLIENT_ID"),
			viper.GetString("sso.oidc.clientId"),
			"crossview-client",
		),
		ClientSecret: firstNonEmpty(
			os.Getenv("OIDC_CLIENT_SECRET"),
			viper.GetString("sso.oidc.clientSecret"),
			"",
		),
		AuthorizationURL: firstNonEmpty(
			os.Getenv("OIDC_AUTHORIZATION_URL"),
			viper.GetString("sso.oidc.authorizationURL"),
			"",
		),
		TokenURL: firstNonEmpty(
			os.Getenv("OIDC_TOKEN_URL"),
			viper.GetString("sso.oidc.tokenURL"),
			"",
		),
		UserInfoURL: firstNonEmpty(
			os.Getenv("OIDC_USERINFO_URL"),
			viper.GetString("sso.oidc.userInfoURL"),
			"",
		),
		CallbackURL: firstNonEmpty(
			os.Getenv("OIDC_CALLBACK_URL"),
			viper.GetString("sso.oidc.callbackURL"),
			"http://localhost:3001/api/auth/oidc/callback",
		),
		Scope: firstNonEmpty(
			os.Getenv("OIDC_SCOPE"),
			viper.GetString("sso.oidc.scope"),
			"openid profile email",
		),
		UsernameAttribute: firstNonEmpty(
			os.Getenv("OIDC_USERNAME_ATTRIBUTE"),
			viper.GetString("sso.oidc.usernameAttribute"),
			"preferred_username",
		),
		EmailAttribute: firstNonEmpty(
			os.Getenv("OIDC_EMAIL_ATTRIBUTE"),
			viper.GetString("sso.oidc.emailAttribute"),
			"email",
		),
		FirstNameAttribute: firstNonEmpty(
			os.Getenv("OIDC_FIRSTNAME_ATTRIBUTE"),
			viper.GetString("sso.oidc.firstNameAttribute"),
			"given_name",
		),
		LastNameAttribute: firstNonEmpty(
			os.Getenv("OIDC_LASTNAME_ATTRIBUTE"),
			viper.GetString("sso.oidc.lastNameAttribute"),
			"family_name",
		),
		ProviderName: firstNonEmpty(
			os.Getenv("OIDC_PROVIDER_NAME"),
			viper.GetString("sso.oidc.providerName"),
			"",
		),
		ProviderIcon: firstNonEmpty(
			os.Getenv("OIDC_PROVIDER_ICON"),
			viper.GetString("sso.oidc.providerIcon"),
			"",
		),
	}
}

func getSAMLConfig(enabledStr string) SAMLConfig {
	cert := firstNonEmpty(
		os.Getenv("SAML_CERT"),
		viper.GetString("sso.saml.cert"),
		"",
	)

	if cert != "" {
		if _, err := os.Stat(cert); err == nil {
			if certBytes, err := os.ReadFile(cert); err == nil {
				cert = string(certBytes)
			}
		}
	}

	return SAMLConfig{
		Enabled: enabledStr == "true",
		EntryPoint: firstNonEmpty(
			os.Getenv("SAML_ENTRY_POINT"),
			viper.GetString("sso.saml.entryPoint"),
			"http://localhost:8080/realms/crossview/protocol/saml",
		),
		Issuer: firstNonEmpty(
			os.Getenv("SAML_ISSUER"),
			viper.GetString("sso.saml.issuer"),
			"crossview",
		),
		Cert: cert,
		CallbackURL: firstNonEmpty(
			os.Getenv("SAML_CALLBACK_URL"),
			viper.GetString("sso.saml.callbackURL"),
			"http://localhost:3001/api/auth/saml/callback",
		),
		UsernameAttribute: firstNonEmpty(
			os.Getenv("SAML_USERNAME_ATTRIBUTE"),
			viper.GetString("sso.saml.usernameAttribute"),
			"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
		),
		EmailAttribute: firstNonEmpty(
			os.Getenv("SAML_EMAIL_ATTRIBUTE"),
			viper.GetString("sso.saml.emailAttribute"),
			"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
		),
		FirstNameAttribute: firstNonEmpty(
			os.Getenv("SAML_FIRSTNAME_ATTRIBUTE"),
			viper.GetString("sso.saml.firstNameAttribute"),
			"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
		),
		LastNameAttribute: firstNonEmpty(
			os.Getenv("SAML_LASTNAME_ATTRIBUTE"),
			viper.GetString("sso.saml.lastNameAttribute"),
			"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
		),
	}
}
