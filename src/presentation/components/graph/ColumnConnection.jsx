import PropTypes from 'prop-types';
import { EDGE_STYLES } from './graphEdgeStyles.js';
import { EDGE_TYPE } from '../../utils/graph/graphModel.js';
import { useIsInLineage } from './GraphHighlightContext.js';

export const ColumnConnection = ({ edge, path, markerId }) => {
  const inLineage = useIsInLineage(edge.source, edge.target);
  const { color, dash } = EDGE_STYLES[edge.type];
  return (
    <path d={path} fill="none" stroke={color} strokeDasharray={dash}
      strokeWidth={1.25}
      strokeOpacity={inLineage ? 1 : edge.type === EDGE_TYPE.COMPOSITION_FUNCTION ? 0.2 : 0.5}
      markerEnd={`url(#${markerId})`}
      className={`column-connection${inLineage ? ' in-lineage' : ''}`} />
  );
};

ColumnConnection.propTypes = {
  edge: PropTypes.shape({
    source: PropTypes.string.isRequired, target: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  }).isRequired,
  path: PropTypes.string.isRequired,
  markerId: PropTypes.string.isRequired,
};
