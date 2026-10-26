// The class names here are set in GraphNode.jsx and GraphEdge.jsx.

// Fading goes through one class on the canvas so thousands of nodes and edges change at once.
// Edges skip transitions and fade by stroke-opacity, since thousands of them cost about a second.
export const GRAPH_CANVAS_CSS = {
  '& .graph-node': { transition: 'opacity 0.15s' },
  '& .graph-edge-path': { strokeWidth: '1.25px', strokeOpacity: 0.5 },
  // Many Compositions share a few Functions, so these would pile into one heavy band.
  '& .graph-edge-path.graph-edge-quiet': { strokeOpacity: 0.2 },
  '& .graph-edge-path.in-lineage': { strokeWidth: '2.5px', strokeOpacity: 1 },
};

// An arrowhead is drawn separately and would not fade with its line, so it is hidden.
export const GRAPH_HIGHLIGHT_CSS = {
  ...GRAPH_CANVAS_CSS,
  '& .graph-node:not(.in-lineage)': { opacity: 0.3 },
  '& .graph-edge-path:not(.in-lineage)': { strokeOpacity: 0.1, markerEnd: 'none' },
};
