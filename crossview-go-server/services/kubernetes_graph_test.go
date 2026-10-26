package services

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"

	"k8s.io/apimachinery/pkg/util/yaml"
)

const fixtureGroup = "platform.example.org"

func loadGraphFixture(t *testing.T, name string) []map[string]interface{} {
	t.Helper()
	f, err := os.Open(filepath.Join("testdata", "graph", name))
	if err != nil {
		t.Fatalf("open fixture %s: %v", name, err)
	}
	defer f.Close()

	var items []map[string]interface{}
	decoder := yaml.NewYAMLOrJSONDecoder(f, 4096)
	for {
		var obj map[string]interface{}
		if err := decoder.Decode(&obj); err != nil {
			if errors.Is(err, io.EOF) {
				return items
			}
			t.Fatalf("decode fixture %s: %v", name, err)
		}
		if obj != nil {
			items = append(items, obj)
		}
	}
}

// loadGraphInput mirrors what GetGraph assembles: XRs carry the plural set by the fetch step.
func loadGraphInput(t *testing.T) GraphInput {
	t.Helper()
	xrs := append(loadGraphFixture(t, "xrs.yaml"), loadGraphFixture(t, "xrs_v1.yaml")...)
	return GraphInput{
		XRDs:         loadGraphFixture(t, "xrds.yaml"),
		Compositions: loadGraphFixture(t, "compositions.yaml"),
		Functions:    loadGraphFixture(t, "functions.yaml"),
		XRs:          xrs,
		Managed:      loadGraphFixture(t, "managed.yaml"),
	}
}

func xrID(kind, namespace, name string) string {
	return graphResourceID(fixtureGroup, kind, namespace, name)
}

func findNode(g Graph, id string) (GraphNode, bool) {
	for _, n := range g.Nodes {
		if n.ID == id {
			return n, true
		}
	}
	return GraphNode{}, false
}

func hasEdge(g Graph, source, target, edgeType string) bool {
	for _, e := range g.Edges {
		if e.Source == source && e.Target == target && e.Type == edgeType {
			return true
		}
	}
	return false
}

func countEdges(g Graph, edgeType string) int {
	n := 0
	for _, e := range g.Edges {
		if e.Type == edgeType {
			n++
		}
	}
	return n
}

func TestBuildGraph_XRDToComposition(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))

	if !hasEdge(g, "xrd/identityproviders."+fixtureGroup, "composition/identityprovider", GraphEdgeXRDComposition) {
		t.Error("expected XRD identityproviders -> composition identityprovider")
	}
	if !hasEdge(g, "xrd/authproxies."+fixtureGroup, "composition/authproxy-experimental", GraphEdgeXRDComposition) {
		t.Error("expected one XRD to point at every composition that targets it")
	}
	if got := countEdges(g, GraphEdgeXRDComposition); got != 9 {
		t.Errorf("expected 9 XRD->composition edges, got %d", got)
	}
}

func TestBuildGraph_XRDToXR(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))

	if !hasEdge(g, "xrd/authproxies."+fixtureGroup, xrID("AuthProxy", "media", "web-a"), GraphEdgeXRDXR) {
		t.Error("expected XRD authproxies -> AuthProxy media/web-a")
	}
	if !hasEdge(g, "xrd/legacydatabases."+fixtureGroup, xrID("LegacyDatabase", "", "orders-db"), GraphEdgeXRDXR) {
		t.Error("expected XRD legacydatabases -> cluster-scoped XR")
	}
	// 11 namespaced XRs plus 1 cluster-scoped XR.
	if got := countEdges(g, GraphEdgeXRDXR); got != 12 {
		t.Errorf("expected 12 XRD->XR edges, got %d", got)
	}
}

func TestBuildGraph_CompositionToXR_V2AndV1(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))

	if !hasEdge(g, "composition/authproxy", xrID("AuthProxy", "media", "web-a"), GraphEdgeCompositionXR) {
		t.Error("expected v2 spec.crossplane.compositionRef edge")
	}
	if !hasEdge(g, "composition/legacydatabase", xrID("LegacyDatabase", "", "orders-db"), GraphEdgeCompositionXR) {
		t.Error("expected v1 spec.compositionRef edge")
	}
}

func TestBuildGraph_CompositionWithNoInstances(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))

	if _, ok := findNode(g, "composition/authproxy-experimental"); !ok {
		t.Fatal("composition without instances must still be a node")
	}
	for _, e := range g.Edges {
		if e.Source == "composition/authproxy-experimental" && e.Type == GraphEdgeCompositionXR {
			t.Errorf("unexpected composition->XR edge %+v", e)
		}
	}
}

