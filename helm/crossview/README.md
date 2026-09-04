# Crossview Helm Chart

This Helm chart deploys Crossview, a Crossplane resource visualization and management platform, on a Kubernetes cluster.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- A Kubernetes cluster with appropriate RBAC permissions
- (Optional) Ingress controller if you want to use Ingress

## Recent Updates

- Updated PostgreSQL image to latest version (PostgreSQL 18 compatible)
- Fixed PostgreSQL volume mount path for PostgreSQL 18 compatibility
- Improved chart version synchronization in CI/CD pipeline
- Enhanced OCI registry integration
- Modernized secret handling: plain strings = chart creates secret; secretKeyRef = references existing secret
- Removed deprecated existingSecret / existingSecretKeys fields

## Installation

### For end users: Install from OCI Registry (recommended for production)

The chart is published to GHCR on every push/tag. Install directly:

```bash
# Latest version from GHCR
helm install crossview oci://ghcr.io/crossplane-contrib/crossview-chart/crossview \
  --namespace crossview \
  --create-namespace \
  --set secrets.dbPassword=$(openssl rand -base64 16) \
  --set secrets.sessionSecret=$(openssl rand -base64 32) \
  --set secrets.OIDCClientSecret=$(openssl rand -base64 32)
```

Or specify a version:

```bash
helm install crossview oci://ghcr.io/crossplane-contrib/crossview-chart/crossview \
  --version 3.5.3 \
  --namespace crossview \
  --create-namespace \
  --set secrets.dbPassword=your-db-password \
  --set secrets.sessionSecret=your-session-secret
```

### For developers / contributors: Install from local chart

Clone the repo and install from source (useful for testing changes):

```bash
git clone https://github.com/crossplane-contrib/crossview.git
cd crossview/helm/crossview

helm install crossview . \
  -f /path/to/your-custom-values.yaml \
  --namespace crossview \
  --create-namespace
```

Upgrade after local changes:

```bash
helm upgrade crossview . \
  -f /path/to/your-custom-values.yaml \
  --namespace crossview
```

### Quick start with minimal secrets (chart creates them)

```yaml
helm install crossview ./helm/crossview \
  --namespace crossview \
  --create-namespace \
  --set secrets.adminUsername=admin \
  --set secrets.adminPassword=ChangeThisImmediately2026! \
  --set secrets.dbPassword=$(openssl rand -base64 16) \
  --set secrets.sessionSecret=$(openssl rand -base64 32) \
  --set secrets.OIDCClientSecret=$(openssl rand -base64 32)
```

## Configuration

The following table lists the configurable parameters and their default values:

| Parameter                        | Description                                                                 | Default / Example                          |
|----------------------------------|-----------------------------------------------------------------------------|--------------------------------------------|
| `image.repository`               | Docker image repository                                                     | `ghcr.io/crossplane-contrib/crossview`               |
| `image.tag`                      | Image tag (leave empty for Chart.AppVersion)                                | `""` (uses chart version)                  |
| `app.replicas`                   | Number of replicas                                                          | `1`                                        |
| `database.enabled`               | Enable bundled PostgreSQL                                                   | `true`                                     |
| `config.ref`                     | Reference existing ConfigMap (skips chart-generated config)                 | `""`                                       |
| `config.server.contextAliases`   | Map of kube context names to short UI labels                                | `{}`                                        |
| `config.server.auth.mode`        | Auth mode: `session`, `header`, or `none`                                   | `session`                                  |
| `secrets.adminUsername`          | Admin username (plain string = chart creates it in secret)                  | `"admin"`                                  |
| `secrets.adminPassword`          | Admin password (plain string = chart creates it in secret)                  | `"ChangeThisImmediately2026!"`             |
| `secrets.dbPassword`             | DB password – plain string = chart creates; object with `secretKeyRef` = use external secret | `"password"` or `{ secretKeyRef: { name: "...", key: "..." } }` |
| `secrets.sessionSecret`          | Session secret – plain string = chart creates; object with `secretKeyRef` = external | random base64 string or external ref       |
| `secrets.OIDCClientSecret`       | OIDC client secret – plain string = chart creates; object with `secretKeyRef` = external | random base64 string or external ref       |
| `secrets.SAMLCert`               | SAML certificate (optional, plain string = chart creates empty key)         | `""`                                       |
| `resources.requests.memory`      | Memory request                                                              | `256Mi`                                    |
| `resources.requests.cpu`         | CPU request                                                                 | `250m`                                     |
| `resources.limits.memory`        | Memory limit                                                                | `1Gi`                                      |
| `resources.limits.cpu`           | CPU limit                                                                   | `1000m`                                    |

## Secret handling modes

