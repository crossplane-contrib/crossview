# Configuration Guide

This guide explains how to configure Crossview for your environment.

## Configuration Methods

Crossview supports multiple configuration methods, in order of priority:

1. **Environment Variables** (highest priority)
2. **Config File** (`config/config.yaml`)
3. **Default Values** (fallback)

## Database Configuration

### PostgreSQL Settings

**Environment Variables:**
```bash
DB_HOST=localhost          # Database host
DB_PORT=5432               # Database port
DB_NAME=crossview          # Database name
DB_USER=postgres           # Database user
DB_PASSWORD=your-password  # Database password
```

**Config File:**
```yaml
database:
  host: localhost
  port: 5432
  name: crossview
  user: postgres
  password: your-password
```

### Database Setup

Crossview uses PostgreSQL for session storage when `server.auth.mode` is `session`. When `server.auth.mode` is `header` or `none`, the database is not used. You can:

1. **Use Included PostgreSQL** (Helm/Kubernetes)
   - Automatically deployed with the application
   - Configured via Helm values or ConfigMap

2. **Use External PostgreSQL**
   - Set `DB_HOST` to your PostgreSQL server
   - Ensure network connectivity
   - Create database: `CREATE DATABASE crossview;`

## Kubernetes Configuration

### In-Cluster Deployment

When running in Kubernetes, Crossview automatically:
- Uses service account token
- Accesses the cluster it's running in
- No kubeconfig file needed

**Required:**
- Service account with appropriate RBAC permissions
- ClusterRole with read access to resources

### Local Development

For local development:
- Set `KUBECONFIG` environment variable, or
- Place kubeconfig at `~/.kube/config`
- Ensure you have access to the cluster

## Application Settings

### Server Configuration

```bash
NODE_ENV=production        # Environment (development/production)
PORT=3001                  # Server port
SESSION_SECRET=your-secret # Session encryption key (generate with: openssl rand -base64 32)
CORS_ORIGIN=https://crossview.example.com  # Public root URL of this instance.
                           # Required when using SSO: after login the user is redirected here.
                           # Defaults to http://localhost:5173 — must be overridden in production.
CONTEXT_ALIASES='{"kind-kind":"KIND","dev-cluster":"DEV"}'
                           # Optional JSON map of kube context name -> short UI label.
```

### Context Aliases

You can define short labels for long Kubernetes context names. These labels are shown in UI badges.

Environment variable format (preferred for containers):

```bash
CONTEXT_ALIASES='{"kind-kind":"KIND","dev-cluster":"DEV"}'
```

Config file format:

```yaml
server:
  contextAliases:
    kind-kind: KIND
    dev-cluster: DEV
```

Legacy config key is also supported for backward compatibility:

```yaml
crossview-context-aliases:
  - kind-kind: KIND
```

### Authentication Modes

Crossview supports three authentication modes via `server.auth.mode` (or `AUTH_MODE`):

| Mode     | Description | Database required |
|----------|-------------|-------------------|
| `session` | Default. Username/password or SSO; identity stored in session (PostgreSQL). | Yes |
| `header`  | Trust identity from an HTTP header set by an upstream proxy (e.g. OAuth2 Proxy, Ingress auth). No login form. | No |
| `none`    | No authentication (development or trusted networks). All requests are treated as an anonymous user. | No |

For **header** mode, configure:

- `server.auth.header.trustedHeader` – Header name (default: `X-Auth-User`).
- `server.auth.header.createUsers` – If `true`, create a user record from the header value when missing (only when database is used; if no database, a synthetic user is used).
- `server.auth.header.defaultRole` – Default role for header-authenticated users (default: `viewer`).

Use header mode only when Crossview is behind a trusted proxy that sets the header. For **none** mode, use only in trusted or development environments.

When `mode` is `header` or `none`, the application does not connect to the database; you can disable the database in Helm with `database.enabled: false`.

### Session Configuration

Sessions are used only when `server.auth.mode` is `session`. Session data is stored in PostgreSQL. Configuration:

```yaml
session:
  secret: your-session-secret-key
  maxAge: 86400000  # 24 hours in milliseconds
  secure: false     # Set to true for HTTPS
  httpOnly: true
```

