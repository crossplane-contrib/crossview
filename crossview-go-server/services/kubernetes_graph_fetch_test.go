package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"crossview-go-server/lib"
)

type fakeGraphService struct {
	KubernetesServiceInterface
	t        *testing.T
	mu       sync.Mutex
	xrCalls  map[string]string
	failKind string

	managedErr       error
	managedFromCache bool
	managedFiller    int   // extra managed resources of one kind, to reach the per-kind cap
	managedCap       int64 // the configured per-kind cap; 0 means the default
}

func (f *fakeGraphService) ManagedMaxItemsPerType() int64 {
	if f.managedCap > 0 {
		return f.managedCap
	}
	return lib.DefaultManagedMaxItemsPerType
}

func (f *fakeGraphService) GetResources(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
	if kind == f.failKind {
		return nil, errors.New("boom")
	}
	var items []map[string]interface{}
	switch kind {
	case "CompositeResourceDefinition":
		items = loadGraphFixture(f.t, "xrds.yaml")
	case "Composition":
		items = loadGraphFixture(f.t, "compositions.yaml")
	case "Function":
		items = loadGraphFixture(f.t, "functions.yaml")
	default:
		f.mu.Lock()
		f.xrCalls[kind] = apiVersion + "|" + plural
		f.mu.Unlock()
		for _, xr := range append(loadGraphFixture(f.t, "xrs.yaml"), loadGraphFixture(f.t, "xrs_v1.yaml")...) {
			if xr["kind"] == kind {
				items = append(items, xr)
			}
		}
	}
	raw := make([]interface{}, len(items))
	for i, item := range items {
		raw[i] = item
	}
	return map[string]interface{}{"items": raw}, nil
}

func (f *fakeGraphService) GetManagedResources(contextName string, forceRefresh bool) (map[string]interface{}, error) {
	if f.managedErr != nil {
		return nil, f.managedErr
	}
	raw := []interface{}{}
	for _, m := range loadGraphFixture(f.t, "managed.yaml") {
		raw = append(raw, m)
	}
	for i := 0; i < f.managedFiller; i++ {
		raw = append(raw, benchObject("filler.example.org/v1", "Filler", "ns", fmt.Sprintf("filler-%d", i)))
	}
	return map[string]interface{}{"items": raw, "fromCache": f.managedFromCache}, nil
}

func TestGetGraph_FetchesEachXRKindOnce(t *testing.T) {
	svc := &fakeGraphService{t: t, xrCalls: map[string]string{}}
	g, err := GetGraph(svc, "ctx", GraphOptions{})
	if err != nil {
		t.Fatalf("GetGraph: %v", err)
	}

	if got := svc.xrCalls["AuthProxy"]; got != fixtureGroup+"/v1alpha1|authproxies" {
		t.Errorf("expected XR list with group/version and plural from the XRD, got %q", got)
	}
	if len(svc.xrCalls) != 8 {
		t.Errorf("expected one list call per XRD (8), got %d", len(svc.xrCalls))
	}
	if !hasEdge(g, xrID("AuthProxy", "media", "web-a"), xrID("IdentityClient", "identity", "web-a"), GraphEdgeXRXR) {
		t.Error("expected the end-to-end graph to contain the nested XR edge")
	}
	if n, _ := findNode(g, xrID("AuthProxy", "media", "web-a")); n.Plural != "authproxies" || n.APIVersion != fixtureGroup+"/v1alpha1" {
		t.Errorf("XR node should carry apiVersion and plural from the XRD, got %+v", n)
	}
}

func TestGetGraph_ListErrorsFail(t *testing.T) {
	for _, kind := range []string{"CompositeResourceDefinition", "Composition", "Function"} {
		svc := &fakeGraphService{t: t, xrCalls: map[string]string{}, failKind: kind}
		if _, err := GetGraph(svc, "ctx", GraphOptions{}); err == nil {
			t.Errorf("expected an error when listing %s fails", kind)
		}
	}
}

