import { BaseEdge, getBezierPath } from '@xyflow/react';
import PropTypes from 'prop-types';
import { EDGE_STYLES } from './graphEdgeStyles.js';
import { EDGE_TYPE } from '../../utils/graph/graphModel.js';
import { useIsInLineage } from './GraphHighlightContext.js';

export const GraphEdge = ({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data }) => {
  const inLineage = useIsInLineage(source, target);
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const { color, dash } = EDGE_STYLES[data.edgeType];

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      className={`graph-edge-path${data.edgeType === EDGE_TYPE.COMPOSITION_FUNCTION ? ' graph-edge-quiet' : ''}${inLineage ? ' in-lineage' : ''}`}
      style={{ stroke: color, strokeDasharray: dash }}
    />
  );
};

GraphEdge.propTypes = {
  id: PropTypes.string.isRequired,
  source: PropTypes.string.isRequired,
  target: PropTypes.string.isRequired,
  sourceX: PropTypes.number.isRequired,
  sourceY: PropTypes.number.isRequired,
  targetX: PropTypes.number.isRequired,
  targetY: PropTypes.number.isRequired,
  sourcePosition: PropTypes.string,
  targetPosition: PropTypes.string,
  markerEnd: PropTypes.string,
  data: PropTypes.shape({ edgeType: PropTypes.string.isRequired }).isRequired,
};
