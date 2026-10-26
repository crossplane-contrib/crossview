# SSO Configuration Guide

Crossview supports **any OIDC (OpenID Connect) or SAML 2.0 provider** for Single Sign-On authentication.

## Quick Start

1. **Enable SSO** in `config/config.yaml`:
   ```yaml
   sso:
     enabled: true
   ```

2. **Configure your provider** (OIDC or SAML) - see examples below

3. **Restart your server**

4. **SSO login buttons** will appear on the login page

## SSO with or without a database

Use `server.auth.mode: session` for SSO.

- With `database.enabled: false` (or `DB_ENABLED=false`), OIDC users are kept in
  the signed session cookie instead of a local user table. The login page shows
  only configured SSO providers: username, password, the password Sign In button,
  and the "Or continue with" divider are hidden. Password login and registration
  API endpoints are disabled. Database-free SSO users have the `user` role, not
  automatic administrator access.
- With `database.enabled: true`, SSO users are persisted and sessions resolve the
  current database user. Existing local users can also sign in with username and
  password; both login methods appear when an SSO provider is configured.

Keep the session secret private and stable across replicas and restarts. The
session cookie must reach the same application host after the provider redirects
back. Sessions created before database-free SSO support require signing in again.
The `/api/auth/check` response includes `databaseEnabled` for the login UI.

The SAML callback still requires a SAML implementation; session support does not
implement or enable SAML assertion validation.

## Required: Set `server.cors.origin` for Production

> **This is a mandatory step for any non-local deployment.** After a successful SSO login, Crossview redirects the user back to the frontend using the `server.cors.origin` value (env var: `CORS_ORIGIN`). It defaults to `http://localhost:5173`. If you do not override it with your public URL, the post-login redirect will send the user to `localhost` instead of your actual host.

**Config file:**
```yaml
server:
  cors:
    origin: https://crossview.example.com
```

**Environment variable:**
```bash
CORS_ORIGIN=https://crossview.example.com
```

**Helm values:**
```yaml
config:
  server:
    cors:
      origin: "https://crossview.example.com"
```

Set this to the root URL of your Crossview instance (no trailing slash).

## OIDC Configuration

Works with any OpenID Connect provider (Auth0, Okta, Azure AD, Google, Keycloak, etc.)

```yaml
sso:
  enabled: true
  oidc:
    enabled: true
    issuer: https://your-provider.com/realms/your-realm  # OIDC discovery endpoint
    clientId: your-client-id
    clientSecret: your-client-secret
    # Must be the full callback path on your public host:
    callbackURL: https://crossview.example.com/api/auth/oidc/callback
    scope: openid profile email
    providerName: "Company SSO" # Optional login-button label
    providerIcon: "https://example.com/sso-icon.svg" # Optional icon URL
    
    # Optional: Custom attribute mappings
    usernameAttribute: preferred_username
    emailAttribute: email
    firstNameAttribute: given_name
    lastNameAttribute: family_name
```

### Login button branding

`sso.oidc.providerName` controls the "Sign in with ..." label and
`sso.oidc.providerIcon` sets the icon URL. Environment variables
`OIDC_PROVIDER_NAME` and `OIDC_PROVIDER_ICON` override these file settings.
In Helm, use `config.sso.oidc.providerName` and
`config.sso.oidc.providerIcon`.

When the name is empty, the UI infers a provider name from the issuer and
falls back to "SSO". When the icon is empty, it uses the issuer origin's
`/favicon.ico`, if an issuer is configured. Explicit branding is useful for
split-horizon configurations without an issuer. Icon URLs must be reachable
by the user's browser; prefer HTTPS or a same-origin asset path. These values
are public UI metadata, not secrets.

### OIDC Provider Setup

1. **Create an OIDC client** in your provider
2. **Set the redirect URI** to: `https://crossview.example.com/api/auth/oidc/callback`
3. **Copy the client ID and secret** to your config
4. **Use the issuer URL** (usually ends with `/realms/...` or `/oauth2/...`)