func TestGraphXRDVersion(t *testing.T) {
	xrd := func(versions ...map[string]interface{}) map[string]interface{} {
		list := make([]interface{}, len(versions))
		for i, v := range versions {
			list[i] = v
		}
		return map[string]interface{}{"spec": map[string]interface{}{"versions": list}}
	}
	cases := []struct {
		name string
		xrd  map[string]interface{}
		want string
	}{
		{"referenceable wins over first", xrd(
			map[string]interface{}{"name": "v1alpha1", "served": true, "referenceable": false},
			map[string]interface{}{"name": "v1", "served": true, "referenceable": true}), "v1"},
		{"falls back to first", xrd(map[string]interface{}{"name": "v1beta1"}), "v1beta1"},
		{"none", xrd(), ""},
	}
	for _, c := range cases {
		if got := graphXRDVersion(c.xrd); got != c.want {
			t.Errorf("%s: expected %q, got %q", c.name, c.want, got)
		}
	}
}

func TestGetGraph_NoWarningsWhenEverythingLists(t *testing.T) {
	g, err := GetGraph(&fakeGraphService{t: t, xrCalls: map[string]string{}}, "ctx", GraphOptions{})
	if err != nil {
		t.Fatalf("GetGraph: %v", err)
	}
	if g.Warnings == nil || len(g.Warnings) != 0 {
		t.Errorf("expected an empty, non-nil warnings list, got %v", g.Warnings)
	}
	body, _ := json.Marshal(g)
	if !strings.Contains(string(body), `"warnings":[]`) {
		t.Errorf("warnings must marshal as [], not null: %s", body)
	}
}

func TestGetGraph_WarnsWhenAnXRKindCannotBeListed(t *testing.T) {
	svc := &fakeGraphService{t: t, xrCalls: map[string]string{}, failKind: "AuthProxy"}
	g, err := GetGraph(svc, "ctx", GraphOptions{})
	if err != nil {
		t.Fatalf("a failing XR kind must not fail the whole graph: %v", err)
	}
	if got := warningCodes(g); len(got) != 1 || got[0] != GraphWarningKindUnavailable {
		t.Fatalf("expected one %s warning, got %v", GraphWarningKindUnavailable, g.Warnings)
	}
	if !strings.Contains(g.Warnings[0].Message, "AuthProxy") {
		t.Errorf("the warning should name the kind, got %q", g.Warnings[0].Message)
	}
	if _, ok := findNode(g, xrID("BudgetApp", "media", "budgetapp")); !ok {
		t.Error("the other kinds must still be in the graph")
	}
}

func TestGetGraph_WarnsWhenManagedListFails(t *testing.T) {
	svc := &fakeGraphService{t: t, xrCalls: map[string]string{}, managedErr: errors.New("forbidden")}
	g, err := GetGraph(svc, "ctx", GraphOptions{})
	if err != nil {
		t.Fatalf("a failing managed list must not fail the graph: %v", err)
	}
	if got := warningCodes(g); len(got) != 1 || got[0] != GraphWarningManagedFailed {
		t.Fatalf("expected one %s warning, got %v", GraphWarningManagedFailed, g.Warnings)
	}
	if !strings.Contains(g.Warnings[0].Message, "forbidden") {
		t.Errorf("the warning should carry the reason, got %q", g.Warnings[0].Message)
	}
}

func TestGetGraph_WarnsWhenManagedHealthIsCached(t *testing.T) {
	svc := &fakeGraphService{t: t, xrCalls: map[string]string{}, managedFromCache: true}
	g, _ := GetGraph(svc, "ctx", GraphOptions{})
	if got := warningCodes(g); len(got) != 1 || got[0] != GraphWarningManagedCached {
		t.Errorf("expected one %s warning, got %v", GraphWarningManagedCached, g.Warnings)
	}
}

