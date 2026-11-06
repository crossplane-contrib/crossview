import { Box, Button, HStack, Spinner, Text, VStack } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiArrowUpRight, FiRefreshCw, FiActivity, FiLayers, FiServer, FiPackage } from 'react-icons/fi';
import PropTypes from 'prop-types';
import { useAppContext } from '../providers/AppProvider.jsx';
import { useDashboardOverview } from '../hooks/useDashboardOverview.js';
import { useDashboardLayout } from '../hooks/useDashboardLayout.js';
import { ResourceDetails } from '../components/common/ResourceDetails.jsx';
import { Container } from '../components/common/Container.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { CreationChart, NamespaceChart, ReadinessChart } from '../components/widgets/DashboardCharts.jsx';
import { DashboardGrid, DashboardPanelMenu } from '../components/widgets/DashboardLayout.jsx';
import { buildDashboardSummary, getReadiness, resourceKey } from '../utils/dashboard.js';
import { getAccentColor, getBackgroundColor, getStatusColor, getTextColor } from '../utils/theme.js';

const HEALTH_LABELS = { ready: 'Ready', notReady: 'Not ready', unknown: 'Unknown' };
const HEALTH_COLORS = { ready: 'green', notReady: 'red', unknown: 'gray' };
const METRICS = [
  { key: 'compositeResources', label: 'Composite resources', path: '/composite-resources', icon: FiLayers },
  { key: 'claims', label: 'Claims', path: '/claims', icon: FiLayers },
  { key: 'managedResources', label: 'Managed resources', path: '/managed-resources', icon: FiServer },
  { key: 'compositions', label: 'Compositions', path: '/compositions', icon: FiLayers },
  { key: 'xrds', label: 'Resource definitions', path: '/xrds', icon: FiActivity },
  { key: 'providers', label: 'Providers', path: '/providers', icon: FiPackage },
];

const Panel = ({ title, description, action, controls, children }) => (
  <Container p={{ base: 4, md: 6 }} pb={8} borderRadius="xl" minW={0} minH={0} flex={1} overflow="auto">
    <HStack justify="space-between" align="center" gap={2} mb={2}>
        <Text as="h2" fontWeight="semibold" fontSize="md">{title}</Text>
        {controls}
    </HStack>
    <Text fontSize="xs" color="inherit" opacity={0.7} mb={4}>{description}</Text>
    {action && <HStack justify="end" mb={3}>{action}</HStack>}
    {children}
  </Container>
);

Panel.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired, description: PropTypes.string.isRequired,
  action: PropTypes.node, controls: PropTypes.node, children: PropTypes.node.isRequired,
};

const Status = ({ resource }) => {
  const status = getReadiness(resource);
  return <HStack gap={2} whiteSpace="nowrap">
    <Box w={2} h={2} borderRadius="full" bg={getStatusColor(HEALTH_COLORS[status])} />
    <Text fontSize="xs">{HEALTH_LABELS[status]}</Text>
  </HStack>;
};

Status.propTypes = { resource: PropTypes.object.isRequired };

const ResourceList = ({ resources, onSelect, empty }) => (
  <VStack align="stretch" gap={2}>
    {resources.length === 0 && <Text fontSize="sm" opacity={0.7} py={4}>{empty}</Text>}
    {resources.map(resource => (
      <Button key={resourceKey(resource)} variant="ghost" h="auto" py={3} px={2}
        justifyContent="space-between" textAlign="left" whiteSpace="normal" onClick={() => onSelect(resource)}>
        <Box minW={0}>
          <Text fontSize="sm" fontWeight="medium" overflowWrap="anywhere">{resource.name}</Text>
          <Text fontSize="xs" opacity={0.7} mt={1}>{resource.kind} · {resource.namespace || 'Cluster-scoped'}</Text>
        </Box>
        <Status resource={resource} />
      </Button>
    ))}
  </VStack>
);

ResourceList.propTypes = {
  resources: PropTypes.arrayOf(PropTypes.object).isRequired,
  onSelect: PropTypes.func.isRequired, empty: PropTypes.string.isRequired,
};

