import { useEffect } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, useReactFlow, useStore } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import PropTypes from 'prop-types';
import { colors } from '../../utils/theme.js';
import { GraphNode } from './GraphNode.jsx';
import { GraphEdge } from './GraphEdge.jsx';
import { MIN_ZOOM, READABLE_ZOOM } from '../../utils/graph/graphLayout.js';

const nodeTypes = { graphNode: GraphNode };
const edgeTypes = { graphEdge: GraphEdge };

const FIT_DELAY_MS = 50;
const FIT_PADDING = 24;

// Re-fits the view whenever fitKey changes, which is when the visible set does. If the graph is
// too tall to read in full, it shows the top at a readable size and leaves the rest to dragging.
const FitOnChange = ({ fitKey }) => {
  const { fitView, setViewport, getNodes, getNodesBounds } = useReactFlow();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  useEffect(() => {
    const timer = setTimeout(() => {
      const bounds = getNodesBounds(getNodes());
      const fitZoom = Math.min((width - 2 * FIT_PADDING) / bounds.width, (height - 2 * FIT_PADDING) / bounds.height);
      if (fitZoom >= READABLE_ZOOM) {
        fitView({ duration: 200, maxZoom: 1 });
        return;
      }
      const spareWidth = Math.max(0, width - 2 * FIT_PADDING - bounds.width * READABLE_ZOOM);
      setViewport(
        { x: FIT_PADDING + spareWidth / 2 - bounds.x * READABLE_ZOOM, y: FIT_PADDING - bounds.y * READABLE_ZOOM, zoom: READABLE_ZOOM },
        { duration: 200 }
      );
    }, FIT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [fitKey, width, height, fitView, setViewport, getNodes, getNodesBounds]);

  return null;
};

FitOnChange.propTypes = { fitKey: PropTypes.string.isRequired };

export const GraphCanvas = ({ nodes, edges, colorMode, fitKey, onNodeClick, onNodeHover }) => (
  <ReactFlowProvider>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onNodeMouseEnter={(_, node) => onNodeHover(node.id)}
      onNodeMouseLeave={() => onNodeHover(null)}
      nodesDraggable={false}
      nodesConnectable={false}
      onlyRenderVisibleElements
      minZoom={MIN_ZOOM}
      fitView
      colorMode={colorMode}
      // Plain scrolling moves the page; zoom needs Ctrl or Cmd, a pinch, or the controls.
      zoomOnScroll={false}
      preventScrolling={false}
      zoomActivationKeyCode={['Meta', 'Control']}
    >
      <FitOnChange fitKey={fitKey} />
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} color={colorMode === 'dark' ? colors.border.dark.gray : colors.border.light.gray} />
      <Controls showInteractive={false} />
    </ReactFlow>
  </ReactFlowProvider>
);

GraphCanvas.propTypes = {
  nodes: PropTypes.arrayOf(PropTypes.object).isRequired,
  edges: PropTypes.arrayOf(PropTypes.object).isRequired,
  colorMode: PropTypes.string,
  fitKey: PropTypes.string.isRequired,
  onNodeClick: PropTypes.func.isRequired,
  onNodeHover: PropTypes.func.isRequired,
};