func TestBuildGraph_CompositionToFunction(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))

	if !hasEdge(g, "composition/identityprovider", "function/function-go-templating", GraphEdgeCompositionFunction) {
		t.Error("expected composition -> function-go-templating")
	}
	// 7 two-step pipelines + 1 one-step pipeline; the legacy composition has none.
	if got := countEdges(g, GraphEdgeCompositionFunction); got != 15 {
		t.Errorf("expected 15 composition->function edges, got %d", got)
	}
	for _, e := range g.Edges {
		if e.Source == "composition/legacydatabase" && e.Type == GraphEdgeCompositionFunction {
			t.Errorf("legacy composition must not have function edges: %+v", e)
		}
	}
}

func TestBuildGraph_MissingFunctionBecomesStub(t *testing.T) {
	in := loadGraphInput(t)
	in.Functions = in.Functions[:1]
	g := BuildGraph(in)

	n, ok := findNode(g, "function/function-auto-ready")
	if !ok || !n.Unresolved {
		t.Errorf("expected unresolved stub for a function that is not installed, got %+v (found=%v)", n, ok)
	}
}

func TestBuildGraph_NestedXRs(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))

	parent := xrID("IdentityProvider", "identity", "identity")
	if !hasEdge(g, parent, xrID("IdentityGroup", "identity", "admins"), GraphEdgeXRXR) {
		t.Error("expected IdentityProvider -> IdentityGroup XR edge")
	}
	if !hasEdge(g, parent, xrID("IdentityUser", "identity", "user-1"), GraphEdgeXRXR) {
		t.Error("expected IdentityProvider -> IdentityUser XR edge")
	}
	for _, e := range g.Edges {
		if e.Source == parent && e.Type == GraphEdgeXRComposed && e.Target == xrID("IdentityGroup", "identity", "admins") {
			t.Error("a nested XR must not also be a composed edge")
		}
	}
}

func TestBuildGraph_CrossNamespaceConsumers(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))

	client := xrID("IdentityClient", "identity", "web-a")
	if !hasEdge(g, xrID("AuthProxy", "media", "web-a"), client, GraphEdgeXRXR) {
		t.Error("expected media AuthProxy -> identity IdentityClient")
	}
	if !hasEdge(g, xrID("AuthProxy", "encoding", "web-b"), xrID("IdentityClient", "identity", "web-b"), GraphEdgeXRXR) {
		t.Error("expected encoding AuthProxy -> identity IdentityClient")
	}
	if !hasEdge(g, xrID("Dashboard", "media", "dashboard"), xrID("IdentityClient", "identity", "dashboard"), GraphEdgeXRXR) {
		t.Error("expected Dashboard XR -> IdentityClient XR")
	}
	if !hasEdge(g, xrID("BudgetApp", "media", "budgetapp"), xrID("IdentityClient", "identity", "budgetapp"), GraphEdgeXRXR) {
		t.Error("expected BudgetApp XR -> IdentityClient XR")
	}
	if n, _ := findNode(g, client); n.Namespace != "identity" || n.Unresolved {
		t.Errorf("cross-namespace target should resolve to the real XR, got %+v", n)
	}
}

func TestBuildGraph_ComposedResources(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))

	objID := graphResourceID("kubernetes.crossplane.io", "Object", "media", "web-a-proxy")
	if !hasEdge(g, xrID("AuthProxy", "media", "web-a"), objID, GraphEdgeXRComposed) {
		t.Error("expected XR -> composed Object edge")
	}
	n, ok := findNode(g, objID)
	if !ok || n.Type != GraphNodeComposed || n.Ready != "True" || n.Unresolved {
		t.Errorf("composed node should be enriched from the managed list, got %+v", n)
	}
}

func TestBuildGraph_V1RefsAndDanglingRef(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))
	xr := xrID("LegacyDatabase", "", "orders-db")

	bucket := graphResourceID("s3.example.org", "Bucket", "", "orders-db-bucket")
	if !hasEdge(g, xr, bucket, GraphEdgeXRComposed) {
		t.Error("expected v1 spec.resourceRefs edge to a cluster-scoped resource")
	}
	if n, _ := findNode(g, bucket); n.Unresolved {
		t.Errorf("known cluster-scoped resource must resolve, got %+v", n)
	}

	missing := graphResourceID("s3.example.org", "Bucket", "", "orders-db-missing")
	n, ok := findNode(g, missing)
	if !ok || !n.Unresolved || n.Ready != "" {
		t.Errorf("dangling ref should be an unresolved stub without readiness, got %+v (found=%v)", n, ok)
	}
}

