package services

import (
	"encoding/json"
	"fmt"
	"testing"
)

type benchScale struct {
	name          string
	kinds         int
	xrsPerKind    int
	composedPerXR int
	minNodes      int // a benchmark that builds far fewer nodes is not measuring what it claims
}

// Roughly 1k, 10k and 100k nodes.
var benchScales = []benchScale{
	{"1k", 20, 12, 3, 1000},
	{"10k", 20, 125, 3, 10000},
	{"100k", 20, 1250, 3, 100000},
}

const benchGroup = "bench.example.org"

func benchObject(apiVersion, kind, namespace, name string, conditions ...string) map[string]interface{} {
	meta := map[string]interface{}{"name": name}
	if namespace != "" {
		meta["namespace"] = namespace
	}
	conds := make([]interface{}, 0, len(conditions))
	for _, c := range conditions {
		conds = append(conds, map[string]interface{}{"type": c, "status": "True"})
	}
	return map[string]interface{}{
		"apiVersion": apiVersion, "kind": kind, "metadata": meta,
		"status": map[string]interface{}{"conditions": conds},
	}
}

// syntheticGraphInput builds a cluster with XRs spread over namespaces, each composing a few managed resources.
func syntheticGraphInput(s benchScale) GraphInput {
	var in GraphInput
	for _, fn := range []string{"function-a", "function-b", "function-auto-ready"} {
		in.Functions = append(in.Functions, benchObject("pkg.crossplane.io/v1", "Function", "", fn, "Healthy"))
	}
	for k := 0; k < s.kinds; k++ {
		kind := fmt.Sprintf("Kind%d", k)
		xrd := benchObject("apiextensions.crossplane.io/v1", "CompositeResourceDefinition", "", fmt.Sprintf("kind%ds.%s", k, benchGroup), "Established")
		xrd["spec"] = map[string]interface{}{
			"group": benchGroup,
			"names": map[string]interface{}{"kind": kind, "plural": fmt.Sprintf("kind%ds", k)},
			"versions": []interface{}{
				map[string]interface{}{"name": "v1", "served": true, "referenceable": true},
			},
		}
		in.XRDs = append(in.XRDs, xrd)

		comp := benchObject("apiextensions.crossplane.io/v1", "Composition", "", fmt.Sprintf("comp%d", k))
		comp["spec"] = map[string]interface{}{
			"compositeTypeRef": map[string]interface{}{"apiVersion": benchGroup + "/v1", "kind": kind},
			"pipeline": []interface{}{
				map[string]interface{}{"functionRef": map[string]interface{}{"name": "function-a"}},
				map[string]interface{}{"functionRef": map[string]interface{}{"name": "function-auto-ready"}},
			},
		}
		in.Compositions = append(in.Compositions, comp)

		for x := 0; x < s.xrsPerKind; x++ {
			ns := fmt.Sprintf("ns%d", x%50)
			name := fmt.Sprintf("xr%d-%d", k, x)
			xr := benchObject(benchGroup+"/v1", kind, ns, name, "Ready", "Synced")
			refs := make([]interface{}, 0, s.composedPerXR)
			for c := 0; c < s.composedPerXR; c++ {
				mrName := fmt.Sprintf("%s-mr%d", name, c)
				refs = append(refs, map[string]interface{}{"apiVersion": "kubernetes.crossplane.io/v1alpha2", "kind": "Object", "name": mrName, "namespace": ns})
				in.Managed = append(in.Managed, benchObject("kubernetes.crossplane.io/v1alpha2", "Object", ns, mrName, "Ready", "Synced"))
			}
			xr["spec"] = map[string]interface{}{"crossplane": map[string]interface{}{
				"compositionRef": map[string]interface{}{"name": fmt.Sprintf("comp%d", k)},
				"resourceRefs":   refs,
			}}
			in.XRs = append(in.XRs, xr)
		}
	}
	return in
}

func BenchmarkBuildGraph(b *testing.B) {
	for _, s := range benchScales {
		in := syntheticGraphInput(s)
		b.Run(s.name, func(b *testing.B) {
			b.ReportAllocs()
			var g Graph
			for i := 0; i < b.N; i++ {
				g = BuildGraph(in)
			}
			if len(g.Nodes) < s.minNodes {
				b.Fatalf("built %d nodes, expected at least %d", len(g.Nodes), s.minNodes)
			}
			b.ReportMetric(float64(len(g.Nodes)), "nodes")
			b.ReportMetric(float64(len(g.Edges)), "edges")
		})
	}
}

func BenchmarkMarshalGraph(b *testing.B) {
	for _, s := range benchScales {
		g := BuildGraph(syntheticGraphInput(s))
		b.Run(s.name, func(b *testing.B) {
			b.ReportAllocs()
			var size int
			for i := 0; i < b.N; i++ {
				out, _ := json.Marshal(g)
				size = len(out)
			}
			b.ReportMetric(float64(size)/1024/1024, "MB")
		})
	}
}
