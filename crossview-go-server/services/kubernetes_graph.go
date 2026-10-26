package services

import "sort"

const (
	GraphNodeXRD         = "xrd"
	GraphNodeComposition = "composition"
	GraphNodeXR          = "xr"
	GraphNodeComposed    = "composed"
	GraphNodeFunction    = "function"

	GraphEdgeXRDComposition      = "xrdComposition"
	GraphEdgeXRDXR               = "xrdXR"
	GraphEdgeCompositionXR       = "compositionXR"
	GraphEdgeXRComposed          = "xrComposed"
	GraphEdgeXRXR                = "xrXR"
	GraphEdgeCompositionFunction = "compositionFunction"
)

type GraphNode struct {
	ID         string `json:"id"`
	Type       string `json:"type"`
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Plural     string `json:"plural,omitempty"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace,omitempty"`
	Ready      string `json:"ready,omitempty"`
	Synced     string `json:"synced,omitempty"`
	Unresolved bool   `json:"unresolved,omitempty"`
	Defines    string `json:"defines,omitempty"` // for an XRD, the "group/Kind" it defines
	Wraps      string `json:"wraps,omitempty"`   // for a provider-kubernetes Object, the Kind of the manifest it applies
}

// GraphEdge points downstream from the XRD: to its Compositions and XRs, then to what they use or create.
type GraphEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Type   string `json:"type"`
}

// GraphWarning says that the graph is incomplete or less certain than it looks.
type GraphWarning struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Graph struct {
	Nodes    []GraphNode    `json:"nodes"`
	Edges    []GraphEdge    `json:"edges"`
	Warnings []GraphWarning `json:"warnings"`
}

// GraphInput holds the raw objects the graph is derived from.
type GraphInput struct {
	XRDs         []map[string]interface{}
	Compositions []map[string]interface{}
	Functions    []map[string]interface{}
	XRs          []map[string]interface{}
	Managed      []map[string]interface{}
}

type graphBuilder struct {
	nodes     map[string]*GraphNode
	edges     map[GraphEdge]struct{}
	xrdByKind map[string]string                 // "group/Kind" to the XRD node ID
	managed   map[string]map[string]interface{} // resource ID to the managed resource
}

// BuildGraph derives nodes and edges from the given objects without any cluster access.
func BuildGraph(in GraphInput) Graph {
	b := &graphBuilder{
		nodes:     map[string]*GraphNode{},
		edges:     map[GraphEdge]struct{}{},
		xrdByKind: map[string]string{},
		managed:   map[string]map[string]interface{}{},
	}

	b.indexManaged(in.Managed)
	b.addXRDs(in.XRDs)
	b.addFunctions(in.Functions)
	b.addCompositions(in.Compositions)
	b.addXRs(in.XRs)
	b.addXRRefs(in.XRs) // after addXRs, so nested XRs already exist as nodes
	return b.result()
}

// addEdge records a directed edge once, however many times it is found.
func (b *graphBuilder) addEdge(source, target, edgeType string) {
	b.edges[GraphEdge{Source: source, Target: target, Type: edgeType}] = struct{}{}
}

// indexManaged keeps the managed resources by ID, so references can pick up their health.
func (b *graphBuilder) indexManaged(managed []map[string]interface{}) {
	for _, m := range managed {
		b.managed[graphObjectID(m)] = m
	}
}

// addXRDs adds a node per XRD and remembers which "group/Kind" each one defines.
func (b *graphBuilder) addXRDs(xrds []map[string]interface{}) {
	for _, xrd := range xrds {
		name := graphString(xrd, "metadata", "name")
		id := xrdNodeID(name)
		node := &GraphNode{
			ID: id, Type: GraphNodeXRD, APIVersion: graphString(xrd, "apiVersion"),
			Kind: "CompositeResourceDefinition", Name: name,
			Ready: graphCondition(xrd, "Established"),
		}
		if kind := graphString(xrd, "spec", "names", "kind"); kind != "" {
			node.Defines = graphKindKey(graphString(xrd, "spec", "group"), kind)
			b.xrdByKind[node.Defines] = id
		}
		b.nodes[id] = node
	}
}

// addFunctions adds a node per installed Function.
func (b *graphBuilder) addFunctions(functions []map[string]interface{}) {
	for _, fn := range functions {
		name := graphString(fn, "metadata", "name")
		id := functionNodeID(name)
		b.nodes[id] = &GraphNode{
			ID: id, Type: GraphNodeFunction, APIVersion: graphString(fn, "apiVersion"),
			Kind: "Function", Name: name, Ready: graphCondition(fn, "Healthy"),
		}
	}
}

