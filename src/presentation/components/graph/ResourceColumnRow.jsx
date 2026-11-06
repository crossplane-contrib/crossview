import { Box, Text, HStack, Badge } from '@chakra-ui/react';
import PropTypes from 'prop-types';
import { getBackgroundColor, getBorderColor, getTextColor } from '../../utils/theme.js';
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

export const ResourceColumnRow = ({ data, onSelect, onHover }) => {
  const { node, colorMode, noComposition, partial } = data;
  const inLineage = useIsInLineage(node.id);
  const selected = useIsSelected(node.id);

  return (
    <Box
      as="button"
      type="button"
      data-resource-id={node.id}
      className={`resource-row${inLineage ? ' in-lineage' : ''}`}
      w="100%"
      textAlign="left"
      cursor="pointer"
      px={3}
      py={3}
      bg={getBackgroundColor(colorMode, selected ? 'tertiary' : 'header')}
      borderBottom="1px solid"
      borderColor={getBorderColor(colorMode)}
      borderLeft="3px solid"
      borderLeftColor={borderColorOf(node)}
      outline={selected ? `2px solid ${borderColorOf(node)}` : undefined}
      outlineOffset="-2px"
      _hover={{ bg: getBackgroundColor(colorMode, 'secondary') }}
      _focusVisible={{ outline: `2px solid ${borderColorOf(node)}`, outlineOffset: '-2px' }}
      aria-pressed={selected}
      onClick={() => onSelect(node)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      title={describeProblem(node) || undefined}
    >
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
    </Box>
  );
};

ResourceColumnRow.propTypes = {
  onSelect: PropTypes.func.isRequired,
  onHover: PropTypes.func.isRequired,
  data: PropTypes.shape({
    node: graphNodeShape.isRequired,
    colorMode: PropTypes.string,
    noComposition: PropTypes.bool,
    partial: PropTypes.shape({ shown: PropTypes.number.isRequired, total: PropTypes.number.isRequired, label: PropTypes.string.isRequired }),
  }).isRequired,
};
