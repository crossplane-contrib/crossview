# SSO Protocols Explained

## Overview

This application supports **two different SSO protocols**:

1. **OpenID Connect (OIDC)** - Modern, OAuth2-based protocol
2. **SAML 2.0** - Older, XML-based protocol

These are **separate protocols** - you can enable one or both, but they work differently.

## Protocol Comparison

### OpenID Connect (OIDC)

**What it is:**
- Built on top of **OAuth2** (uses OAuth2 for authorization)
- Adds an **identity layer** on top of OAuth2
- Modern, JSON-based protocol
- Uses REST APIs and JSON Web Tokens (JWT)

**How it works:**
1. User clicks "Sign in with OIDC"
2. Redirected to IDP (Identity Provider)
3. User authenticates with IDP
4. IDP redirects back with an authorization code
5. App exchanges code for access token
6. App uses access token to get user info
7. User is created/logged in locally

**Supported Providers:**
- ✅ Any OIDC-compliant provider
- ✅ Keycloak
- ✅ Auth0
- ✅ Okta (OIDC mode)
- ✅ Azure AD
- ✅ Google
- ✅ AWS Cognito
- ✅ Any provider that supports OIDC Discovery

**Configuration:**
```yaml
sso:
  oidc:
    enabled: true
    issuer: https://your-provider.com/realms/your-realm
    clientId: your-client-id
    clientSecret: your-client-secret
    providerName: "" # Optional; defaults to OIDC when blank
    providerIcon: "" # Optional; defaults to issuer favicon
    callbackURL: http://localhost:3001/api/auth/oidc/callback
```

### SAML 2.0

**What it is:**
- **Completely different** from OAuth2/OIDC
- XML-based protocol
- Older but widely used in enterprise
- Uses XML assertions and certificates

**How it works:**
1. User clicks "Sign in with SAML"
2. App generates a SAML authentication request (XML)
3. User is redirected to IDP with the request
4. User authenticates with IDP
5. IDP sends back a SAML response (XML) with user attributes
6. App validates the SAML response using certificate
7. User is created/logged in locally

**Supported Providers:**
- ✅ Any SAML 2.0-compliant provider
- ✅ Keycloak (SAML mode)
- ✅ Okta (SAML mode)
- ✅ Azure AD (SAML mode)
- ✅ OneLogin
- ✅ ADFS (Active Directory Federation Services)
- ✅ Shibboleth
- ✅ Any provider that supports SAML 2.0

**Configuration:**
```yaml
sso:
  saml:
    enabled: true
    entryPoint: https://your-provider.com/saml/sso
    issuer: your-application-issuer-name
    providerName: "" # Optional; defaults to SAML when blank
    providerIcon: "" # Optional; defaults to SAML icon
    callbackURL: http://localhost:3001/api/auth/saml/callback
    cert: |-
      -----BEGIN CERTIFICATE-----
      Your SAML certificate
      -----END CERTIFICATE-----
```

## Key Differences

Both protocols support optional `providerName` and `providerIcon` login-button
branding. Environment overrides are `OIDC_PROVIDER_NAME`/`OIDC_PROVIDER_ICON`
and `SAML_PROVIDER_NAME`/`SAML_PROVIDER_ICON`; Helm settings are under
`config.sso.oidc` and `config.sso.saml`. Without a name, the protocol label is
shown rather than an issuer-derived name. SAML does not infer a favicon from its
issuer. Branding does not change protocol support or assertion validation.
See [SSO setup](SSO_SETUP.md) for details.

| Feature | OIDC | SAML |
|---------|------|------|
| **Based on** | OAuth2 | XML/SOAP |
| **Format** | JSON | XML |
| **Tokens** | JWT | XML Assertions |
| **Discovery** | Yes (automatic) | No (manual config) |
| **Modern** | Yes (2014) | Older (2005) |
| **Enterprise** | Growing | Established |
| **Mobile-friendly** | Yes | Less so |

## OAuth2 vs OpenID Connect

**OAuth2** is an **authorization framework** - it's about granting access to resources:
- "Can this app access my photos?"
- "Can this app read my email?"

**OpenID Connect (OIDC)** is built on OAuth2 but adds **authentication**:
- "Who is this user?"
- "What is their email/name?"
- Uses OAuth2 flow but returns identity information

**In this codebase:**
- We use **OIDC** (not plain OAuth2)
- OIDC includes OAuth2, so it works with OAuth2 providers
- The code uses `passport-oauth2` as a fallback when OIDC discovery fails
- But the goal is OIDC, which provides user identity

## Provider Compatibility

### ✅ Works with ALL OIDC Providers

The OIDC implementation uses:
- **OIDC Discovery** - Automatically finds endpoints from issuer URL
- **Standard OIDC endpoints** - Works with any compliant provider
- **Fallback to manual config** - If discovery fails, you can specify endpoints manually

**This means it works with:**
- Any provider that implements OIDC correctly
- Providers that support OIDC Discovery (most modern ones)
- Providers that require manual endpoint configuration

### ✅ Works with ALL SAML 2.0 Providers

The SAML implementation uses:
- **Standard SAML 2.0 protocol**
- **Certificate-based validation**
- **Configurable attribute mappings**

**This means it works with:**
- Any provider that implements SAML 2.0 correctly
- Enterprise SSO providers
- Legacy systems that only support SAML

## Current Implementation Details

### OIDC Implementation

1. **Tries OIDC Discovery first** (if `issuer` is provided):
   - Automatically discovers authorization, token, and userinfo endpoints
   - Uses `openid-client` library if available

2. **Falls back to OAuth2** (if discovery fails):
   - Uses `passport-oauth2` with manual endpoint configuration
   - Fetches user info from userinfo endpoint
   - Still works with OIDC providers, just requires manual config

### SAML Implementation

1. **Uses passport-saml**:
   - Standard SAML 2.0 implementation
   - Validates SAML assertions with certificate
   - Extracts user attributes from SAML response

## Limitations

**What might NOT work:**
- Providers with non-standard OIDC implementations
- Providers that require custom OAuth2 flows (not OIDC)
- SAML 1.1 (only SAML 2.0 is supported)
- Providers with unusual certificate requirements

**But these are rare** - 99% of modern IDPs support standard OIDC or SAML 2.0.

## Summary

- **OIDC** = OAuth2 + Identity layer (modern, JSON-based)
- **SAML** = Separate protocol (older, XML-based)
- **Both are supported** in this application
- **Works with any compliant provider** - the code uses standard protocols
- **Provider-agnostic** - not tied to Keycloak or any specific provider

The implementation follows the standards, so it should work with any IDP that properly implements OIDC or SAML 2.0.
