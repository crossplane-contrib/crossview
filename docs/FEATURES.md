# Crossview Features & Capabilities

## Core Features

### 📊 Dashboard
- **Overview Metrics** - Quick view of resource counts and health status
- **Health Monitoring** - Real-time status of Crossplane resources
- **Widget-Based Layout** - Customizable dashboard widgets
- **Resource Counts** - Track Claims, XRDs, Compositions, and Providers

### 🔍 Resource Management
- **Advanced Search** - Search across all resource types and namespaces
- **Resource Browser** - Navigate resources by type, namespace, or label
- **Resource Details** - Comprehensive view of resource specifications
- **YAML Editor** - View and understand resource definitions
- **Resource Relations** - Visualize relationships between resources

![Global Search](../public/images/global-search.png)

### 📦 Crossplane-Specific Features
- **Claims Management** - View and manage Crossplane Claims
- **Composite Resources** - Monitor Composite Resources (XRs)
- **Compositions** - Browse and understand Composition definitions
- **XRD Browser** - Explore Composite Resource Definitions
- **Provider Status** - Monitor Crossplane Provider health

![Composition Resources](../public/images/composition-resources.png)

### 🕸️ Graph
The **Graph** page shows XRDs, Compositions, Composite Resources (XRs), Composed Resources and Functions in one graph. It is built from a single `GET /api/graph` call and every edge comes from a field Kubernetes already exposes:

Arrows point downstream from the XRD, the root of everything else:

| Edge | Derived from |
|------|--------------|
| XRD → Composition | the Composition's `spec.compositeTypeRef` |
| XRD → XR | the kind the XRD defines; shown only for an XR with no Composition, since XRD → Composition → XR already implies it |
| Composition → XR | the XR's `spec.crossplane.compositionRef` (v2) or `spec.compositionRef` (v1) |
| Composition → Function | `spec.pipeline[].functionRef.name` |
| XR → composed resource | `spec.crossplane.resourceRefs` (v2) or `spec.resourceRefs` (v1) |
| XR → nested XR | a composed resource that is itself an XR |

Edges are curved and take the colour of the node type they point to. Pointing at a node, or selecting it, highlights its whole chain and fades the rest.

Filters apply instantly in the browser and are kept in the URL, so a filtered view can be shared:

- Toggle each node type, for example hide Composed Resources to leave only XRDs, Compositions and Composite Resources
- Namespace and API group / kind pick lists, and text search
- Show Healthy (`Ready` is `True`) or Show Unhealthy (`Ready` or `Synced` is `False`). The page first loads without the managed resource list, which is the slowest part, so Composed Resources have no health yet. Either button loads it, and `GET /api/graph?includeManaged=false` is the call without it.
- Focus on the selected node to hide everything outside its chain: what it depends on and everything built from it

Large clusters: the graph limits how many of each type it draws, so it stays readable and clickable. The defaults are 25 XRDs, 25 Compositions, 25 Functions, 15 Composite Resources and 45 Composed Resources. When a type is limited, the page shows the unhealthy ones first, then an even spread across kinds, and for each Composite Resource shown, its own Composed Resources. Namespace, kind, name search and Focus narrow what the limits choose from.

The panel under the filters is one line while it is closed. If not everything is shown it says so with a warning, for example "Not everything is shown: 15 of 2,500 Composite Resources and 45 of 7,500 Composed Resources", and counts the resources that need attention and the notices. Open it with Adjust to move a "Show up to" slider for any type, up to 5,000. The limits are kept in the URL, for example `maxXr=100`.

The page warns when more than 5,000 nodes would be drawn, because they can take a few seconds to appear, and it does not draw more than 10,000. Past that it opens the panel, says why, and offers a button to go back to the default limits. On a fast laptop 4,000 nodes appear in under a second and 15,000 in about three, and a slower machine takes several times longer.

A graph taller than the screen opens at a readable size, showing the top. Open the panel to see warnings about the data itself: a kind that could not be listed, Composed Resource health that comes from a cache or hit the 5,000 per kind limit, resources that are referenced but have an unknown status, and Composite Resources with no Composition.

A node's border follows its type. A red border marks a node whose `Ready` or `Synced` is `False`, and an orange border one whose `Ready` is `Unknown`; hover the node to see which.

A Composite Resource that has no Composition shows a red "No Composition" tag. Crossplane writes the chosen Composition onto every XR it reconciles, so this means the XR is brand new or Crossplane could not select one; check its `Synced` condition.

Scrolling over the graph scrolls the page. Hold Ctrl and scroll, pinch on a trackpad, or use the zoom buttons to zoom the graph, and drag to pan.

Click a node to open the usual resource details below the graph.

Limitations:
- The page is read-only; it has no edit or write actions.
- Soft dependencies are not shown. Crossplane does not record on an XR that a Composition reads another XR's status through function requirements, or uses a Secret name or URL, so nothing in the API says so.
- Composed resources that are not Crossplane managed resources (for example a Deployment or ConfigMap) have no readiness, because only managed resources report it. Their Composite Resource's `Ready` covers them.
- A reference without a namespace is looked up in the XR's namespace, then cluster-scoped.

### 🔐 Security & Access
- **User Authentication** - Secure login system
- **Authentication Modes** - Session (default), header (trust proxy identity), or none (development)
- **Session Management** - PostgreSQL-backed sessions (session mode only)
- **SSO Support** - Single Sign-On via OIDC or SAML (session mode)
- **Header Auth** - Integrate with OAuth2 Proxy, Ingress auth, or other proxies that set identity headers
- **RBAC Integration** - Uses Kubernetes RBAC for resource access

### 🎨 User Experience
- **Modern UI** - Built with React and Chakra UI
- **Responsive Design** - Works on desktop and tablet
- **Dark Mode** - Theme customization
- **Fast Navigation** - Optimized for large resource sets

## Use Cases

### Infrastructure Teams
- Monitor infrastructure-as-code deployments
- Track resource health across environments
- Debug Crossplane resource issues
- Audit infrastructure changes

### Platform Engineers
- Manage Crossplane Compositions
- Monitor Provider status
- Validate resource configurations
- Onboard new team members

### DevOps Teams
- Search and filter resources quickly
- Understand resource relationships
- Troubleshoot deployment issues
- Manage multiple Kubernetes clusters

## Technical Capabilities

### Multi-Cluster Support
- Connect to multiple Kubernetes contexts
- Switch between clusters seamlessly
- Context-aware resource browsing

### Performance
- Paginated resource lists
- Efficient API calls
- Client-side caching
- Optimized for large-scale deployments

### Integration
- Kubernetes-native (uses service accounts)
- Helm chart available
- Docker image ready
- RESTful API for automation

## What Crossview Does NOT Do

- **Resource Modification** - Read-only dashboard (for safety)
- **Resource Creation** - Use kubectl or GitOps for creating resources
- **Policy Enforcement** - Use Crossplane policies for that
- **CI/CD Integration** - Focuses on visualization and monitoring

## Comparison with Other Tools

### vs kubectl
- **Visual Interface** - No need to remember kubectl commands
- **Crossplane-Focused** - Optimized for Crossplane resources
- **Search** - Advanced filtering and search capabilities
- **Relationships** - Visual resource relationship mapping

### vs Kubernetes Dashboard
- **Crossplane-Specific** - Built for Crossplane workflows
- **Resource Relations** - Understand Crossplane resource hierarchy
- **Composition View** - Specialized views for Compositions and Claims
- **Provider Monitoring** - Track Crossplane Provider status

