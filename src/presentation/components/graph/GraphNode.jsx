import { Box, Text, HStack, Badge } from '@chakra-ui/react';
import { Handle, Position } from '@xyflow/react';
import PropTypes from 'prop-types';
import { getBackgroundColor, getTextColor } from '../../utils/theme.js';
import { getHealthColor } from '../common/ResourceRelations/utils.js';
import { NODE_TYPE_COLORS } from './graphEdgeStyles.js';
import { graphNodeShape } from './graphPropTypes.js';
import { formatCount, noun, kindTitle, isUnhealthy } from '../../utils/graph/graphModel.js';
import { useIsInLineage, useIsSelected } from './GraphHighlightContext.js';

const UNRESOLVED_COLOR = getHealthColor('warning');

// Empty when the node is healthy.
const describeProblem = (node) =>
  [
    node.ready === 'False' && 'Failed: Ready is False',
    node.synced === 'False' && 'Failed: Synced is False',
    node.ready === 'Unknown' && 'Unknown: Ready is Unknown',
  ]
    .filter(Boolean)
    .join(' · ');

// A failed node gets a red border and an unknown one an orange border; otherwise the border is the node type's colour.
const borderColorOf = (node) => {
  if (isUnhealthy(node)) return getHealthColor('unhealthy');
  if (node.ready === 'Unknown' || node.unresolved) return UNRESOLVED_COLOR;
  return NODE_TYPE_COLORS[node.type];
};

const UnknownStatusBadge = () => (
  <Badge fontSize="2xs" colorPalette="orange" variant="subtle" textTransform="none" title="Something references this resource, but Crossview has no status for it. It may be missing or not managed by Crossplane.">
    Unknown
  </Badge>
);

const NoCompositionBadge = () => (
  <Badge
    fontSize="2xs"
    colorPalette="red"
    variant="solid"
    textTransform="none"
    title="Crossplane has not selected a Composition for this resource. Check its Synced condition."
  >
    No Composition
  </Badge>
);

export const GraphNode = ({ data }) => {
  const { node, colorMode, noComposition, partial } = data;
  const inLineage = useIsInLineage(node.id);
  const selected = useIsSelected(node.id);

  return (
    <Box
      className={`graph-node${inLineage ? ' in-lineage' : ''}`}
      w="240px"
      px={3}
      py={2}
      borderRadius="md"
      bg={getBackgroundColor(colorMode, 'primary')}
      border={selected ? '3px solid' : '2px solid'}
      borderColor={borderColorOf(node)}
      title={describeProblem(node) || undefined}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <HStack justify="space-between" gap={2}>
        <Text fontSize="xs" color={getTextColor(colorMode, 'muted')} truncate minW={0} title={node.wraps ? `${node.kind} wrapping a ${node.wraps}` : node.apiVersion}>
          {kindTitle(node)}
        </Text>
        {noComposition && <NoCompositionBadge />}
        {node.unresolved && <UnknownStatusBadge />}
        {node.namespace && (
          <Badge fontSize="2xs" colorPalette="blue" variant="outline" borderWidth="1px" opacity={0.7} textTransform="none" maxW="110px" truncate>
            {node.namespace}
          </Badge>
        )}
      </HStack>
      <Text fontSize="sm" fontWeight="bold" color={getTextColor(colorMode, 'primary')} truncate title={node.name}>
        {node.name}
      </Text>
      {partial && (
        <Text fontSize="xs" color={getTextColor(colorMode, 'muted')} truncate>
          {formatCount(partial.shown)} of {formatCount(partial.total)} {noun(partial.total, partial.label)}
        </Text>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </Box>
  );
};

GraphNode.propTypes = {
  data: PropTypes.shape({
    node: graphNodeShape.isRequired,
    colorMode: PropTypes.string,
    noComposition: PropTypes.bool,
    partial: PropTypes.shape({ shown: PropTypes.number.isRequired, total: PropTypes.number.isRequired, label: PropTypes.string.isRequired }),
  }).isRequired,
};
