<div align="center">
  <img src="public/images/readme-logo.png" alt="Crossview Logo" width="200"/>
  
# Crossview - Crossplane Dashboard
  
  A modern React-based dashboard for managing and monitoring Crossplane resources in Kubernetes. Visualize, search, and manage your infrastructure-as-code with ease.
<br><br>

  <a href="https://join.slack.com/t/crossviewtalk/shared_invite/zt-3px5umxyo-G_tgt_3Eyt84nE1c1ykNTw">
    <img src="https://img.shields.io/badge/Join%20Crossview%20on%20Slack-4A154B?style=for-the-badge&logo=slack&logoColor=white" alt="Join on Slack"/>
  </a>
  
[![GitHub stars](https://img.shields.io/github/stars/crossplane-contrib/crossview?style=social)](https://github.com/crossplane-contrib/crossview)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
  [![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/crossview)](https://artifacthub.io/packages/search?repo=crossview)
  [![View on KikPlate](https://img.shields.io/static/v1?label=KikPlate&message=fullstack-composed-template&color=0366d6&style=flat-square)](https://kikplate.dev/plates/fullstack-composed-template)

  Bootstrapped with the KikPlate fullstack composed template.

  Support this project: [Buy Me a Coffee](https://buymeacoffee.com/moeidheidari)
</div>

![Crossview Dashboard](public/images/new-screeenshot.png)

### Demo Video

📹 [Watch Demo Video](https://github.com/crossplane-contrib/crossview/raw/main/public/images/demo-video.mov)

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Install Dependencies](#install-dependencies)
  - [Configuration](#configuration)
  - [Development](#development)
  - [Build](#build)
  - [Production Mode](#production-mode)
- [Backend API](#backend-api)
- [Helm Chart](#helm-chart)
  - [Add the Helm Repository](#add-the-helm-repository)
  - [Install with Helm](#install-with-helm)
- [Docker](#docker)
  - [Build the Docker Image](#build-the-docker-image)
  - [Run with Environment Variables](#run-with-environment-variables-recommended)
  - [Run with Docker Compose](#run-with-docker-compose)
- [Documentation](#documentation)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Real-Time Resource Watching**: Monitor any Kubernetes resource in real-time with event-driven updates using Kubernetes Informers
- **Multi-Cluster Support**: Manage and switch between multiple Kubernetes contexts seamlessly
- **Resource Visualization**: Browse and visualize Crossplane resources (providers, XRDs, compositions, claims, etc.)
- **Resource Details**: View comprehensive resource information including status conditions, metadata, events, and relationships
- **Modern UI**: Built with React and Chakra UI with dark mode support
- **High Performance**: Backend built with Go and Gin framework for optimal performance
- **WebSocket Support**: Real-time updates via WebSocket connections
- **SSO Integration**: Support for OIDC and SAML authentication

## Getting Started

### Prerequisites

- Node.js 20+ (for frontend development)
- Go 1.24+ (for backend server)
- PostgreSQL database — only required when using `auth_mode: session` (the default). For local development without a database, set `auth_mode: none` in `config/config.yaml` (see `config/examples/config-none.yaml.example`).
- Kubernetes config file at `~/.kube/config` (or set `KUBECONFIG` env var)

### Install Dependencies

```bash
npm install
```

### Configuration

Copy the example config file and update with your settings:

```bash
cp config/config.yaml.example config/config.yaml
```

Edit `config/config.yaml` with your database credentials:
- Database port: `8920` (or your port)
- Database password: `password` (or your password)

Alternatively, use environment variables (they take precedence):
```bash
export DB_HOST=localhost
export DB_PORT=8920
export DB_NAME=crossview
export DB_USER=postgres
export DB_PASSWORD=password
```

### Development

**Run Frontend and Backend separately:**

Terminal 1 - Frontend:
```bash
npm install
npm run dev
```

Terminal 2 - Backend (Go server):
```bash
cd crossview-go-server
go run main.go app:serve
```

The app will be available at `http://localhost:5173` (frontend proxies `/api` requests to backend at `http://localhost:3001`)

### Build

Build for production:

```bash
npm run build
```

This creates a `dist/` folder with the compiled frontend.

### Production Mode

To run in production mode:

1. Build the frontend:
```bash
npm run build
```

2. Run the Go server (it will serve the frontend from the `dist/` folder):
```bash
cd crossview-go-server
go run main.go app:serve
```

The app will be available at `http://localhost:3001` (both frontend and API)

## Backend API

The backend API is built with Go using the Gin framework and runs on port 3001. It provides the following endpoints:

- `GET /api/health` - Health check and connection status
- `GET /api/contexts` - List available Kubernetes contexts
- `GET /api/contexts/current` - Get current Kubernetes context
- `POST /api/contexts/current` - Set Kubernetes context
- `GET /api/resources?apiVersion=&kind=&namespace=&context=` - List resources
- `GET /api/resource?apiVersion=&kind=&name=&namespace=&context=` - Get single resource
- `GET /api/events?kind=&name=&namespace=&context=` - Get resource events
- `GET /api/managed?context=` - List managed resources
- `GET /api/watch` - WebSocket endpoint for real-time resource watching
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/check` - Check authentication status

The backend uses the Go Kubernetes client with Informers for efficient, event-driven resource monitoring:

**When running in a Kubernetes pod:**
- Automatically uses service account token (no config file needed)
- Accesses the same cluster the pod is running in
- Uses `/var/run/secrets/kubernetes.io/serviceaccount/`

**When running locally:**
- `~/.kube/config` (default)
- `KUBECONFIG` environment variable

See [Kubernetes Deployment Guide](docs/KUBERNETES_DEPLOYMENT.md) for deployment examples.

## Helm Chart

Crossview can be deployed using Helm, which simplifies Kubernetes deployment and management.

### Add the Helm Repository

```bash
helm repo add crossview https://crossplane-contrib.github.io/crossview
helm repo update
```

### Install with Helm

```bash
helm install crossview crossview/crossview \
  --namespace crossview \
  --create-namespace \
  --set secrets.dbPassword=your-db-password \
  --set secrets.sessionSecret=$(openssl rand -base64 32)
```

For more details, see:
- [Helm Deployment Guide](docs/HELM_DEPLOYMENT.md) - Complete Helm deployment guide
- [Helm Chart Reference](helm/crossview/README.md) - All available chart options

## Docker

### Build the Docker Image

```bash
docker build -t ghcr.io/crossplane-contrib/crossview:latest .
```

Images are published to **GHCR** (`ghcr.io/crossplane-contrib/crossview`) on each release.

### Run with Environment Variables (Recommended)

Environment variables take precedence over config files:

```bash
docker run -p 3001:3001 \
  -e DB_HOST=host.docker.internal \
  -e DB_PORT=8920 \
  -e DB_NAME=crossview \
  -e DB_USER=postgres \
  -e DB_PASSWORD=password \
  -e KUBECONFIG=/app/.kube/config \
  -e SESSION_SECRET=your-secret-key-here \
  -v ~/.kube/config:/app/.kube/config:ro \
  ghcr.io/crossplane-contrib/crossview:latest
```

### Run with Config File

Mount your config file as a volume:

```bash
docker run -p 3001:3001 \
  -v $(pwd)/config/config.yaml:/app/config/config.yaml:ro \
  -e KUBECONFIG=/app/.kube/config \
  -v ~/.kube/config:/app/.kube/config:ro \
  ghcr.io/crossplane-contrib/crossview:latest
```

### Run with Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  crossview:
    build: .
    ports:
      - "3001:3001"
    environment:
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=crossview
      - DB_USER=postgres
      - DB_PASSWORD=password
      - KUBECONFIG=/app/.kube/config
      - SESSION_SECRET=your-secret-key-here
    volumes:
      - ./config/config.yaml:/app/config/config.yaml:ro
      - ~/.kube/config:/app/.kube/config:ro
    depends_on:
      - postgres

  postgres:
    image: postgres:latest
    environment:
      - POSTGRES_DB=crossview
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    ports:
      - "8920:5432"
    volumes:
      - postgres_data:/var/lib/postgresql

volumes:
  postgres_data:
```

Then run:
```bash
docker-compose up
```

### Configuration Priority

The application loads configuration in this order (highest to lowest priority):
1. **Environment variables** (e.g., `DB_HOST`, `DB_PORT`, `DB_PASSWORD`)
2. **Config file** (`config/config.yaml` - mounted or included in image)
3. **Default values** (fallback)

### Required Environment Variables for Docker

- `DB_HOST` - Database host (use `host.docker.internal` for local DB, or service name in Docker Compose)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `KUBECONFIG` or `KUBE_CONFIG_PATH` - Path to Kubernetes config file inside container
- `SESSION_SECRET` - Secret for session encryption (optional, has default)

## Documentation

### Getting Started
- [Getting Started Guide](docs/GETTING_STARTED.md) - Quick start and first steps
- [Features & Capabilities](docs/FEATURES.md) - What Crossview can do

### Deployment
- [Helm Deployment](docs/HELM_DEPLOYMENT.md) - Deploy using Helm (recommended)
- [Kubernetes Deployment](docs/KUBERNETES_DEPLOYMENT.md) - Deploy using Kubernetes manifests
- [Helm Chart Reference](helm/crossview/README.md) - Complete Helm chart options

### Configuration
- [Configuration Guide](docs/CONFIGURATION.md) - Configure Crossview for your environment
- [SSO Setup](docs/SSO_SETUP.md) - Configure Single Sign-On (OIDC/SAML)
- [SSO Protocols](docs/SSO_PROTOCOLS.md) - Understanding OIDC and SAML

### Support
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Kubernetes Manifests](k8s/README.md) - Reference for Kubernetes manifests
- [Keycloak Setup](keycloak/README.md) - Keycloak integration guide

### Community
- [Contributing Guide](docs/CONTRIBUTING.md) - How to contribute code, report issues, and open PRs
- [Maintainers](docs/MAINTAINERS.md) - Who maintains the project and how to reach them
- [Security Policy](.github/SECURITY.md) - How to report vulnerabilities
- [Code of Conduct](docs/CODE_OF_CONDUCT.md) - Community standards and reporting
- [Roadmap](docs/ROADMAP.md) - Planned direction and how to influence it

## Tech Stack

### Frontend
- **React** - UI library
- **Vite** - Build tool and dev server
- **Chakra UI** - Component library
- **React Router** - Routing
- **WebSocket** - Real-time updates

### Backend
- **Go** - Programming language
- **Gin** - Web framework
- **Kubernetes client-go** - Kubernetes API client
- **Kubernetes Informers** - Event-driven resource watching
- **PostgreSQL** - Database (via GORM)

## Contributing

Contributions are welcome. Please read the [Contributing Guide](docs/CONTRIBUTING.md) for development setup, PR guidelines, and how to report issues. By participating, you agree to our [Code of Conduct](docs/CODE_OF_CONDUCT.md). To see where the project is headed, check the [Roadmap](docs/ROADMAP.md).

## License

This project is open source and available under the [Apache License 2.0](LICENSE).