// addCompositions adds a node per Composition and links it to its XRD and Functions.
func (b *graphBuilder) addCompositions(compositions []map[string]interface{}) {
	for _, comp := range compositions {
		name := graphString(comp, "metadata", "name")
		id := compositionNodeID(name)
		b.nodes[id] = &GraphNode{
			ID: id, Type: GraphNodeComposition, APIVersion: graphString(comp, "apiVersion"),
			Kind: "Composition", Name: name,
		}
		b.linkCompositionToXRD(id, comp)
		b.linkCompositionToFunctions(id, comp)
	}
}

// linkCompositionToXRD draws the edge from the XRD that defines the Composition's composite type.
func (b *graphBuilder) linkCompositionToXRD(compID string, comp map[string]interface{}) {
	typeRef := graphKindKey(
		graphGroup(graphString(comp, "spec", "compositeTypeRef", "apiVersion")),
		graphString(comp, "spec", "compositeTypeRef", "kind"),
	)
	if xrdID, ok := b.xrdByKind[typeRef]; ok {
		b.addEdge(xrdID, compID, GraphEdgeXRDComposition)
	}
}

// linkCompositionToFunctions draws an edge to each Function a pipeline step calls.
func (b *graphBuilder) linkCompositionToFunctions(compID string, comp map[string]interface{}) {
	for _, step := range graphSlice(comp, "spec", "pipeline") {
		stepMap, _ := step.(map[string]interface{})
		if name := graphString(stepMap, "functionRef", "name"); name != "" {
			b.addEdge(compID, b.functionNode(name), GraphEdgeCompositionFunction)
		}
	}
}

// functionNode returns the ID of a Function, adding an unresolved stub when it is not installed.
func (b *graphBuilder) functionNode(name string) string {
	id := functionNodeID(name)
	if _, ok := b.nodes[id]; !ok {
		b.nodes[id] = &GraphNode{ID: id, Type: GraphNodeFunction, Kind: "Function", Name: name, Unresolved: true}
	}
	return id
}

// addXRs adds a node per Composite Resource and links it to its XRD and Composition.
func (b *graphBuilder) addXRs(xrs []map[string]interface{}) {
	for _, xr := range xrs {
		id := graphObjectID(xr)
		ready, synced := graphReadiness(xr)
		b.nodes[id] = &GraphNode{
			ID: id, Type: GraphNodeXR, APIVersion: graphString(xr, "apiVersion"), Kind: graphString(xr, "kind"),
			Plural: graphString(xr, "plural"), Name: graphString(xr, "metadata", "name"),
			Namespace: graphString(xr, "metadata", "namespace"), Ready: ready, Synced: synced,
		}
		b.linkXRToXRD(id, xr)
		b.linkXRToComposition(id, xr)
	}
}

// linkXRToXRD draws the edge from the XRD that defines the XR's kind.
func (b *graphBuilder) linkXRToXRD(xrID string, xr map[string]interface{}) {
	kindKey := graphKindKey(graphGroup(graphString(xr, "apiVersion")), graphString(xr, "kind"))
	if xrdID, ok := b.xrdByKind[kindKey]; ok {
		b.addEdge(xrdID, xrID, GraphEdgeXRDXR)
	}
}

// linkXRToComposition draws the edge from the Composition the XR uses, when one is set and known.
func (b *graphBuilder) linkXRToComposition(xrID string, xr map[string]interface{}) {
	name := graphCompositionName(xr)
	if name == "" {
		return
	}
	if compID := compositionNodeID(name); b.nodes[compID] != nil {
		b.addEdge(compID, xrID, GraphEdgeCompositionXR)
	}
}

// addXRRefs links each XR to the resources it references, once every XR already has a node.
func (b *graphBuilder) addXRRefs(xrs []map[string]interface{}) {
	for _, xr := range xrs {
		xrID := graphObjectID(xr)
		xrNamespace := graphString(xr, "metadata", "namespace")
		for _, ref := range graphRefs(xr) {
			refMap, _ := ref.(map[string]interface{})
			b.addRef(xrID, xrNamespace, refMap)
		}
	}
}

