import { Box, HStack, Text } from '@chakra-ui/react';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ResourceColumnRow } from './ResourceColumnRow.jsx';
import { graphNodeShape } from './graphPropTypes.js';
import { NODE_TYPE, NODE_TYPES, NODE_TYPE_LABELS, formatCount } from '../../utils/graph/graphModel.js';
import { EDGE_STYLES, NODE_TYPE_COLORS } from './graphEdgeStyles.js';
import { ColumnConnection } from './ColumnConnection.jsx';
import { columnConnectionPath } from '../../utils/graph/columnConnections.js';
import { getBackgroundColor, getBorderColor, getTextColor } from '../../utils/theme.js';

const COLUMN_GROUPS = [
  [NODE_TYPE.XRD],
  [NODE_TYPE.COMPOSITION],
  [NODE_TYPE.FUNCTION, NODE_TYPE.XR],
  [NODE_TYPE.COMPOSED],
];

export const ResourceColumns = ({ nodes, edges, types, colorMode, withoutComposition, partialCounts, onSelect, onHover }) => {
  const visibleColumns = COLUMN_GROUPS.map(group => group.filter(type => types.includes(type)))
    .filter(group => group.length > 0);
  const gridRef = useRef(null);
  const markerPrefix = useId().replace(/:/g, '');
  const [geometry, setGeometry] = useState({ width: 0, height: 0, rows: new Map() });
  const columns = useMemo(() => {
    const grouped = new Map(NODE_TYPES.map(type => [type, []]));
    nodes.forEach(node => grouped.get(node.type).push(node));
    return grouped;
  }, [nodes]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    let frame;
    const measure = () => {
      const bounds = grid.getBoundingClientRect();
      const rows = new Map();
      grid.querySelectorAll('[data-resource-id]').forEach(row => {
        const rect = row.getBoundingClientRect();
        rows.set(row.dataset.resourceId, {
          x: rect.left - bounds.left, y: rect.top - bounds.top,
          width: rect.width, height: rect.height,
          column: Number(row.closest('[data-resource-column]').dataset.resourceColumn),
        });
      });
      setGeometry({ width: bounds.width, height: bounds.height, rows });
    };
    measure();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    observer.observe(grid);
    grid.querySelectorAll('[data-resource-id]').forEach(row => observer.observe(row));
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [nodes, types, partialCounts]);

  return (
    <Box overflowX="auto" p={3} flex={1} display="flex" flexDirection="column">
      <Box ref={gridRef} position="relative" display="grid" minW="max-content" width="100%" py={16} px={8}
        gridTemplateColumns={`repeat(${visibleColumns.length}, minmax(260px, 1fr))`} gap={24} flex={1} alignItems="start">
        {visibleColumns.map((group, column) => (
          <Box key={group.join('-')} data-resource-column={column} display="flex" flexDirection="column" gap={12} minW={0}>
            {group.map(type => (
              <Box as="section" key={type} aria-label={NODE_TYPE_LABELS[type]} minW={0}
                bg={getBackgroundColor(colorMode, 'header')} border="1px solid"
                borderColor={getBorderColor(colorMode)} borderRadius="lg" overflow="hidden">
                <HStack px={3} py={3} justify="space-between" borderBottom="1px solid" borderColor={getBorderColor(colorMode)}>
                  <HStack gap={2}>
                    <Box w={1} h={4} borderRadius="full" bg={NODE_TYPE_COLORS[type]} />
                    <Text as="h2" fontSize="sm" fontWeight="semibold">{NODE_TYPE_LABELS[type]}</Text>
                  </HStack>
                  <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')}>{formatCount(columns.get(type).length)}</Text>
                </HStack>
                <Box as="ul" listStyleType="none" m={0} p={0}>
                  {columns.get(type).map(node => (
                    <Box as="li" key={node.id}>
                      <ResourceColumnRow data={{ node, colorMode, noComposition: withoutComposition.has(node.id), partial: partialCounts.get(node.id) }}
                        onSelect={onSelect} onHover={onHover} />
                    </Box>
                  ))}
                </Box>
                {columns.get(type).length === 0 && <Text p={4} fontSize="sm" color={getTextColor(colorMode, 'secondary')}>No matching resources.</Text>}
              </Box>
            ))}
          </Box>
        ))}
        <svg aria-hidden="true" width={geometry.width} height={geometry.height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          <defs>
            {Object.entries(EDGE_STYLES).map(([type, { color }]) => (
              <marker key={type} id={`${markerPrefix}-${type}`} viewBox="0 0 10 10"
                refX="5" refY="5" markerWidth="6" markerHeight="6">
                <circle cx="5" cy="5" r="4" fill={color} />
              </marker>
            ))}
          </defs>
          {edges.map(edge => {
            const source = geometry.rows.get(edge.source);
            const target = geometry.rows.get(edge.target);
            if (!source || !target) return null;
            return <ColumnConnection key={`${edge.source}->${edge.target}:${edge.type}`}
              edge={edge} path={columnConnectionPath(source, target)} markerId={`${markerPrefix}-${edge.type}`} />;
          })}
        </svg>
      </Box>
    </Box>
  );
};

ResourceColumns.propTypes = {
  nodes: PropTypes.arrayOf(graphNodeShape).isRequired,
  edges: PropTypes.arrayOf(PropTypes.shape({
    source: PropTypes.string.isRequired, target: PropTypes.string.isRequired,
    type: PropTypes.string.isRequired,
  })).isRequired,
  types: PropTypes.arrayOf(PropTypes.string).isRequired,
  colorMode: PropTypes.string,
  withoutComposition: PropTypes.instanceOf(Set).isRequired,
  partialCounts: PropTypes.instanceOf(Map).isRequired,
  onSelect: PropTypes.func.isRequired,
  onHover: PropTypes.func.isRequired,
};
