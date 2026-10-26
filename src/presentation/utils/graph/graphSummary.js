import { NODE_TYPES, NODE_TYPE, EDGE_TYPE, isUnhealthy } from './graphModel.js';

// One pass over the whole graph. It answers the questions the page asks again and again: how big
// each part is, where things are unhealthy, and which instances belong to which definition.
export const summarizeGraph = (graph) => {
  const byType = Object.fromEntries(NODE_TYPES.map((type) => [type, { count: 0, unhealthy: 0 }]));
  const namespaces = new Map();
  let unresolved = 0;

  graph.nodes.forEach((node) => {
    const stats = byType[node.type];
    stats.count += 1;
    if (isUnhealthy(node)) stats.unhealthy += 1;
    if (node.unresolved) unresolved += 1;
    if (node.namespace) {
      const ns = namespaces.get(node.namespace) || { name: node.namespace, count: 0 };
      ns.count += 1;
      namespaces.set(node.namespace, ns);
    }
  });

  const compositionOf = new Map(); // XR ID to the Composition ID it uses
  const composedParents = new Map(); // composed resource ID to the XR IDs that compose it
  const composedChildren = new Map(); // XR ID to the composed resource IDs it composes
  graph.edges.forEach(({ source, target, type }) => {
    if (type === EDGE_TYPE.COMPOSITION_XR) compositionOf.set(target, source);
    if (type === EDGE_TYPE.XR_COMPOSED) {
      composedParents.set(target, [...(composedParents.get(target) || []), source]);
      composedChildren.set(source, [...(composedChildren.get(source) || []), target]);
    }
  });

  return {
    total: graph.nodes.length,
    byType,
    unhealthyTotal: NODE_TYPES.reduce((sum, type) => sum + byType[type].unhealthy, 0),
    unresolved,
    namespaces: [...namespaces.values()].sort((a, b) => a.name.localeCompare(b.name)),
    compositionOf,
    composedParents,
    composedChildren,
    xrdByDefines: new Map(graph.nodes.filter((n) => n.type === NODE_TYPE.XRD && n.defines).map((n) => [n.defines, n.id])),
    // XRs with no Composition edge: just created, or Crossplane could not select one.
    withoutComposition: new Set(
      graph.nodes.filter((n) => n.type === NODE_TYPE.XR && !n.unresolved && !compositionOf.has(n.id)).map((n) => n.id)
    ),
  };
};
