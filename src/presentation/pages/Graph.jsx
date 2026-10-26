import { Box, Text, HStack } from '@chakra-ui/react';
import { useDeferredValue, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { useAppContext } from '../providers/AppProvider.jsx';
import { getBorderColor, getTextColor } from '../utils/theme.js';
import { ResourceDetails } from '../components/common/ResourceDetails.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { GraphCanvas } from '../components/graph/GraphCanvas.jsx';
import { GraphFilters } from '../components/graph/GraphFilters.jsx';
import { GraphLegend } from '../components/graph/GraphLegend.jsx';
import { GraphStatus, GraphNotices } from '../components/graph/GraphStatus.jsx';
import { GraphBlocked } from '../components/graph/GraphBlocked.jsx';
import { buildFlowNodes, buildFlowEdges } from '../components/graph/graphFlowElements.js';
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
import { layoutGraph } from '../utils/graph/graphLayout.js';
import { NODE_TYPES, NODE_TYPE_LABELS, nodeLabel } from '../utils/graph/graphModel.js';
import { NODE_TYPE_COLORS } from '../components/graph/graphEdgeStyles.js';
import { GRAPH_CANVAS_CSS, GRAPH_HIGHLIGHT_CSS } from '../components/graph/graphCanvasStyles.js';

const CANVAS_HEIGHT_VH = 72;
const NOTHING_DRAWN = { nodes: [], edges: [] };

const GraphError = ({ message }) => (
  <Box>
    <Text fontSize="2xl" fontWeight="bold" mb={6}>Graph</Text>
    <Box
      p={6}
      bg="red.50"
      _dark={{ bg: 'red.900', borderColor: 'red.700', color: 'red.100' }}
      border="1px"
      borderColor="red.200"
      borderRadius="md"
      color="red.800"
    >
      <Text fontWeight="bold" mb={2}>Error loading graph</Text>
      <Text>{message}</Text>
    </Box>
  </Box>
);

GraphError.propTypes = { message: PropTypes.string.isRequired };

export const Graph = () => {
  const { kubernetesRepository, selectedContext, colorMode } = useAppContext();
  const { filters, updateFilters, clearFilters } = useGraphFilters();
  const { graph, healthLoaded, loading, refreshing, error } = useGraphData(kubernetesRepository, selectedContext, filters.health !== '');
  const muted = getTextColor(colorMode, 'secondary');
  const selection = useGraphSelection();
  const [hoveredId, onHover] = useDebouncedHover();

  const summary = useMemo(() => summarizeGraph(graph), [graph]);
  const matched = useMemo(() => applyGraphFilters(graph, filters), [graph, filters]);
  // Deferred, so the controls answer at once and the graph catches up behind them.
  const limits = useDeferredValue(filters.limits);
  const result = useMemo(() => applyLimits(matched, limits, summary), [matched, limits, summary]);
  const budget = getRenderBudget(result.view.nodes.length);
  const blocked = budget.status === BUDGET.BLOCKED;
  const visible = blocked ? NOTHING_DRAWN : result.view;
  const positions = useMemo(() => layoutGraph(visible.nodes, visible.edges), [visible]);
  const index = useMemo(() => indexGraph(visible.nodes, visible.edges), [visible]);
  const kinds = useMemo(() => getKindOptions(graph.nodes), [graph.nodes]);
  const namespaceNames = useMemo(() => summary.namespaces.map((ns) => ns.name), [summary]);
  const typeCounts = useMemo(() => Object.fromEntries(NODE_TYPES.map((type) => [type, summary.byType[type].count])), [summary]);

  const highlightId = pickHighlightId(index, selection.selectedId, hoveredId);
  const lineage = useMemo(() => (highlightId ? getLineage(index, highlightId) : null), [index, highlightId]);

  const flowNodes = useMemo(
    () => buildFlowNodes({ nodes: visible.nodes, positions, colorMode, withoutComposition: summary.withoutComposition, partialCounts: result.partial }),
    [visible.nodes, positions, colorMode, summary, result.partial]
  );
  const flowEdges = useMemo(() => buildFlowEdges(visible.edges), [visible.edges]);
  const highlightStore = useRef(createHighlightStore()).current;
  useEffect(() => highlightStore.set({ lineage, selectedId: selection.selectedId }), [highlightStore, lineage, selection.selectedId]);
  const fitKey = useMemo(() => visible.nodes.map((n) => n.id).join(','), [visible.nodes]);

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

  if (loading) return <LoadingSpinner message="Loading graph..." />;
  if (error) return <GraphError message={error} />;

  const focusNode = graph.nodes.find((n) => n.id === filters.focus);
  const selectedNode = graph.nodes.find((n) => n.id === selection.selectedId);

  return (
    <Box display="flex" flexDirection="column" position="relative">
      <HStack justify="space-between" mb={4}>
        <Text fontSize="2xl" fontWeight="bold">Graph</Text>
        <Text fontSize="sm" color={muted}>
          {visible.nodes.length} of {graph.nodes.length} nodes, {visible.edges.length} edges
          {refreshing && ' · Loading health...'}
          {!refreshing && !healthLoaded && ' · Health of Composed Resources not loaded'}
        </Text>
      </HStack>

      <GraphFilters
        filters={filters}
        typeCounts={typeCounts}
        namespaces={namespaceNames}
        kinds={kinds}
        focusLabel={focusNode ? nodeLabel(focusNode) : filters.focus}
        selectedId={selection.selectedId}
        selectedLabel={selectedNode ? nodeLabel(selectedNode) : ''}
        canClear={hasActiveFilters(filters)}
        onChange={updateFilters}
        onClear={clearFilters}
      />

      {showStatus && (
        <GraphStatus
          headline={describeHeadline({ summary, result, budget })}
          alerts={summarizeAlerts(summary, notices)}
          hintText={result.limited ? describeLimitHint() : null}
          sliders={sliders}
          attention={describeAttention(summary, filters.health === 'unhealthy')}
          notices={notices}
          defaultOpen={blocked}
          onLimitChange={(type, value) => updateFilters({ limits: { ...filters.limits, [type]: value } })}
          onShowUnhealthy={() => updateFilters({ health: 'unhealthy' })}
        />
      )}
      {!showStatus && <Box mb={3}><GraphNotices notices={notices} /></Box>}

      <Box css={lineage ? GRAPH_HIGHLIGHT_CSS : GRAPH_CANVAS_CSS} h={`${CANVAS_HEIGHT_VH}vh`} border="1px solid" borderColor={getBorderColor(colorMode)} borderRadius="md">
        {blocked && <GraphBlocked count={budget.count} onUseDefaults={() => updateFilters({ limits: DEFAULT_LIMITS })} />}
        {!blocked && visible.nodes.length === 0 && <Text p={6} color={muted}>No resources match the current filters.</Text>}
        {!blocked && visible.nodes.length > 0 && (
          <GraphHighlightContext.Provider value={highlightStore}>
            <GraphCanvas
              nodes={flowNodes}
              edges={flowEdges}
              colorMode={colorMode}
              fitKey={fitKey}
              onNodeClick={(_, flowNode) => selection.toggleNode(flowNode.data.node)}
              onNodeHover={onHover}
            />
          </GraphHighlightContext.Provider>
        )}
      </Box>

      <GraphLegend />

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