func TestBuildGraph_Readiness(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))

	if n, _ := findNode(g, xrID("BudgetApp", "media", "budgetapp")); n.Ready != "False" || n.Synced != "True" {
		t.Errorf("unready XR should report Ready=False Synced=True, got %+v", n)
	}
	if n, _ := findNode(g, xrID("AuthProxy", "media", "web-a")); n.Ready != "True" {
		t.Errorf("ready XR should report Ready=True, got %+v", n)
	}
	if n, _ := findNode(g, "xrd/identityproviders."+fixtureGroup); n.Ready != "True" {
		t.Errorf("XRD readiness comes from Established, got %+v", n)
	}
}

func TestBuildGraph_V2RefsWinOverV1(t *testing.T) {
	xr := map[string]interface{}{
		"apiVersion": fixtureGroup + "/v1alpha1",
		"kind":       "IdentityGroup",
		"metadata":   map[string]interface{}{"name": "g", "namespace": "ns"},
		"spec": map[string]interface{}{
			"crossplane": map[string]interface{}{
				"resourceRefs": []interface{}{map[string]interface{}{"apiVersion": "x.example.org/v1", "kind": "A", "name": "v2"}},
			},
			"resourceRefs": []interface{}{map[string]interface{}{"apiVersion": "x.example.org/v1", "kind": "A", "name": "v1"}},
		},
	}
	g := BuildGraph(GraphInput{XRs: []map[string]interface{}{xr}})

	if _, ok := findNode(g, graphResourceID("x.example.org", "A", "ns", "v2")); !ok {
		t.Error("expected the v2 ref to be used")
	}
	if _, ok := findNode(g, graphResourceID("x.example.org", "A", "ns", "v1")); ok {
		t.Error("v1 refs must be ignored when v2 refs are present")
	}
}

func TestBuildGraph_Deterministic(t *testing.T) {
	a := BuildGraph(loadGraphInput(t))
	b := BuildGraph(loadGraphInput(t))

	if len(a.Nodes) != len(b.Nodes) || len(a.Edges) != len(b.Edges) {
		t.Fatal("graph size differs between runs")
	}
	for i := range a.Nodes {
		if a.Nodes[i] != b.Nodes[i] {
			t.Fatalf("node order differs at %d", i)
		}
	}
	for i := range a.Edges {
		if a.Edges[i] != b.Edges[i] {
			t.Fatalf("edge order differs at %d", i)
		}
	}
}

func TestBuildGraph_Empty(t *testing.T) {
	g := BuildGraph(GraphInput{})
	if g.Nodes == nil || g.Edges == nil {
		t.Error("empty graph must marshal as empty arrays, not null")
	}
}

// fakeGraphService serves the fixtures and records the XR list calls GetGraph makes.
func warningCodes(g Graph) []string {
	codes := []string{}
	for _, w := range g.Warnings {
		codes = append(codes, w.Code)
	}
	return codes
}

func TestBuildGraph_XRDRecordsTheKindItDefines(t *testing.T) {
	g := BuildGraph(loadGraphInput(t))
	n, ok := findNode(g, "xrd/identityclients."+fixtureGroup)
	if !ok || n.Defines != fixtureGroup+"/IdentityClient" {
		t.Errorf("an XRD should record the group/Kind it defines, got %+v", n)
	}
}

func TestBuildGraph_ObjectNamesTheKindItWraps(t *testing.T) {
	xr := map[string]interface{}{
		"apiVersion": "example.org/v1", "kind": "App",
		"metadata": map[string]interface{}{"name": "a"},
		"spec": map[string]interface{}{"resourceRefs": []interface{}{
			map[string]interface{}{"apiVersion": "kubernetes.crossplane.io/v1alpha2", "kind": "Object", "name": "a-deploy"},
		}},
	}
	managed := map[string]interface{}{
		"apiVersion": "kubernetes.crossplane.io/v1alpha2", "kind": "Object",
		"metadata": map[string]interface{}{"name": "a-deploy"},
		"spec": map[string]interface{}{"forProvider": map[string]interface{}{
			"manifest": map[string]interface{}{"kind": "Deployment"},
		}},
	}
	g := BuildGraph(GraphInput{XRs: []map[string]interface{}{xr}, Managed: []map[string]interface{}{managed}})
	for _, n := range g.Nodes {
		if n.Type == GraphNodeComposed {
			if n.Wraps != "Deployment" {
				t.Fatalf("Wraps = %q, want Deployment", n.Wraps)
			}
			return
		}
	}
	t.Fatal("no composed node")
}