export const Dashboard = () => {
  const location = useLocation();
  const { kubernetesRepository, selectedContext, colorMode } = useAppContext();
  const { data, loading, error, refresh } = useDashboardOverview(kubernetesRepository, selectedContext);
  const dashboardLayout = useDashboardLayout();
  const [selectedResource, setSelectedResource] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [days, setDays] = useState(14);
  const summary = useMemo(() => data ? buildDashboardSummary(data, days) : null, [data, days]);
  const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name;
  const muted = getTextColor(colorMode, 'secondary');
  const partial = Boolean(data?.errors.length);

  useEffect(() => {
    setSelectedResource(null);
    setNavigationHistory([]);
  }, [location.pathname, contextName]);

  const handleResourceClick = (resource) => {
    setNavigationHistory([]);
    setSelectedResource(previous => previous && resourceKey(previous) === resourceKey(resource) ? null : resource);
  };
  const handleClose = () => {
    setSelectedResource(null);
    setNavigationHistory([]);
  };
  const handleNavigate = (resource) => {
    setNavigationHistory(previous => [...previous, selectedResource]);
    setSelectedResource(resource);
  };
  const handleBack = () => {
    setSelectedResource(navigationHistory[navigationHistory.length - 1]);
    setNavigationHistory(previous => previous.slice(0, -1));
  };
  const attentionColumns = [
    { header: 'Resource', accessor: 'name', minWidth: '180px' },
    { header: 'Kind', accessor: 'kind', minWidth: '140px' },
    { header: 'Namespace', accessor: 'namespace', render: row => row.namespace || 'Cluster-scoped' },
    { header: 'Condition', accessor: 'conditions', minWidth: '220px', render: row => {
      const condition = row.conditions.find(entry => entry.status === 'False' && ['Ready', 'Synced'].includes(entry.type));
      return <Box><Text fontSize="sm">{condition?.reason || 'Not ready'}</Text>
        <Text fontSize="xs" color={muted} maxW="340px" truncate title={condition?.message}>{condition?.message || 'Open resource details to investigate.'}</Text></Box>;
    } },
  ];

  return (
    <Box pb={8} color={getTextColor(colorMode, 'primary')}>
      <HStack justify="space-between" align="start" flexWrap="wrap" gap={4} mb={6}>
        <Box>
          <HStack gap={3} mb={1}>
            <Text as="h1" fontSize="3xl" fontWeight="semibold">Dashboard</Text>
          </HStack>
          {contextName && <Text color={muted} fontSize="xs" mt={2} overflowWrap="anywhere">
            {contextName}{data && ` · Snapshot ${new Date(data.updatedAt).toLocaleTimeString()}`}
          </Text>}
        </Box>
        <HStack gap={2}>
          <DashboardPanelMenu layout={dashboardLayout.layout} onToggle={dashboardLayout.toggle} onReset={dashboardLayout.reset} />
          {contextName && <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <FiRefreshCw /> {loading ? 'Loading snapshot' : 'Refresh'}
          </Button>}
        </HStack>
      </HStack>

      {dashboardLayout.error && <Text role="alert" fontSize="sm" mb={4} color={getStatusColor('red')}>{dashboardLayout.error}</Text>}
      {!contextName && <Container p={8}><Text>Select a Kubernetes context to view your infrastructure dashboard.</Text></Container>}
      {loading && <Container p={12} role="status"><VStack gap={3}><Spinner /><Text fontSize="sm">Loading dashboard snapshot...</Text></VStack></Container>}
      {error && <Container p={6} role="alert"><Text color={getStatusColor('red')}>Unable to load dashboard: {error}</Text><Button mt={3} onClick={refresh}>Retry</Button></Container>}

      {!loading && summary && <>
        {partial && <Box role="alert" p={4} mb={5} borderRadius="lg" border="1px solid" borderColor={getStatusColor('yellow')}>
          <Text fontWeight="semibold" fontSize="sm">Incomplete snapshot — charts and totals include successfully loaded resources only.</Text>
          <VStack align="stretch" gap={1} mt={2}>
            {data.errors.map((entry, index) => <Text key={`${entry.source}-${index}`} fontSize="xs" overflowWrap="anywhere">{entry.source}: {entry.message}</Text>)}
          </VStack>
        </Box>}
        {data.managedFromCache && <Text color={muted} fontSize="xs" mb={4}>Managed resource data is served from the server cache. Refresh reloads the current available snapshot.</Text>}

        <DashboardGrid layout={dashboardLayout.layout} onMove={dashboardLayout.move} onReorder={dashboardLayout.reorder} onResize={dashboardLayout.resize}>
        <Panel id="metrics" title="Overview metrics" description="Browse resource collections in the current snapshot.">
        <Box display="grid" gridTemplateColumns={{ base: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))', '2xl': 'repeat(6, minmax(0, 1fr))' }} gap={4}>
          {METRICS.map(({ key, label, path, icon: Icon }) => {
            const unavailable = data[key] === null;
            const incomplete = data.errors.some(entry => entry.source === key);
            return <Container as={Link} to={path} key={key} p={4} borderRadius="xl"
              _hover={{ borderColor: getAccentColor('blue'), textDecoration: 'none' }}>
              <HStack justify="space-between" mb={3} color={muted}><Icon /><FiArrowUpRight /></HStack>
              <Text fontSize="3xl" fontWeight="semibold" fontVariantNumeric="tabular-nums">{unavailable ? 'N/A' : data[key].length.toLocaleString()}</Text>
              <Text fontSize="xs" color={muted} mt={1}>{label}{incomplete && !unavailable ? ' (partial)' : ''}</Text>
            </Container>;
          })}
        </Box>
        </Panel>

          <Panel id="readiness" title="Resource readiness" description="Ready and Synced conditions across loaded XRs, claims, and managed resources.">
            <ReadinessChart health={summary.health} />
          </Panel>
          <Panel id="creation" title="Resource creation" description="Surviving resources by creation date (UTC), not historical health or an audit log."
            action={<HStack gap={1}>{[7, 14, 30].map(period => <Button key={period} size="xs"
              variant={days === period ? 'solid' : 'ghost'} aria-pressed={days === period} onClick={() => setDays(period)}>{period}d</Button>)}</HStack>}>
            <CreationChart activity={summary.activity} />
          </Panel>
          <Panel id="attention" title={`Needs attention (${summary.attention.length.toLocaleString()})`} description="Resources reporting Ready=False or Synced=False. Select a row to investigate.">
            {summary.attention.length ? <DataTable data={summary.attention} columns={attentionColumns}
              searchableFields={['name', 'kind', 'namespace']} itemsPerPage={5} onRowClick={handleResourceClick} />
              : <Box py={8}><Text fontWeight="medium">{partial ? 'No failures found in the loaded resources.' : 'No resources reporting readiness failures.'}</Text>
                <Text fontSize="sm" color={muted} mt={2}>{summary.health.unknown ? `${summary.health.unknown} resources have unknown readiness.` : 'Unknown or missing conditions are not counted as healthy.'}</Text></Box>}
          </Panel>
          <Panel id="namespaces" title="Namespace distribution" description="Top namespaces by loaded resource count, segmented by readiness.">
            <NamespaceChart namespaces={summary.namespaces} />
          </Panel>
          <Panel id="packages" title="Package health" description={`${data.functions === null ? 'Functions unavailable' : `${data.functions.length} functions`} · Providers and functions require Installed=True and Healthy=True.`}
            action={<Button as={Link} to="/functions" variant="ghost" size="xs">Functions <FiArrowUpRight /></Button>}>
            <ResourceList resources={[...summary.packages].sort((a, b) => {
              const rank = { notReady: 0, unknown: 1, ready: 2 };
              return rank[getReadiness(a)] - rank[getReadiness(b)] || a.name.localeCompare(b.name);
            }).slice(0, 8)} onSelect={handleResourceClick} empty={data.providers === null && data.functions === null ? 'Package data is unavailable.' : 'No packages found in the loaded snapshot.'} />
            {summary.packages.length > 8 && <Text fontSize="xs" color={muted} mt={2}>Showing 8 of {summary.packages.length} packages, failures first. Browse Providers or Functions for the complete list.</Text>}
          </Panel>
          <Panel id="compositions" title="Composition usage" description="Composite resources referencing each installed composition."
            action={<Button as={Link} to="/compositions" variant="ghost" size="xs">All <FiArrowUpRight /></Button>}>
            <VStack align="stretch" gap={3}>
              {summary.compositions.length === 0 && <Text fontSize="sm" color={muted}>{data.compositions === null ? 'Composition data is unavailable.' : 'No compositions found.'}</Text>}
              {summary.compositions.slice(0, 6).map(composition => <Box key={resourceKey(composition)}>
                <Button variant="ghost" size="sm" w="100%" px={0} justifyContent="space-between" onClick={() => handleResourceClick(composition)}>
                  <Text truncate title={composition.name}>{composition.name}</Text><Text flexShrink={0}>{composition.count} XRs</Text>
                </Button>
                <Box h={1.5} borderRadius="full" bg={getBackgroundColor(colorMode, 'tertiary')}>
                  <Box h="100%" borderRadius="full" bg={getAccentColor('blue')} w={`${composition.count / Math.max(1, summary.compositions[0].count) * 100}%`} />
                </Box>
              </Box>)}
              {summary.compositions.length > 6 && <Text fontSize="xs" color={muted}>Showing 6 of {summary.compositions.length} compositions.</Text>}
            </VStack>
          </Panel>
          <Panel id="recent" title="Recently created" description="Latest surviving resources across XRs, claims, and managed resources."
            action={<Button as={Link} to="/graph" variant="ghost" size="xs">Graph <FiArrowUpRight /></Button>}>
            <ResourceList resources={summary.recent} onSelect={handleResourceClick} empty="No resources with a creation timestamp in the loaded snapshot." />
          </Panel>
        </DashboardGrid>
      </>}
      {selectedResource && <ResourceDetails resource={selectedResource} onClose={handleClose} onNavigate={handleNavigate}
        onBack={navigationHistory.length ? handleBack : undefined} />}
    </Box>
  );
};
