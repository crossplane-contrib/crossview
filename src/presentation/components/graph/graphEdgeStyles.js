import { colors } from '../../utils/theme.js';
import { NODE_TYPE, EDGE_TYPE } from '../../utils/graph/graphModel.js';

// Type colours come from the Crossview theme, which follows the Crossplane brand palette.
export const NODE_TYPE_COLORS = {
  [NODE_TYPE.XRD]: colors.accent.purple.medium,
  [NODE_TYPE.COMPOSITION]: colors.accent.blue.primary,
  [NODE_TYPE.XR]: colors.status.green,
  [NODE_TYPE.FUNCTION]: colors.accent.yellow.primary,
  [NODE_TYPE.COMPOSED]: colors.accent.cyan.primary,
};

// An edge takes the colour of the node type it points to.
export const EDGE_STYLES = {
  [EDGE_TYPE.XRD_COMPOSITION]: { color: NODE_TYPE_COLORS[NODE_TYPE.COMPOSITION] },
  [EDGE_TYPE.XRD_XR]: { color: NODE_TYPE_COLORS[NODE_TYPE.XR], dash: '2 4' },
  [EDGE_TYPE.COMPOSITION_XR]: { color: NODE_TYPE_COLORS[NODE_TYPE.XR] },
  [EDGE_TYPE.COMPOSITION_FUNCTION]: { color: NODE_TYPE_COLORS[NODE_TYPE.FUNCTION] },
  [EDGE_TYPE.XR_XR]: { color: NODE_TYPE_COLORS[NODE_TYPE.XR] },
  [EDGE_TYPE.XR_COMPOSED]: { color: NODE_TYPE_COLORS[NODE_TYPE.COMPOSED] },
};
