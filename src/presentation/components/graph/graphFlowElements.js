import { MarkerType } from '@xyflow/react';
import { EDGE_STYLES } from './graphEdgeStyles.js';

// These depend only on what is visible, never on the highlight, so hovering does not rebuild them.
export const buildFlowNodes = ({ nodes, positions, colorMode, withoutComposition, partialCounts }) =>
  nodes.map((node) => ({
    id: node.id,
    type: 'graphNode',
    position: positions.get(node.id),
    data: { node, colorMode, noComposition: withoutComposition.has(node.id), partial: partialCounts.get(node.id) || null },
  }));

export const buildFlowEdges = (edges) =>
  edges.map((edge) => ({
    id: `${edge.source}->${edge.target}:${edge.type}`,
    source: edge.source,
    target: edge.target,
    type: 'graphEdge',
    markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_STYLES[edge.type].color },
    data: { edgeType: edge.type },
  }));
