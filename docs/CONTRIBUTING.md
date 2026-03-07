# Contributing to Crossview

Thank you for your interest in contributing to Crossview. This guide will help you get started.

## How to Contribute

### Getting Started

1. Fork the repository on GitHub.
2. Clone your fork and add the upstream remote:
   ```bash
   git clone https://github.com/YOUR_USERNAME/crossview.git
   cd crossview
   git remote add upstream https://github.com/corpobit/crossview.git
   ```
3. Create a branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Make your changes, commit, and push to your fork.
5. Open a Pull Request against the `main` branch of the upstream repository.

### Development Setup

#### Option 1 — Docker (recommended)

The fastest way to get a full local environment (frontend + backend + PostgreSQL) running with hot reload is via Docker Compose. Make sure you have **Docker** and **Docker Compose** installed.

```bash
make dev        # build and start all services in detached mode
make dev-down   # stop and remove the containers
```

Services started:

| Service    | URL / Port            | Notes                                                    |
| ---------- | --------------------- | -------------------------------------------------------- |
| Frontend   | http://localhost:5173 | Vite dev server with HMR                                 |
| Backend    | http://localhost:3001 | Go + [Air](https://github.com/air-verse/air) live reload |
| PostgreSQL | localhost:5432        | DB: `crossview`, user: `postgres`                        |

The backend uses [Air](https://github.com/air-verse/air) (configured in `crossview-go-server/.air.toml`) and rebuilds automatically on every `.go` file change. The frontend uses Vite's built-in HMR. Both source trees are mounted as volumes, so no rebuild of the Docker image is needed during development.

> **Kubeconfig:** Your host `~/.kube/config` is mounted read-only into the backend container at `/root/.kube/config`. Make sure this file exists and contains a valid context before running `make dev`.
>
> **kind clusters:** The Kubernetes API server address in your kubeconfig (e.g. `https://127.0.0.1:<port>`) resolves to the container itself, not your host. Create a `.env` file at the project root (it is gitignored) with the following variables:
>
> ```dotenv
> # Replace <port> with the port shown in your kubeconfig for the kind cluster.
> # host.docker.internal resolves to the host machine on macOS and Windows.
> # On Linux, use the Docker bridge IP (172.17.0.1) or add "127.0.0.1 host.docker.internal" to /etc/hosts.
> KUBE_SERVER=https://host.docker.internal:<port>
>
> # kind uses a self-signed certificate that does not include host.docker.internal as a SAN,
> # so TLS verification must be disabled when overriding the server address.
> KUBE_INSECURE_SKIP_TLS_VERIFY=true
> ```
>
> The `.env` file is automatically picked up by `make dev` and passed to Docker Compose via `--env-file`.

#### Option 2 — Manual

- **Frontend:** Node.js 20+, `npm install`, `npm run dev`
- **Backend:** Go 1.25+, `cd crossview-go-server && go run main.go app:serve`
- **Config:** Copy `config/examples/config.yaml.example` to `config/config.yaml` and adjust as needed.

See [Getting Started](GETTING_STARTED.md) and [Configuration](CONFIGURATION.md) for full details.

### Code Style

- Follow existing patterns and structure in the codebase.
- Keep functions and components focused and maintainable.
- Run the linter before submitting: `npm run lint` (frontend), `go vet ./...` (backend).
- Ensure existing tests pass: `npm run test` (if applicable), `go test ./...` in `crossview-go-server`.

### Pull Requests

- One feature or fix per PR when possible.
- Use a clear title and description; reference any related issues.
- Update documentation if you change behavior or add options.
- Rebase on latest `main` if the branch becomes outdated.

### Reporting Issues

- Use the [GitHub issue tracker](https://github.com/corpobit/crossview/issues).
- For bugs: describe steps to reproduce, expected vs actual behavior, and environment (OS, Node/Go versions, Kubernetes version).
- For feature ideas: check existing issues first; open a Discussion or Issue to propose or discuss.

### Questions

For questions or general discussion, open a GitHub Issue or join us on [Slack](https://join.slack.com/t/crossviewtalk/shared_invite/zt-3px5umxyo-G_tgt_3Eyt84nE1c1ykNTw).