func TestGetGraph_WarnsWhenAManagedKindHitsTheCap(t *testing.T) {
	svc := &fakeGraphService{t: t, xrCalls: map[string]string{}, managedFiller: int(lib.DefaultManagedMaxItemsPerType)}
	g, _ := GetGraph(svc, "ctx", GraphOptions{})
	if got := warningCodes(g); len(got) != 1 || got[0] != GraphWarningManagedCapped {
		t.Fatalf("expected one %s warning, got %v", GraphWarningManagedCapped, g.Warnings)
	}
	if !strings.Contains(g.Warnings[0].Message, "Filler") {
		t.Errorf("the warning should name the capped kind, got %q", g.Warnings[0].Message)
	}
}

func TestGetGraph_CapWarningUsesTheConfiguredCap(t *testing.T) {
	svc := &fakeGraphService{t: t, xrCalls: map[string]string{}, managedCap: 7, managedFiller: 7}
	g, _ := GetGraph(svc, "ctx", GraphOptions{})
	if got := warningCodes(g); len(got) != 1 || got[0] != GraphWarningManagedCapped {
		t.Fatalf("expected one %s warning, got %v", GraphWarningManagedCapped, g.Warnings)
	}
	if !strings.Contains(g.Warnings[0].Message, "7 item limit") {
		t.Errorf("the warning should state the configured cap, got %q", g.Warnings[0].Message)
	}
}

func TestGetGraph_WarningsAreSorted(t *testing.T) {
	svc := &fakeGraphService{t: t, xrCalls: map[string]string{}, failKind: "AuthProxy", managedFromCache: true}
	g, _ := GetGraph(svc, "ctx", GraphOptions{})
	codes := warningCodes(g)
	if !sort.StringsAreSorted(codes) || len(codes) != 2 {
		t.Errorf("expected two warnings in code order, got %v", codes)
	}
}

func TestGetGraph_SkipManagedDoesNotListThem(t *testing.T) {
	svc := &fakeGraphService{t: t, xrCalls: map[string]string{}, managedErr: fmt.Errorf("must not be called")}
	g, err := GetGraph(svc, "ctx", GraphOptions{SkipManaged: true})
	if err != nil {
		t.Fatalf("GetGraph: %v", err)
	}
	if codes := warningCodes(g); len(codes) != 1 || codes[0] != GraphWarningManagedSkipped {
		t.Errorf("expected only the skipped warning, got %v", codes)
	}
}

// slowKindService counts how many XR kind lists run at once.
type slowKindService struct {
	KubernetesServiceInterface
	xrds           []map[string]interface{}
	inFlight, peak atomic.Int32
}

func (s *slowKindService) GetResources(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
	if kind == "CompositeResourceDefinition" {
		return listResult(s.xrds), nil
	}
	if kind == "Composition" || kind == "Function" {
		return listResult(nil), nil
	}
	now := s.inFlight.Add(1)
	defer s.inFlight.Add(-1)
	for peak := s.peak.Load(); now > peak && !s.peak.CompareAndSwap(peak, now); peak = s.peak.Load() {
	}
	time.Sleep(5 * time.Millisecond)
	return listResult(nil), nil
}

func (s *slowKindService) ManagedMaxItemsPerType() int64 { return lib.DefaultManagedMaxItemsPerType }

func (s *slowKindService) GetManagedResources(contextName string, forceRefresh bool) (map[string]interface{}, error) {
	return listResult(nil), nil
}

func TestGetGraph_LimitsConcurrentKindLists(t *testing.T) {
	svc := &slowKindService{}
	for i := 0; i < 4*graphListConcurrency; i++ {
		svc.xrds = append(svc.xrds, map[string]interface{}{
			"spec": map[string]interface{}{
				"group":    "load.example.org",
				"names":    map[string]interface{}{"kind": fmt.Sprintf("Kind%d", i), "plural": fmt.Sprintf("kind%ds", i)},
				"versions": []interface{}{map[string]interface{}{"name": "v1", "served": true, "referenceable": true}},
			},
		})
	}
	if _, err := GetGraph(svc, "ctx", GraphOptions{}); err != nil {
		t.Fatalf("GetGraph: %v", err)
	}
	if peak := svc.peak.Load(); peak < 2 || peak > graphListConcurrency {
		t.Errorf("expected between 2 and %d lists at once, got %d", graphListConcurrency, peak)
	}
}
