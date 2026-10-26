package services

import (
	"testing"

	"crossview-go-server/lib"
)

// bulkGraphService answers GetGraph's list calls from prebuilt objects.
// Each call returns copies, as a real API does, because GetGraph writes to what it lists.
type bulkGraphService struct {
	KubernetesServiceInterface
	in     GraphInput
	xrKind map[string][]map[string]interface{}
}

func newBulkGraphService(in GraphInput) *bulkGraphService {
	byKind := map[string][]map[string]interface{}{}
	for _, xr := range in.XRs {
		kind, _ := xr["kind"].(string)
		byKind[kind] = append(byKind[kind], xr)
	}
	return &bulkGraphService{in: in, xrKind: byKind}
}

func listResult(items []map[string]interface{}) map[string]interface{} {
	raw := make([]interface{}, len(items))
	for i, item := range items {
		cp := make(map[string]interface{}, len(item))
		for k, v := range item {
			cp[k] = v
		}
		raw[i] = cp
	}
	return map[string]interface{}{"items": raw}
}

func (s *bulkGraphService) GetResources(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
	switch kind {
	case "CompositeResourceDefinition":
		return listResult(s.in.XRDs), nil
	case "Composition":
		return listResult(s.in.Compositions), nil
	case "Function":
		return listResult(s.in.Functions), nil
	}
	return listResult(s.xrKind[kind]), nil
}

func (s *bulkGraphService) ManagedMaxItemsPerType() int64 { return lib.DefaultManagedMaxItemsPerType }

func (s *bulkGraphService) GetManagedResources(contextName string, forceRefresh bool) (map[string]interface{}, error) {
	return listResult(s.in.Managed), nil
}

// Measures GetGraph end to end against an in-memory API, so only our own work is timed.
func BenchmarkGetGraph(b *testing.B) {
	for _, s := range benchScales {
		svc := newBulkGraphService(syntheticGraphInput(s))
		b.Run(s.name, func(b *testing.B) {
			b.ReportAllocs()
			var g Graph
			for i := 0; i < b.N; i++ {
				var err error
				if g, err = GetGraph(svc, "ctx", GraphOptions{}); err != nil {
					b.Fatal(err)
				}
			}
			if len(g.Nodes) < s.minNodes {
				b.Fatalf("GetGraph built %d nodes, expected at least %d", len(g.Nodes), s.minNodes)
			}
			b.ReportMetric(float64(len(g.Nodes)), "nodes")
		})
	}
}
