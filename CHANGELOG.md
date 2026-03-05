# Changelog

All notable changes to this project will be documented in this file.

# v3.6.0 (March 2026)

This release brings authentication flexibility, UI enhancements, important bug fixes for resource visibility and events, Helm chart improvements, organization migration to `crossplane-contrib`, and better governance/documentation. The database is now optional in certain auth modes for lighter deployments.

**Pre-release testing summary:** Iterated through 7 release candidates (rc.1 → rc.7) with fixes applied rapidly between March 1–5, 2026.

## Features & Enhancements

- **Flexible authentication modes**  
  Added support for `header` (trust an HTTP header for user identity) and `none` (disable auth entirely) modes, in addition to existing methods.  
  Configurable via Helm values: `server.auth.mode`, `trustedHeader`, `createUsers`, `defaultRole`.  
  Database is skipped when using `header` or `none` modes → enables lighter, stateless deployments.  
  UI now adapts dynamically based on `/api/auth/check` response.  
  Full documentation and local testing examples (including nginx header proxy setup) included.

- **External secrets support**  
  Added compatibility with external secret management; removed mandatory database dependency in non-authenticated scenarios.  
  Updated example configurations to reflect these changes.

- **UI visualization improvements**  
  Enhanced YAML parser and syntax highlighter.  
  Implemented custom floating edges for React Flow (better graph visualization of resources and relationships).

## Bug Fixes

- Fixed event fetching tabs for composite resources and managed resources (#182)
- Resolved role selection dialog issues in user management (create & edit dialogs) (#179)
- Corrected Helm chart icon image URL (#178)
- Fixed "ready resources" filter not working correctly in the global search page (#176)

## Maintenance & Housekeeping

- **Organization migration**  
  Moved repo from `corpobit` → `crossplane-contrib` (#175)

- **Documentation & governance**  
  Added/updates: Contributing guide, MAINTAINERS file, SECURITY.md policy, README table of contents + community links, CODE_OF_CONDUCT.md (#167 & related)

- **Other fixes & contributions**  
  Kubernetes client: deferred `RUnlock` after conditional re-lock in `GetContexts` (thanks @wnqueiroz)  
  Reverted earlier problematic security patches (Feb 10) to stabilize the branch

- **Release engineering**  
  Automated version bumps to v3.6.0-rc.1 through v3.6.0-rc.7 (via GitHub Actions bot)

## Helm Chart & Deployment Changes

- Updated icon image address in chart
- Better SSO/user management configuration options
- Adjusted templates for improved testing and deployment reliability

## How to Test / Upgrade

1. Use the latest RC tag: `v3.6.0-rc.7` (or build from `pre-release` branch)
2. Helm install/upgrade example:
   ```bash
   helm upgrade --install crossview oci://ghcr.io/crossplane-contrib/charts/crossview \
     --version 3.6.0-rc.7 \
     --namespace crossview --create-namespace \
     --set server.auth.mode=header \
     --set trustedHeader=X-Auth-Request-User