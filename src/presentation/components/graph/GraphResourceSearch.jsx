import { Box, Button, Text, VStack } from '@chakra-ui/react';
import { useDeferredValue, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Input } from '../common/Input.jsx';
import { graphNodeShape } from './graphPropTypes.js';
import { NODE_TYPE_LABELS, nodeLabel } from '../../utils/graph/graphModel.js';
import { getBackgroundColor, getBorderColor, getTextColor } from '../../utils/theme.js';

const RESULT_LIMIT = 20;

export const GraphResourceSearch = ({ nodes, loading, colorMode, query, onQueryChange, onFocusResource }) => {
  const [open, setOpen] = useState(false);
  const needle = useDeferredValue(query.trim().toLowerCase());
  const results = useMemo(() => {
    if (!needle) return { items: [], total: 0 };
    const items = [];
    let total = 0;
    for (const node of nodes) {
      if (![node.name, node.kind, node.namespace, node.apiVersion].some(value => value?.toLowerCase().includes(needle))) continue;
      total++;
      if (items.length < RESULT_LIMIT) items.push(node);
    }
    return { items, total };
  }, [nodes, needle]);
  const focus = node => {
    setOpen(false);
    onFocusResource(node.id);
  };
  const muted = getTextColor(colorMode, 'secondary');

  return (
    <Box position="relative" w="280px" maxW="100%"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}>
        <Input type="search" aria-label="Find a resource to focus"
          placeholder="Search name, kind, namespace"
          value={query} onFocus={() => setOpen(true)}
          onChange={event => { setOpen(true); onQueryChange(event.target.value); }}
          onKeyDown={event => {
            if (event.key === 'Escape') { setOpen(false); onQueryChange(''); }
            if (event.key === 'Enter' && needle === query.trim().toLowerCase() && results.items.length) {
              event.preventDefault();
              focus(results.items[0]);
            }
          }} />
      {open && query.trim() && <Box position="absolute" top="100%" left={0} mt={2}
        w={{ base: '100%', md: '480px' }} maxW="calc(100vw - 48px)" zIndex={10} p={3}
        bg={getBackgroundColor(colorMode, 'header')} border="1px solid"
        borderColor={getBorderColor(colorMode)} borderRadius="md" boxShadow="md">
        <Text role="status" fontSize="xs" color={muted} mb={2}>
          {loading ? 'Loading resources...' : results.total
            ? `Showing ${results.items.length} of ${results.total} matches across all loaded resources. Select one to focus its path.`
            : 'No matching resources.'}
        </Text>
        <VStack as="ul" m={0} p={0} listStyleType="none" align="stretch" gap={1} maxH="280px" overflowY="auto">
          {results.items.map(node => <Box as="li" key={node.id}>
            <Button variant="ghost" w="100%" h="auto" py={2} justifyContent="start" textAlign="left"
              whiteSpace="normal" onClick={() => focus(node)}>
              <Box minW={0}>
                <Text fontSize="sm" overflowWrap="anywhere">{nodeLabel(node)}</Text>
                <Text fontSize="xs" color={muted}>{NODE_TYPE_LABELS[node.type]} · {node.namespace || 'Cluster-scoped'} · {node.apiVersion}</Text>
              </Box>
            </Button>
          </Box>)}
        </VStack>
      </Box>}
    </Box>
  );
};

GraphResourceSearch.propTypes = {
  nodes: PropTypes.arrayOf(graphNodeShape).isRequired,
  loading: PropTypes.bool.isRequired,
  colorMode: PropTypes.string,
  query: PropTypes.string.isRequired,
  onQueryChange: PropTypes.func.isRequired,
  onFocusResource: PropTypes.func.isRequired,
};