// graphRef is a reference from an XR to something it composes.
type graphRef struct {
	apiVersion, kind, name string
	namespaces             []string // where to look, in order
}

// newGraphRef reads a reference, returning false when it has no kind or no name.
func newGraphRef(ref map[string]interface{}, xrNamespace string) (graphRef, bool) {
	r := graphRef{
		apiVersion: graphString(ref, "apiVersion"),
		kind:       graphString(ref, "kind"),
		name:       graphString(ref, "name"),
	}
	if r.kind == "" || r.name == "" {
		return r, false
	}
	if ns := graphString(ref, "namespace"); ns != "" {
		r.namespaces = []string{ns}
	} else {
		// No namespace on the ref: try the XR's own namespace, then cluster-scoped.
		r.namespaces = []string{xrNamespace, ""}
	}
	return r, true
}

// idIn returns the node ID the reference would have in the given namespace.
func (r graphRef) idIn(namespace string) string {
	return graphResourceID(graphGroup(r.apiVersion), r.kind, namespace, r.name)
}

// addRef links an XR to a referenced resource, or to a stub when the resource cannot be found.
func (b *graphBuilder) addRef(xrID, xrNamespace string, refObj map[string]interface{}) {
	ref, ok := newGraphRef(refObj, xrNamespace)
	if !ok {
		return
	}
	for _, ns := range ref.namespaces {
		if b.linkToKnownResource(xrID, ref, ns) {
			return
		}
	}
	b.linkToStub(xrID, ref)
}

// linkToKnownResource links to a node we already have, or builds one from the managed list.
func (b *graphBuilder) linkToKnownResource(xrID string, ref graphRef, namespace string) bool {
	targetID := ref.idIn(namespace)
	if node, ok := b.nodes[targetID]; ok {
		b.addEdge(xrID, targetID, edgeTypeToward(node.Type))
		return true
	}
	if managed, ok := b.managed[targetID]; ok {
		ready, synced := graphReadiness(managed)
		b.nodes[targetID] = &GraphNode{
			ID: targetID, Type: GraphNodeComposed, APIVersion: ref.apiVersion, Kind: ref.kind, Name: ref.name,
			Namespace: namespace, Ready: ready, Synced: synced, Wraps: graphWrappedKind(managed),
		}
		b.addEdge(xrID, targetID, GraphEdgeXRComposed)
		return true
	}
	return false
}

// linkToStub keeps a node that carries only what the ref says, for objects we could not fetch.
func (b *graphBuilder) linkToStub(xrID string, ref graphRef) {
	namespace := ref.namespaces[0]
	nodeType := GraphNodeComposed
	if _, isXR := b.xrdByKind[graphKindKey(graphGroup(ref.apiVersion), ref.kind)]; isXR {
		nodeType = GraphNodeXR
	}
	targetID := ref.idIn(namespace)
	b.nodes[targetID] = &GraphNode{
		ID: targetID, Type: nodeType, APIVersion: ref.apiVersion, Kind: ref.kind, Name: ref.name,
		Namespace: namespace, Unresolved: true,
	}
	b.addEdge(xrID, targetID, edgeTypeToward(nodeType))
}

// edgeTypeToward picks the edge type for an edge that ends at a node of the given type.
func edgeTypeToward(nodeType string) string {
	if nodeType == GraphNodeXR {
		return GraphEdgeXRXR
	}
	return GraphEdgeXRComposed
}

// result returns the graph sorted, so the same input always gives the same output.
func (b *graphBuilder) result() Graph {
	g := Graph{
		Nodes:    make([]GraphNode, 0, len(b.nodes)),
		Edges:    make([]GraphEdge, 0, len(b.edges)),
		Warnings: []GraphWarning{},
	}
	for _, n := range b.nodes {
		g.Nodes = append(g.Nodes, *n)
	}
	for e := range b.edges {
		g.Edges = append(g.Edges, e)
	}
	sort.Slice(g.Nodes, func(i, j int) bool { return g.Nodes[i].ID < g.Nodes[j].ID })
	sort.Slice(g.Edges, func(i, j int) bool { return edgeLess(g.Edges[i], g.Edges[j]) })
	return g
}

// edgeLess orders edges by source, then target, then type.
func edgeLess(a, b GraphEdge) bool {
	if a.Source != b.Source {
		return a.Source < b.Source
	}
	if a.Target != b.Target {
		return a.Target < b.Target
	}
	return a.Type < b.Type
}