### Default Admin Credentials

When running in `session` auth mode with the database enabled, a default admin account is created on first start:

| Field    | Default    |
|----------|------------|
| Username | `admin`    |
| Password | `password` |

> **Change these immediately in production.** Override them via Helm values or environment variables:
>
> ```yaml
> secrets:
>   adminUsername: "your-admin-username"
>   adminPassword: "your-strong-password"
> ```
> Or via environment variables: `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## SSO Configuration

### OpenID Connect (OIDC)

Enable OIDC authentication:

```yaml
sso:
  oidc:
    enabled: true
    issuer: https://your-provider.com/realms/your-realm
    clientId: your-client-id
    clientSecret: your-client-secret
    callbackURL: http://localhost:3001/api/auth/oidc/callback
```

See [SSO Setup Guide](SSO_SETUP.md) for detailed instructions.

### SAML 2.0

Enable SAML authentication:

```yaml
sso:
  saml:
    enabled: true
    entryPoint: https://your-idp.com/sso/saml
    issuer: crossview
    cert: /path/to/certificate.pem
    callbackURL: http://localhost:3001/api/auth/saml/callback
```

## Helm Chart Configuration

When using Helm, configure via `values.yaml` or `--set`:

```bash
helm install crossview crossview/crossview \
  --set env.DB_HOST=postgres \
  --set env.DB_PORT=5432 \
  --set secrets.dbPassword=your-password \
  --set secrets.sessionSecret=$(openssl rand -base64 32) \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=crossview.example.com
```

See [Helm Chart README](../helm/crossview/README.md) for all available options.

## Kubernetes Manifest Configuration

Edit the ConfigMap and Secrets:

**ConfigMap** (`k8s/configmap.yaml`):
```yaml
data:
  NODE_ENV: "production"
  PORT: "3001"
  DB_HOST: "crossview-postgres"
  DB_PORT: "5432"
  DB_NAME: "crossview"
  DB_USER: "postgres"
```

**Secret** (`k8s/secret.yaml`):
```yaml
stringData:
  db-password: "your-database-password"
  session-secret: "your-session-secret"
```

## Environment-Specific Configuration

### Development
```bash
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
```

### Production
```bash
NODE_ENV=production
PORT=3001
DB_HOST=postgres-service
DB_PORT=5432
SESSION_SECRET=<strong-random-secret>
```

## Security Best Practices

1. **Default Admin Credentials**
   - Default username/password is `admin`/`password`
   - Change immediately on first deployment via `secrets.adminUsername` / `secrets.adminPassword` in Helm, or `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars

2. **Session Secret**
   - Generate with: `openssl rand -base64 32`
   - Never commit to version control
   - Use different secrets per environment

3. **Database Password**
   - Use strong passwords
   - Store in Kubernetes Secrets
   - Rotate regularly

4. **SSO Secrets**
   - Store client secrets securely
   - Use Kubernetes Secrets
   - Rotate according to provider policy

5. **RBAC**
   - Follow principle of least privilege
   - Use read-only access for dashboard
   - Review ClusterRole permissions

## Troubleshooting Configuration

### Check Current Configuration

View running configuration:
```bash
# In Kubernetes
kubectl get configmap crossview-config -n crossview -o yaml

# Check environment variables
kubectl exec -n crossview <pod-name> -- env | grep -E "DB_|NODE_|PORT"
```

### Common Issues

**Database Connection Failed**
- Verify DB_HOST and DB_PORT
- Check network connectivity
- Verify database exists
- Check credentials

**Kubernetes Access Denied**
- Verify service account exists
- Check ClusterRoleBinding
- Verify RBAC permissions
- Check service account token

**SSO Not Working**
- Verify callback URLs match - Ensure `CORS_ORIGIN` (or `config.server.cors.origin` / Helm `config.server.cors.origin`) is set to the public root URL of your Crossview instance. If it is left at the default (`http://localhost:5173`), the post-login redirect will send users to localhost after authentication.- Check client ID and secret
- Verify certificate (SAML)
- Check provider logs

See [Troubleshooting Guide](TROUBLESHOOTING.md) for more help.

