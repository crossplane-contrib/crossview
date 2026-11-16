import { Box, Button, Skeleton, Text, HStack } from '@chakra-ui/react';
import { useDeferredValue, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../providers/AppProvider.jsx';
import { getBackgroundColor, getBorderColor, getStatusColor, getTextColor } from '../utils/theme.js';
import { ResourceDetails } from '../components/common/ResourceDetails.jsx';
import { ResourceColumns } from '../components/graph/ResourceColumns.jsx';
import { GraphFilters } from '../components/graph/GraphFilters.jsx';
import { GraphStatus, GraphNotices } from '../components/graph/GraphStatus.jsx';
import { GraphBlocked } from '../components/graph/GraphBlocked.jsx';
import { GraphHighlightContext, createHighlightStore } from '../components/graph/GraphHighlightContext.js';
import { useGraphData } from '../hooks/useGraphData.js';
import { useGraphFilters } from '../hooks/useGraphFilters.js';
import { useGraphSelection } from '../hooks/useGraphSelection.js';
import { useDebouncedHover } from '../hooks/useDebouncedHover.js';
import { hasActiveFilters } from '../utils/graph/graphFilterState.js';
import { applyGraphFilters, getKindOptions } from '../utils/graph/graphFilters.js';
import { applyLimits, DEFAULT_LIMITS } from '../utils/graph/graphLimits.js';
import { getRenderBudget, BUDGET } from '../utils/graph/graphBudget.js';
import { describeAttention, describeHeadline, describeLimitHint, summarizeAlerts, buildNotices } from '../utils/graph/graphMessages.js';
import { summarizeGraph } from '../utils/graph/graphSummary.js';
import { indexGraph, getLineage, pickHighlightId } from '../utils/graph/graphLineage.js';
import { NODE_TYPES, NODE_TYPE_LABELS, nodeLabel } from '../utils/graph/graphModel.js';
import { NODE_TYPE_COLORS } from '../components/graph/graphEdgeStyles.js';

const NOTHING_DRAWN = { nodes: [], edges: [] };

export const Graph = () => {
  const { kubernetesRepository, selectedContext, colorMode } = useAppContext();
  const { filters, updateFilters, clearFilters } = useGraphFilters();
  const { graph, healthLoaded, loading, refreshing, error, refresh } = useGraphData(kubernetesRepository, selectedContext, filters.health !== '');
  const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name;
  const muted = getTextColor(colorMode, 'secondary');
  const selection = useGraphSelection();
  const { clear: clearSelection } = selection;
  useEffect(() => { clearSelection(); }, [contextName, clearSelection]);
  const [hoveredId, onHover] = useDebouncedHover();

  const summary = useMemo(() => summarizeGraph(graph), [graph]);
  const matched = useMemo(() => applyGraphFilters(graph, filters), [graph, filters]);
  // Deferred, so the controls answer at once and the graph catches up behind them.
  const limits = useDeferredValue(filters.limits);
  const result = useMemo(() => applyLimits(matched, limits, summary, filters.focus), [matched, limits, summary, filters.focus]);
  const budget = getRenderBudget(result.view.nodes.length);
  const blocked = budget.status === BUDGET.BLOCKED;
  const visible = blocked ? NOTHING_DRAWN : result.view;
  const columnTypes = useMemo(() => filters.focus && !loading
    ? NODE_TYPES.filter(type => visible.nodes.some(node => node.type === type))
    : NODE_TYPES.filter(type => filters.types.includes(type)), [filters.focus, filters.types, loading, visible.nodes]);
  const index = useMemo(() => indexGraph(visible.nodes, visible.edges), [visible]);
  const kinds = useMemo(() => getKindOptions(graph.nodes), [graph.nodes]);
  const namespaceNames = useMemo(() => summary.namespaces.map((ns) => ns.name), [summary]);
  const typeCounts = useMemo(() => Object.fromEntries(NODE_TYPES.map((type) => [type, summary.byType[type].count])), [summary]);

  const highlightId = pickHighlightId(index, selection.selectedId, hoveredId);
  const lineage = useMemo(() => (highlightId ? getLineage(index, highlightId) : null), [index, highlightId]);

  const highlightStore = useRef(createHighlightStore()).current;
  useEffect(() => highlightStore.set({ lineage, selectedId: selection.selectedId }), [highlightStore, lineage, selection.selectedId]);

  const sliders = NODE_TYPES.filter((type) => result.matchedCounts[type] > 0).map((type) => ({
    type,
    label: NODE_TYPE_LABELS[type],
    color: NODE_TYPE_COLORS[type],
    matched: result.matchedCounts[type],
    shown: result.shown[type],
    limit: filters.limits[type],
  }));
  const notices = buildNotices({
    summary,
    backendWarnings: graph.warnings,
    budget,
  });
  // The panel is for scaling down; when nothing is limited, only the notices are shown.
  const showStatus = result.limited || blocked;

  const focusNode = graph.nodes.find((n) => n.id === filters.focus);
  const selectedNode = graph.nodes.find((n) => n.id === selection.selectedId);
  const focusResource = focus => {
    selection.clear();
    updateFilters({ focus, types: NODE_TYPES, search: '', kind: '', namespace: '', health: '' });
  };

  return (
    <Box display="flex" flexDirection="column" position="relative" minW={0} minH="calc(100dvh - 88px)" pb={6}>
      <HStack justify="space-between" mb={4}>
        <Text fontSize="2xl" fontWeight="bold">Graph</Text>
        {loading ? <Skeleton h={4} w="240px" /> : <Text fontSize="sm" color={muted}>
          {visible.nodes.length} of {graph.nodes.length} resources
          {refreshing && ' · Refreshing snapshot...'}
          {!refreshing && !healthLoaded && contextName && ' · Health of Composed Resources not loaded'}
        </Text>}
      </HStack>

      <GraphFilters
        key={contextName || 'no-context'}
        filters={filters}
        nodes={graph.nodes}
        loading={loading}
        typeCounts={typeCounts}
        namespaces={namespaceNames}
        kinds={kinds}
        focusLabel={focusNode ? nodeLabel(focusNode) : filters.focus}
        selectedId={selection.selectedId}
        selectedLabel={selectedNode ? nodeLabel(selectedNode) : ''}
        canClear={hasActiveFilters(filters)}
        onChange={patch => {
          if (patch.focus) focusResource(patch.focus);
          else updateFilters({ ...patch, focus: '' });
        }}
        onClear={clearFilters}
      />

      {error && <Box role="alert" p={4} mb={3} border="1px solid" borderColor={getStatusColor('red')} borderRadius="md">
        <Text color={getStatusColor('red')}>Unable to load graph: {error}</Text>
        <Button mt={2} size="sm" onClick={refresh} disabled={refreshing}>Retry</Button>
      </Box>}
      {!loading && filters.focus && !focusNode && <Text role="alert" color={muted} mb={3}>
        The focused resource is not in this snapshot. Clear focus or find another resource.
      </Text>}

      {!loading && showStatus && (
        <GraphStatus
          headline={describeHeadline({ summary, result, budget })}
          alerts={summarizeAlerts(summary, notices)}
          hintText={result.limited ? describeLimitHint() : null}
          sliders={sliders}
          attention={describeAttention(summary, filters.health === 'unhealthy')}
          notices={notices}
          defaultOpen={blocked}
          onLimitChange={(type, value) => updateFilters({ focus: '', limits: { ...filters.limits, [type]: value } })}
          onShowUnhealthy={() => updateFilters({ focus: '', health: 'unhealthy' })}
        />
      )}
      {!loading && !showStatus && <Box mb={3}><GraphNotices notices={notices} /></Box>}

      <Box css={{
        '& .resource-row': { transition: 'opacity 0.15s' },
        ...(lineage ? {
          '& .resource-row:not(.in-lineage)': { opacity: 0.3, '&:focus-visible': { opacity: 1 } },
          '& .column-connection:not(.in-lineage)': { strokeOpacity: 0.1, markerEnd: 'none' },
        } : {}),
      }}
        flex={1} display="flex" flexDirection="column"
        bg={getBackgroundColor(colorMode, colorMode === 'dark' ? 'primary' : 'tertiary')} border="1px solid"
        borderColor={getBorderColor(colorMode)} borderRadius="xl" overflow="hidden">
        {filters.focus && <HStack p={3} justify="space-between" flexWrap="wrap" gap={3}>
          <Text fontSize="sm" color={muted}>Only the focused relationship path is shown.</Text>
          <Button size="sm" variant="outline" onClick={() => updateFilters({ focus: '' })}>Show all resources</Button>
        </HStack>}
        {!loading && blocked && <GraphBlocked count={budget.count} onUseDefaults={() => updateFilters({ focus: '', limits: DEFAULT_LIMITS })} />}
        {!loading && !blocked && visible.nodes.length === 0 && <Text p={6} color={muted}>
          {!contextName ? 'Select a Kubernetes context to view the graph.' : error ? 'No graph snapshot is available. Retry loading above.' : 'No resources match the current filters.'}
        </Text>}
        {(loading || (!blocked && visible.nodes.length > 0)) && (
          <GraphHighlightContext.Provider value={highlightStore}>
            <ResourceColumns
              nodes={visible.nodes}
              edges={visible.edges}
              types={columnTypes}
              loading={loading}
              colorMode={colorMode}
              withoutComposition={summary.withoutComposition}
              partialCounts={result.partial}
              onSelect={selection.toggleNode}
              onHover={onHover}
            />
          </GraphHighlightContext.Provider>
        )}
      </Box>

      {selection.detailResource && (
        <Box flex="1" display="flex" flexDirection="column" mt={4} mb={8}>
          <ResourceDetails
            resource={selection.detailResource}
            onClose={selection.clear}
            onNavigate={selection.openRelated}
            onBack={selection.canGoBack ? selection.goBack : undefined}
          />
        </Box>
      )}
    </Box>
  );
};
