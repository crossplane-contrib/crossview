import {
  Box,
  Text,
  HStack,
  Button,
  Badge,
} from '@chakra-ui/react';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../providers/AppProvider.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { ResourceDetails } from '../components/common/ResourceDetails.jsx';
import { Dropdown } from '../components/common/Dropdown.jsx';
import { getSyncedStatus, getReadyStatus, getResponsiveStatus } from '../utils/resourceStatus.js';

export const Resources = () => {
  const location = useLocation();
  const { kubernetesRepository, selectedContext } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [kindFilter, setKindFilter] = useState('all');
  const [syncedFilter, setSyncedFilter] = useState('all');
  const [readyFilter, setReadyFilter] = useState('all');
  const [responsiveFilter, setResponsiveFilter] = useState('all');
  const [selectedResource, setSelectedResource] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [uniqueKinds, setUniqueKinds] = useState([]);
  const [useAutoHeight, setUseAutoHeight] = useState(false);
  const [allManagedResources, setAllManagedResources] = useState([]);
  const [fromCache, setFromCache] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadProgress, setLoadProgress] = useState(null);
  const tableContainerRef = useRef(null);
  const isMountedRef = useRef(true);
  const loadIdRef = useRef(0);

  useEffect(() => {
    setSelectedResource(null);
    setNavigationHistory([]);
  }, [location.pathname]);

  const loadManagedResources = useCallback(async (forceRefresh = false) => {
    if (!selectedContext) {
      setUniqueKinds([]);
      setAllManagedResources([]);
      setFromCache(false);
      setLoadProgress(null);
      return;
    }

      try {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
        setError(null);
        setLoadProgress({ loaded: 0, total: null });
        const loadId = (loadIdRef.current || 0) + 1;
        loadIdRef.current = loadId;
        const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;
        const { GetManagedResourcesUseCase } = await import('../../domain/usecases/GetManagedResourcesUseCase.js');
        const useCase = new GetManagedResourcesUseCase(kubernetesRepository);
      const accumulated = [];
      let continueToken = null;
      let totalCount = null;
      let seenFromCache = false;
      let firstPage = true;
      do {
        if (!isMountedRef.current || loadIdRef.current !== loadId) return;
        const result = await useCase.execute(contextName, null, firstPage && forceRefresh, { limit: 500, continueToken });
        if (!isMountedRef.current || loadIdRef.current !== loadId) return;
        const pageItems = Array.isArray(result.items) ? result.items : [];
        accumulated.push(...pageItems);
        if (typeof result.totalCount === 'number') totalCount = result.totalCount;
        if (result.fromCache) seenFromCache = true;
        continueToken = result.continueToken || null;
        firstPage = false;
        setLoadProgress({ loaded: accumulated.length, total: totalCount });
        setAllManagedResources([...accumulated]);
      } while (continueToken);

      if (!isMountedRef.current || loadIdRef.current !== loadId) return;

      setAllManagedResources(accumulated);
      setUniqueKinds([...new Set(accumulated.map(r => r.kind).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
      setFromCache(seenFromCache);
        setLoading(false);
      setIsRefreshing(false);
      setLoadProgress(null);
      } catch (err) {
      if (!isMountedRef.current) return;
        console.warn('Failed to load managed resources:', err);
        setError(err.message);
        setAllManagedResources([]);
        setUniqueKinds([]);
      setFromCache(false);
        setLoading(false);
      setIsRefreshing(false);
      setLoadProgress(null);
      }
  }, [selectedContext, kubernetesRepository]);

  useEffect(() => {
    isMountedRef.current = true;
    loadManagedResources(false);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [selectedContext, kubernetesRepository, loadManagedResources]);

  const fetchData = useCallback(async (page, pageSize, searchTerm = '', searchableFields = []) => {
    if (!selectedContext || allManagedResources.length === 0) {
      return { items: [], totalCount: 0 };
    }
    
    try {
      setError(null);
      let filtered = [...allManagedResources];
      
      if (kindFilter !== 'all') {
        filtered = filtered.filter(r => r.kind === kindFilter);
      }
      
      filtered = filtered.filter(r => {
        const syncedStatus = getSyncedStatus(r.conditions);
        const readyStatus = getReadyStatus(r.conditions);
        const responsiveStatus = getResponsiveStatus(r.conditions);
        
        if (syncedFilter !== 'all') {
          if (syncedFilter === 'synced' && syncedStatus?.text !== 'Synced') return false;
          if (syncedFilter === 'not-synced' && syncedStatus?.text !== 'Not Synced') return false;
          if (syncedFilter === 'none' && syncedStatus !== null) return false;
        }
        
        if (readyFilter !== 'all') {
          if (readyFilter === 'ready' && readyStatus?.text !== 'Ready') return false;
          if (readyFilter === 'not-ready' && readyStatus?.text !== 'Not Ready') return false;
          if (readyFilter === 'none' && readyStatus !== null) return false;
        }
        
        if (responsiveFilter !== 'all') {
          if (responsiveFilter === 'responsive' && responsiveStatus?.text !== 'Responsive') return false;
          if (responsiveFilter === 'not-responsive' && responsiveStatus?.text !== 'Not Responsive') return false;
          if (responsiveFilter === 'none' && responsiveStatus !== null) return false;
        }
        
        return true;
      });

      const trimmedSearch = searchTerm.trim().toLowerCase();
      if (trimmedSearch && searchableFields.length > 0) {
        filtered = filtered.filter(item => {
          return searchableFields.some(field => {
            const value = field.split('.').reduce((obj, key) => obj?.[key], item);
            return String(value || '').toLowerCase().includes(trimmedSearch);
          });
        });
      }
      
      const startIndex = (page - 1) * pageSize;
      const paginated = filtered.slice(startIndex, startIndex + pageSize);
      
      return {
        items: paginated,
        totalCount: filtered.length
      };
    } catch (err) {
      setError(err.message);
      return { items: [], totalCount: 0 };
    }
  }, [selectedContext, allManagedResources, kindFilter, syncedFilter, readyFilter, responsiveFilter]);


  useEffect(() => {
    if (!selectedResource || !tableContainerRef.current) {
      setUseAutoHeight(false);
      return;
    }

    const checkTableHeight = () => {
      const container = tableContainerRef.current;
      if (!container) return;
      
      const viewportHeight = window.innerHeight;
      const halfViewport = (viewportHeight - 100) * 0.5; // Account for header
      const tableHeight = container.scrollHeight;
      
      setUseAutoHeight(tableHeight > halfViewport);
    };

    checkTableHeight();

    const resizeObserver = new ResizeObserver(checkTableHeight);
    resizeObserver.observe(tableContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [selectedResource, loading]);

  const renderStatusBadge = (status) => {
    if (!status) {
      return (
        <Text fontSize="xs" color="gray.500" _dark={{ color: 'gray.400' }}>
          -
        </Text>
      );
    }
    return (
      <Box
        as="span"
        display="inline-block"
        px={2}
        py={1}
        borderRadius="md"
        fontSize="xs"
        fontWeight="semibold"
        bg={`${status.color}.100`}
        _dark={{ bg: `${status.color}.800`, color: `${status.color}.100` }}
        color={`${status.color}.800`}
      >
        {status.text}
      </Box>
    );
  };

  const allColumns = [
    {
      header: 'Name',
      accessor: 'name',
      minWidth: '200px',
    },
    {
      header: 'Kind',
      accessor: 'kind',
      minWidth: '200px',
    },
    {
      header: 'Synced',
      accessor: (row) => {
        if (!row || !row.conditions) return '-';
        const syncedStatus = getSyncedStatus(row.conditions);
        return syncedStatus?.text || '-';
      },
      minWidth: '120px',
      render: (row) => renderStatusBadge(row?.conditions ? getSyncedStatus(row.conditions) : null),
      statusType: 'synced',
    },
    {
      header: 'Ready',
      accessor: (row) => {
        if (!row || !row.conditions) return '-';
        const readyStatus = getReadyStatus(row.conditions);
        return readyStatus?.text || '-';
      },
      minWidth: '120px',
      render: (row) => renderStatusBadge(row?.conditions ? getReadyStatus(row.conditions) : null),
      statusType: 'ready',
    },
    {
      header: 'Responsive',
      accessor: (row) => {
        if (!row || !row.conditions) return '-';
        const responsiveStatus = getResponsiveStatus(row.conditions);
        return responsiveStatus?.text || '-';
      },
      minWidth: '120px',
      render: (row) => renderStatusBadge(row?.conditions ? getResponsiveStatus(row.conditions) : null),
      statusType: 'responsive',
    },
    {
      header: 'Created',
      accessor: 'creationTimestamp',
      minWidth: '150px',
      render: (row) => row.creationTimestamp ? new Date(row.creationTimestamp).toLocaleString() : '-',
    },
  ];

  const columns = useMemo(() => {
    if (allManagedResources.length === 0) {
      return allColumns;
    }

    return allColumns.filter(column => {
      if (!column.statusType) {
        return true;
      }

      const hasData = allManagedResources.some(row => {
        if (!row || !row.conditions || !Array.isArray(row.conditions)) return false;
        if (column.statusType === 'synced') {
          return row.conditions.some(c => c.type === 'Synced');
        }
        if (column.statusType === 'ready') {
          return row.conditions.some(c => c.type === 'Ready');
        }
        if (column.statusType === 'responsive') {
          return row.conditions.some(c => c.type === 'Responsive');
        }
        return false;
      });

      return hasData;
    });
  }, [allManagedResources]);

  if (error) {
    return (
      <Box>
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Managed Resources</Text>
        <Box
          p={6}
          bg="red.50"
          _dark={{ bg: 'red.900', borderColor: 'red.700', color: 'red.100' }}
          border="1px"
          borderColor="red.200"
          borderRadius="md"
          color="red.800"
        >
          <Text fontWeight="bold" mb={2}>Error loading managed resources</Text>
          <Text>{error}</Text>
        </Box>
      </Box>
    );
  }

  const handleRowClick = (item) => {
    const clickedResource = {
      apiVersion: item.apiVersion,
      kind: item.kind,
      name: item.name,
      namespace: item.namespace || null,
    };

    if (selectedResource && 
        selectedResource.name === clickedResource.name &&
        selectedResource.kind === clickedResource.kind &&
        selectedResource.apiVersion === clickedResource.apiVersion &&
        selectedResource.namespace === clickedResource.namespace) {
      setSelectedResource(null);
      setNavigationHistory([]);
      return;
    }

    setNavigationHistory([]);
    setSelectedResource(clickedResource);
  };

  const handleNavigate = (resource) => {
    setNavigationHistory(prev => [...prev, selectedResource]);
    setSelectedResource(resource);
  };

  const handleBack = () => {
    if (navigationHistory.length > 0) {
      const previous = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));
      setSelectedResource(previous);
    } else {
      setSelectedResource(null);
    }
  };

  const handleClose = () => {
    setSelectedResource(null);
    setNavigationHistory([]);
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      position="relative"
    >
      <HStack spacing={4} mb={2} align="center">
        <Text fontSize="2xl" fontWeight="bold">Managed Resources</Text>
        {fromCache && !loading && !isRefreshing && (
          <HStack spacing={2}>
            <Badge colorScheme="blue" variant="subtle">Cached</Badge>
            <Button
              size="sm"
              colorScheme="blue"
              variant="outline"
              onClick={() => loadManagedResources(true)}
              isLoading={isRefreshing}
            >
              Refresh
            </Button>
          </HStack>
        )}
      </HStack>
      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={6}>
        Kubernetes resources created and managed by Crossplane (Deployments, Services, etc.)
      </Text>
      
      {(loading || isRefreshing) && (
        <Box mb={4}>
          <HStack spacing={3} align="center">
            <Box
              w="16px"
              h="16px"
              border="2px solid"
              borderColor="blue.200"
              borderTopColor="blue.500"
              _dark={{ borderColor: 'blue.700', borderTopColor: 'blue.400' }}
              borderRadius="50%"
              style={{
                animation: 'spin 1s linear infinite',
              }}
            />
            <Text fontSize="xs" color="gray.500" _dark={{ color: 'gray.400' }}>
              {isRefreshing ? 'Refreshing managed resources...' : 'Loading managed resources...'}
              {loadProgress && (loadProgress.total ? ` ${loadProgress.loaded}/${loadProgress.total}` : ` ${loadProgress.loaded}`)}
            </Text>
          </HStack>
        </Box>
      )}

      <Box
        display="flex"
        flexDirection="column"
        gap={4}
      >
        {!loading && !isRefreshing && (
        <Box
          ref={tableContainerRef}
          flex={selectedResource ? (useAutoHeight ? '0 0 50%' : '0 0 auto') : '1'}
          display="flex"
          flexDirection="column"
          minH={0}
          maxH={selectedResource && useAutoHeight ? '50vh' : 'none'}
          overflowY={selectedResource && useAutoHeight ? 'auto' : 'visible'}
        >
          <DataTable
              data={[]}
              columns={columns}
              searchableFields={['name', 'kind']}
              itemsPerPage={20}
              onRowClick={handleRowClick}
              serverSidePagination={true}
              fetchData={fetchData}
              loading={false}
              filters={
                <>
                  <Dropdown
                    minW="200px"
                    placeholder="All Kinds"
                    value={kindFilter}
                    onChange={setKindFilter}
                    options={[
                      { value: 'all', label: 'All Kinds' },
                      ...uniqueKinds.map(kind => ({ value: kind, label: kind }))
                    ]}
                  />
                  {columns.some(col => col.header === 'Synced') && (
                    <Dropdown
                      minW="140px"
                      placeholder="All Synced"
                      value={syncedFilter}
                      onChange={setSyncedFilter}
                      options={[
                        { value: 'all', label: 'All Synced' },
                        { value: 'synced', label: 'Synced' },
                        { value: 'not-synced', label: 'Not Synced' },
                        { value: 'none', label: 'No Synced Status' }
                      ]}
                    />
                  )}
                  {columns.some(col => col.header === 'Ready') && (
                    <Dropdown
                      minW="140px"
                      placeholder="All Ready"
                      value={readyFilter}
                      onChange={setReadyFilter}
                      options={[
                        { value: 'all', label: 'All Ready' },
                        { value: 'ready', label: 'Ready' },
                        { value: 'not-ready', label: 'Not Ready' },
                        { value: 'none', label: 'No Ready Status' }
                      ]}
                    />
                  )}
                  {columns.some(col => col.header === 'Responsive') && (
                    <Dropdown
                      minW="140px"
                      placeholder="All Responsive"
                      value={responsiveFilter}
                      onChange={setResponsiveFilter}
                      options={[
                        { value: 'all', label: 'All Responsive' },
                        { value: 'responsive', label: 'Responsive' },
                        { value: 'not-responsive', label: 'Not Responsive' },
                        { value: 'none', label: 'No Responsive Status' }
                      ]}
                    />
                  )}
                </>
            }
          />
        </Box>
        )}

        {selectedResource && (
          <Box
            flex="1"
            display="flex"
            flexDirection="column"
            mb={8}
          >
            <ResourceDetails
              resource={selectedResource}
              onClose={handleClose}
              onNavigate={handleNavigate}
              onBack={navigationHistory.length > 0 ? handleBack : undefined}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

