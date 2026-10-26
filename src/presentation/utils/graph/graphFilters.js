import { NODE_TYPE, EDGE_TYPE, getNodeGroup, getKindKey, isHealthy, isUnhealthy } from './graphModel.js';
import { getLineage, indexGraph } from './graphLineage.js';

const isInstance = (node) => node.type === NODE_TYPE.XR || node.type === NODE_TYPE.COMPOSED;

// Keeps the nodes the predicate accepts and the edges whose ends both survive.
export const keepOnly = ({ nodes, edges }, keep) => {
  const kept = nodes.filter(keep);
  const ids = new Set(kept.map((n) => n.id));
  return { nodes: kept, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
};

// Focus keeps only the focused node's lineage, the same chain that selecting it highlights.
const focusOnLineage = (view, focusId) => {
  if (!focusId || !view.nodes.some((n) => n.id === focusId)) return view;
  const lineage = getLineage(indexGraph(view.nodes, view.edges), focusId);
  return keepOnly(view, (n) => lineage.has(n.id));
};

const HEALTH_MATCHERS = { healthy: isHealthy, unhealthy: isUnhealthy };

const createAttributeMatcher = ({ namespace, kind, search, health }) => {
  const needle = search.toLowerCase();
  const matchesSearch = (n) => [n.name, n.kind, n.namespace].some((v) => (v || '').toLowerCase().includes(needle));
  return (node) =>
    (!namespace || !node.namespace || node.namespace === namespace) &&
    (!kind || getKindKey(node) === kind) &&
    (!search || matchesSearch(node)) &&
    (!health || node.type === NODE_TYPE.COMPOSITION || HEALTH_MATCHERS[health](node));
};

// A Composition has no health of its own, so after a health filter it stays only if it still leads to an XR.
const dropCompositionsWithoutXR = (view, focusId) => {
  const xrs = new Set(view.nodes.filter((n) => n.type === NODE_TYPE.XR).map((n) => n.id));
  const leadsToXR = (id) => view.edges.some((e) => e.source === id && xrs.has(e.target));
  return keepOnly(view, (n) => n.type !== NODE_TYPE.COMPOSITION || n.id === focusId || leadsToXR(n.id));
};

// With a namespace picked, XRDs, Compositions and Functions stay only if they lead to an instance in view.
const keepDefinitionsLeadingToInstances = (view) => {
  const { nodes, edges } = view;
  const typeOf = new Map(nodes.map((n) => [n.id, n.type]));
  const kept = new Set(nodes.filter(isInstance).map((n) => n.id));
  const keepNodesOfType = (type, isLinkedToKept) => {
    nodes
      .filter((n) => n.type === type && edges.some((e) => isLinkedToKept(n.id, e)))
      .forEach((n) => kept.add(n.id));
  };
  const pointsAtKeptXR = (id, e) => e.source === id && kept.has(e.target) && typeOf.get(e.target) === NODE_TYPE.XR;

  keepNodesOfType(NODE_TYPE.XRD, pointsAtKeptXR);
  keepNodesOfType(NODE_TYPE.COMPOSITION, pointsAtKeptXR);
  keepNodesOfType(NODE_TYPE.FUNCTION, (id, e) => e.target === id && kept.has(e.source));
  return keepOnly(view, (n) => kept.has(n.id));
};

// XRD to XR is implied by XRD to Composition to XR, so it only shows for an XR with no Composition.
const hideImpliedXRDEdges = (edges) => {
  const withComposition = new Set(edges.filter((e) => e.type === EDGE_TYPE.COMPOSITION_XR).map((e) => e.target));
  return edges.filter((e) => !(e.type === EDGE_TYPE.XRD_XR && withComposition.has(e.target)));
};

export const applyGraphFilters = (graph, filters) => {
  const shownTypes = new Set(filters.types);
  const matches = createAttributeMatcher(filters);

  let view = keepOnly(graph, (n) => shownTypes.has(n.type));
  view = focusOnLineage(view, filters.focus);
  view = keepOnly(view, (n) => n.id === filters.focus || matches(n));
  if (filters.health) view = dropCompositionsWithoutXR(view, filters.focus);
  if (filters.namespace) view = keepDefinitionsLeadingToInstances(view);
  return { nodes: view.nodes, edges: hideImpliedXRDEdges(view.edges) };
};

// One option per kind in the graph, so the filter is a pick list and not a guess.
export const getKindOptions = (nodes) => {
  const labels = new Map(nodes.map((n) => [getKindKey(n), `${n.kind} (${getNodeGroup(n) || 'core'})`]));
  return [...labels.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
};