The implementation supports **OIDC Discovery** - if you provide the `issuer` URL, it will automatically discover the authorization, token, and userinfo endpoints. The discovered endpoints take precedence over any explicit `authorizationURL`/`tokenURL`/`userInfoURL` you set.

### Split-horizon endpoints (public authorize + in-cluster token)

Leave `issuer` empty to **skip discovery** and use the explicit `authorizationURL`, `tokenURL`, and `userInfoURL` exactly as written. This is required when the identity provider is reachable at different URLs from the browser and from inside the cluster — a public `authorizationURL` for the user's browser redirect, plus in-cluster `tokenURL`/`userInfoURL` for the server-side code→token exchange and userinfo lookup:

```yaml
sso:
  enabled: true
  oidc:
    enabled: true
    issuer: ""                                                   # empty -> discovery skipped
    authorizationURL: https://idp.example.com/authorize          # browser-reachable
    tokenURL: http://idp.idp.svc.cluster.local:5556/token        # in-cluster
    userInfoURL: http://idp.idp.svc.cluster.local:5556/userinfo  # in-cluster
    clientId: your-client-id
    clientSecret: your-client-secret
    callbackURL: https://crossview.example.com/api/auth/oidc/callback
```

Because a non-empty `issuer` makes discovery override the explicit endpoints, split-horizon setups must leave `issuer` empty.

## SAML Configuration

Works with any SAML 2.0 provider (Okta, Azure AD, OneLogin, ADFS, etc.)

```yaml
sso:
  enabled: true
  saml:
    enabled: true
    entryPoint: https://your-provider.com/saml/sso
    issuer: your-application-issuer-name
    callbackURL: http://localhost:3001/api/auth/saml/callback
    cert: |-
      -----BEGIN CERTIFICATE-----
      Your SAML certificate here
      -----END CERTIFICATE-----
    
    # Optional: Custom attribute mappings
    usernameAttribute: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name
    emailAttribute: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress
    firstNameAttribute: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname
    lastNameAttribute: http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname
```

### SAML Provider Setup

1. **Create a SAML application** in your provider
2. **Set the ACS (Assertion Consumer Service) URL** to: `http://localhost:3001/api/auth/saml/callback`
3. **Set the Entity ID/Issuer** to match your `saml.issuer` value
4. **Download the SAML certificate** and add it to `saml.cert`
5. **Configure attribute mappings** if your provider uses different attribute names

## Provider-Specific Examples

### Auth0
```yaml
oidc:
  issuer: https://your-tenant.auth0.com/
  clientId: your-auth0-client-id
  clientSecret: your-auth0-client-secret
  callbackURL: https://crossview.example.com/api/auth/oidc/callback
```

### Okta
```yaml
oidc:
  issuer: https://your-tenant.okta.com/oauth2/default
  clientId: your-okta-client-id
  clientSecret: your-okta-client-secret
  callbackURL: https://crossview.example.com/api/auth/oidc/callback
```

### Azure AD
```yaml
oidc:
  issuer: https://login.microsoftonline.com/your-tenant-id/v2.0
  clientId: your-azure-app-id
  clientSecret: your-azure-app-secret
  callbackURL: https://crossview.example.com/api/auth/oidc/callback
```

### Google
```yaml
oidc:
  issuer: https://accounts.google.com
  clientId: your-google-client-id
  clientSecret: your-google-client-secret
  callbackURL: https://crossview.example.com/api/auth/oidc/callback
```

## Keycloak (Optional Example)

If you want to use Keycloak, see `keycloak/README.md` for Keycloak-specific setup instructions. The code itself is provider-agnostic.

## User Creation

When a user logs in via SSO for the first time:
- A user account is **automatically created** in Crossview
- The **first SSO user becomes an admin**
- Subsequent SSO users are created as regular users
- User attributes (email, name) are synced from the SSO provider

## Troubleshooting

- **Check server logs** for SSO initialization messages
- **Verify your provider's endpoints** are accessible
- **Ensure redirect URIs match** exactly (including http vs https)
- **Check client secret** is correct
- **Verify certificate format** for SAML (PEM format)
