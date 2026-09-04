# [4.6.0-rc.2](https://github.com/crossplane-contrib/crossview/compare/v4.6.0-rc.1...v4.6.0-rc.2) (2026-09-04)


### Bug Fixes

* **config:** support context aliases in config and Helm, and improve long-label handling in the UI ([4cc0042](https://github.com/crossplane-contrib/crossview/commit/4cc00428))
* **helm:** add schema coverage for app extension values ([99c23a9](https://github.com/crossplane-contrib/crossview/commit/99c23a9a))


### Features

* **chart:** add extra init containers, extra volumes, extra volume mounts, and automount service account token support ([47e932e](https://github.com/crossplane-contrib/crossview/commit/47e932ea))
* **helm:** add Gateway API HTTPRoute support ([c1a8784](https://github.com/crossplane-contrib/crossview/commit/c1a8784a))


### Documentation

* **readme:** add Buy Me a Coffee support link ([0e0d095](https://github.com/crossplane-contrib/crossview/commit/0e0d095f))
* **helm:** document new chart configuration options and Gateway API usage ([c1a8784](https://github.com/crossplane-contrib/crossview/commit/c1a8784a))


### Other

* **deps:** bump postgres, crypto, gorm, and transitive pgx dependencies ([70196e9](https://github.com/crossplane-contrib/crossview/commit/70196e9e), [9436336](https://github.com/crossplane-contrib/crossview/commit/94363369))

# [4.6.0-rc.1](https://github.com/crossplane-contrib/crossview/compare/v4.5.0...v4.6.0-rc.1) (2026-08-30)


### Bug Fixes

* **ci:** correct Helm image tag rewrite for prerelease versions to prevent malformed Artifact Hub image references ([bcb5fd7](https://github.com/crossplane-contrib/crossview/commit/bcb5fd76))


### Features

* **context-aliases:** add server-driven context alias support in UI and config API ([39e18de](https://github.com/crossplane-contrib/crossview/commit/39e18de3))
* **server:** add native Azure Workload Identity support for Kubernetes auth flow ([a5e2ad8](https://github.com/crossplane-contrib/crossview/commit/a5e2ad8d))

# [4.5.0](https://github.com/crossplane-contrib/crossview/compare/v4.4.0...v4.5.0) (2026-06-29)


### Bug Fixes

* **oidc:** allow empty issuer to skip discovery for split-horizon setups ([d722457](https://github.com/crossplane-contrib/crossview/commit/d7224577f8f0d149db3a9f2e7be824667f827b12))
* **relations:** align kind badge and type title across graph and overview ([cc74494](https://github.com/crossplane-contrib/crossview/commit/cc744949f7f364d6395397f0da4ef5b3909e7532))
* **ci:** fix helm-unittest plugin install on Helm 3.13 and document pinning rationale ([3866a05](https://github.com/crossplane-contrib/crossview/commit/3866a05bd7fcaf1c58f2a877d86071f9848ef1ca), [e32a362](https://github.com/crossplane-contrib/crossview/commit/e32a3628e23c572d03f4bb22cf77cd1436ee8d4f))


### Features

* **relations:** show kind badges and health state on graph nodes and overview tab ([bc0deb1](https://github.com/crossplane-contrib/crossview/commit/bc0deb16a44f4364f24d12fbd96f52ad4f9f8154))
* **frontend:** add ErrorBoundary to prevent full-app crashes ([ae8bb69](https://github.com/crossplane-contrib/crossview/commit/ae8bb69c223639673aa3d4e6384f3889296d6bc2))
* **ui:** add Crossview favicon and switch to icon-only SVG ([52d3a41](https://github.com/crossplane-contrib/crossview/commit/52d3a41cf2a2d79312f8b56f09c7247d8bf50b7a), [3ea3a5c](https://github.com/crossplane-contrib/crossview/commit/3ea3a5cd8f5f2b3d65edc5ec590ce20f3dde2a29))


### Documentation

* clarify PostgreSQL is only required for `auth_mode=session` ([8786f18](https://github.com/crossplane-contrib/crossview/commit/8786f188d3076cc3f41ea72e6227d8f6826e1db0))
* **oidc:** trim loader issuer comment and mirror empty-issuer defaults in JS config loader ([2d56b2e](https://github.com/crossplane-contrib/crossview/commit/2d56b2e9a96ab767b0eb4f8aeeac771f6d910228), [88256f5](https://github.com/crossplane-contrib/crossview/commit/88256f5a897f8bf4e68f2db5752503c2f3c63711), [53e9ce3](https://github.com/crossplane-contrib/crossview/commit/53e9ce38d55b0303563ff47094c2098e4f0fcbaf))


### Other

* cleanups: remove error boundary screenshots and style-only inline comments ([66573ca](https://github.com/crossplane-contrib/crossview/commit/66573ca49558d4306fbf7f4cfd9987d352f7f08b), [07a414b](https://github.com/crossplane-contrib/crossview/commit/07a414bc4d26a4ef57d6c6f228550e81aa96b9db))
* maintenance: update roadmap/dashboard assets and next-version metadata ([223a722](https://github.com/crossplane-contrib/crossview/commit/223a722e1ca4c3f57a8ae724fb69c91d4fed12bf), [b4c98c2](https://github.com/crossplane-contrib/crossview/commit/b4c98c2149ffdb10f70659bbab18f9369aa0db85))

# [4.4.0](https://github.com/crossplane-contrib/crossview/compare/v3.9.0...v4.4.0) (2026-05-19)


### Bug Fixes

* **ci:** make helm-unittest plugin install deterministic ([01bad86](https://github.com/crossplane-contrib/crossview/commit/01bad86825b05851e4c3af8dec0a64651f11da7f))
* **cache:** fix caching and managed resource definition/policy readability ([3a7f9a6](https://github.com/crossplane-contrib/crossview/commit/3a7f9a69d7a3033b5425d20f60dba25cc7b105f2))
* **ui:** pass namespace when navigating from namespaced XR to managed resources ([74892d6](https://github.com/crossplane-contrib/crossview/commit/74892d67232a9cf9f59ca070513d13279a185d90))


### Features

* **resource-relations:** modularize graph UI, refine health/navigation behavior, and improve relation rendering ([8eda498](https://github.com/crossplane-contrib/crossview/commit/8eda498514436ab651d96a7005c5fc92b1d86c46))


### Other

* clean up unused code and improve error handling in optimized context switching flow ([339944b](https://github.com/crossplane-contrib/crossview/commit/339944b585e1796268639035db7a3c9525ab3156))