The chart supports two ways to handle secrets:

1. **Chart-created secrets (development / quick setup)**  
   Provide plain strings → the chart automatically creates one Kubernetes Secret named `<release-name>-secrets` (e.g. `crossview-secrets`):

   ```yaml
   secrets:
     adminUsername: admin
     adminPassword: super-secret
     dbPassword: db-pass-123
     sessionSecret: random-session-key
     OIDCClientSecret: oidc-secret-here
     SAMLCert: ""
   ```

2. **External secrets (production / secure)**  
   Use `secretKeyRef` → the chart does not create secrets, it only references existing ones:

   ```yaml
   secrets:
     adminUsername: admin
     adminPassword: super-secret
     dbPassword:
       secretKeyRef:
         name: prod-db-secrets
         key: password
     sessionSecret:
       secretKeyRef:
         name: session-secrets
         key: key
     OIDCClientSecret:
       secretKeyRef:
         name: oidc-credentials
         key: client-secret
   ```

## Upgrading

```bash
helm upgrade crossview ./helm/crossview \
  -f /path/to/your-values.yaml \
  --namespace crossview
```

## Uninstalling

```bash
helm uninstall crossview --namespace crossview
```

## Using External Database

If you want to use an external database instead of the included PostgreSQL:

```bash
helm install crossview ./helm/crossview \
  --namespace crossview \
  --create-namespace \
  --set database.enabled=false \
  --set config.database.host=your-external-db-host \
  --set config.database.port=5432 \
  --set secrets.dbPassword.secretKeyRef.name=prod-db-secrets \
  --set secrets.dbPassword.secretKeyRef.key=password \
  --set secrets.sessionSecret=your-session-secret
```

## Context Alias Labels

To display short labels for long context names in the UI, set `config.server.contextAliases`:

```yaml
config:
  server:
    contextAliases:
      kind-kind: KIND
      dev-cluster: DEV
```

Equivalent CLI example:

```bash
helm upgrade --install crossview ./helm/crossview \
  --set-json 'config.server.contextAliases={"kind-kind":"KIND","dev-cluster":"DEV"}'
```

## Ingress Configuration

To enable Ingress with TLS:

```bash
helm install crossview ./helm/crossview \
  --namespace crossview \
  --create-namespace \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=crossview.example.com \
  --set ingress.tls[0].secretName=crossview-tls \
  --set ingress.tls[0].hosts[0]=crossview.example.com
```

## Gateway API Configuration

As an alternative to Ingress, the chart can render an `HTTPRoute` (Gateway API)
that attaches to an existing `Gateway`. This requires the Gateway API CRDs and a
Gateway controller already installed in the cluster.

```bash
helm install crossview ./helm/crossview \
  --namespace crossview \
  --create-namespace \
  --set gatewayAPI.enabled=true \
  --set gatewayAPI.httpRoute.parentRefs[0].name=my-gateway \
  --set gatewayAPI.httpRoute.parentRefs[0].namespace=gateway-system \
  --set gatewayAPI.httpRoute.hostnames[0]=crossview.example.com
```

Key `gatewayAPI.httpRoute` values:

| Field | Description |
| --- | --- |
| `apiVersion` | HTTPRoute apiVersion (default `gateway.networking.k8s.io/v1`; set `gateway.networking.k8s.io/v1beta1` for older controllers) |
| `parentRefs` | List of Gateways to attach to. `name` is required; `namespace`, `sectionName`, `port`, `group`, `kind` are optional |
| `hostnames` | Hostnames the route matches. Omit/empty to match all hostnames on the Gateway |
| `rules` | Routing rules. Each rule may override `matches`, `filters`, `backendRefs` and `timeouts`. Default: a single `PathPrefix` `/` match routed to the crossview service |
| `annotations` / `labels` | Extra metadata on the HTTPRoute |

Enable only one of `ingress` or `gatewayAPI` at a time.

## Important Notes

- When `config.server.auth.mode` = `session` → `secrets.dbPassword` and `secrets.sessionSecret` are required
- When `config.server.auth.mode` = `header` or `none` → database can be disabled (`database.enabled: false`), no DB/session secret needed
- Secrets are injected as environment variables (`DB_PASS`, `SESSION_SECRET`, `OIDC_CLIENT_SECRET`, etc.)
- For production, prefer `secretKeyRef` to avoid storing sensitive values in Helm values
- The secret name is `<release-name>-secrets` (e.g. `crossview-secrets` when using fixed release name `crossview`)
- All secrets use lowercased keys in the secret (e.g. `dbpassword`, `admin-username`). The chart handles renaming automatically

## Support

For issues and questions, please visit: https://github.com/crossplane-contrib/crossview