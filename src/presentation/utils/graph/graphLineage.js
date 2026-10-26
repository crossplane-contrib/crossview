import { NODE_TYPE } from './graphModel.js';

const DEFINITION_TYPES = [NODE_TYPE.XRD, NODE_TYPE.COMPOSITION];

// Built once per visible graph, so hovering only walks it instead of rebuilding it.
export const indexGraph = (nodes, edges) => {
  const typeOf = new Map(nodes.map((n) => [n.id, n.type]));
  const down = new Map(); // node ID to the IDs it points at
  const up = new Map(); // node ID to the IDs that point at it
  const add = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  edges.forEach(({ source, target }) => {
    add(down, source, target);
    add(up, target, source);
  });
  return { typeOf, down, up };
};

// Breadth-first: every node reachable from start by following the adjacency map.
const reachable = (start, adjacency) => {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    (adjacency.get(queue.pop()) || []).forEach((next) => {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    });
  }
  return seen;
};

const isType = (index, id, type) => index.typeOf.get(id) === type;
const neighborsOfType = (adjacency, id, types, index) =>
  (adjacency.get(id) || []).filter((n) => types.includes(index.typeOf.get(n)));

// An XR also brings in the XRDs and Compositions behind each XR it created, and their Functions.
const addDefinitionsBehind = (index, lineage, xrIds) => {
  xrIds.forEach((xrId) => {
    neighborsOfType(index.up, xrId, DEFINITION_TYPES, index).forEach((definition) => {
      lineage.add(definition);
      neighborsOfType(index.down, definition, [NODE_TYPE.FUNCTION], index).forEach((fn) => lineage.add(fn));
    });
  });
};

// A definition shows the XRs that compose its instances, but not their own definitions.
const addXRsComposing = (index, lineage, xrIds) => {
  const queue = [...xrIds];
  while (queue.length > 0) {
    neighborsOfType(index.up, queue.pop(), [NODE_TYPE.XR], index)
      .filter((parent) => !lineage.has(parent))
      .forEach((parent) => {
        lineage.add(parent);
        queue.push(parent);
      });
  }
};

// Everything a node depends on plus everything built from it, however many steps away.
export const getLineage = (index, id) => {
  const descendants = reachable(id, index.down);
  const lineage = new Set([...descendants, ...reachable(id, index.up)]);
  const descendantXRs = [...descendants].filter((n) => isType(index, n, NODE_TYPE.XR));

  if (isType(index, id, NODE_TYPE.XR)) addDefinitionsBehind(index, lineage, descendantXRs);
  else addXRsComposing(index, lineage, descendantXRs);
  return lineage;
};

// A selection wins over hover so the highlight does not change while the pointer moves. A selected
// node that is not on screen, because a limit hid it, highlights nothing instead of fading everything.
export const pickHighlightId = (index, selectedId, hoveredId) =>
  (selectedId && index.typeOf.has(selectedId) ? selectedId : null) || hoveredId || null;
