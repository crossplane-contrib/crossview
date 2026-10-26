import { NODE_TYPE, EDGE_TYPE } from './graphModel.js';

const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 96;

export const MIN_ZOOM = 0.05;

// The smallest zoom where a node's text can still be read. The first view never goes below it.
export const READABLE_ZOOM = 0.5;

// Left to right: XRDs, Compositions, then Functions and XRs (each one step from a Composition).
const XRD_COLUMN = 0;
const COMPOSITION_COLUMN = 1;
const FUNCTION_AND_TOP_XR_COLUMN = 2;

// An XR's depth is its longest chain of parent XRs. The pass count is capped so a cycle ends.
const getNestingDepths = (nodes, edges) => {
  const xrIds = nodes.filter((n) => n.type === NODE_TYPE.XR).map((n) => n.id);
  const depth = new Map(xrIds.map((id) => [id, 0]));
  const nestingEdges = edges.filter((e) => e.type === EDGE_TYPE.XR_XR);

  for (let pass = 0; pass < xrIds.length; pass += 1) {
    let changed = false;
    nestingEdges.forEach(({ source, target }) => {
      const deeper = depth.get(source) + 1;
      if (deeper > depth.get(target) && deeper <= xrIds.length) {
        depth.set(target, deeper);
        changed = true;
      }
    });
    if (!changed) break;
  }
  return depth;
};

const createColumnPicker = (nodes, edges) => {
  const depths = getNestingDepths(nodes, edges);
  const composedColumn = FUNCTION_AND_TOP_XR_COLUMN + 1 + Math.max(0, ...depths.values());

  return (node) => {
    switch (node.type) {
      case NODE_TYPE.XRD: return XRD_COLUMN;
      case NODE_TYPE.COMPOSITION: return COMPOSITION_COLUMN;
      case NODE_TYPE.FUNCTION: return FUNCTION_AND_TOP_XR_COLUMN;
      case NODE_TYPE.XR: return FUNCTION_AND_TOP_XR_COLUMN + (depths.get(node.id) || 0);
      default: return composedColumn;
    }
  };
};

// Functions first, then by namespace, kind and name.
const compareNodes = (a, b) =>
  (a.type === NODE_TYPE.FUNCTION ? 0 : 1) - (b.type === NODE_TYPE.FUNCTION ? 0 : 1) ||
  (a.namespace || '').localeCompare(b.namespace || '') ||
  a.kind.localeCompare(b.kind) ||
  a.name.localeCompare(b.name);

// Composed resources follow the order of the XR that composes them, so a chain reads top to bottom.
const orderComposed = (composed, edges, positions) => {
  const parentY = new Map();
  edges.filter((e) => e.type === EDGE_TYPE.XR_COMPOSED).forEach(({ source, target }) => {
    const y = positions.get(source)?.y;
    if (y !== undefined && !(parentY.get(target) <= y)) parentY.set(target, y);
  });
  const yOf = (node) => (parentY.has(node.id) ? parentY.get(node.id) : Infinity);
  return [...composed].sort((a, b) => yOf(a) - yOf(b) || compareNodes(a, b));
};

// Returns each node's position by ID. Empty columns are dropped, so hiding a type leaves no gap.
export const layoutGraph = (nodes, edges) => {
  const columnOf = createColumnPicker(nodes, edges);
  const usedColumns = [...new Set(nodes.map(columnOf))].sort((a, b) => a - b);
  const slotOf = new Map(usedColumns.map((column, slot) => [column, slot]));

  const nextRow = new Map();
  const positions = new Map();
  const place = (node) => {
    const slot = slotOf.get(columnOf(node));
    const row = nextRow.get(slot) || 0;
    nextRow.set(slot, row + 1);
    positions.set(node.id, { x: slot * COLUMN_WIDTH, y: row * ROW_HEIGHT });
  };

  const isComposed = (node) => node.type === NODE_TYPE.COMPOSED;
  [...nodes].filter((n) => !isComposed(n)).sort(compareNodes).forEach(place);
  orderComposed(nodes.filter(isComposed), edges, positions).forEach(place);
  return positions;
};
