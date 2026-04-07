import {
  Box,
  Text,
  HStack,
} from '@chakra-ui/react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../providers/AppProvider.jsx';
import { DataTable } from '../components/common/DataTable.jsx';
import { ResourceDetails } from '../components/common/ResourceDetails.jsx';
import { getStatusColor, getStatusText } from '../utils/resourceStatus.js';

export const Policies = () => {
  const location = useLocation();
  const { kubernetesRepository, selectedContext } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [useAutoHeight, setUseAutoHeight] = useState(false);
  const tableContainerRef = useRef(null);

  useEffect(() => {
    setSelectedResource(null);
    setNavigationHistory([]);
  }, [location.pathname]);

  const fetchPolicies = useCallback(async (page, limit, searchTerm = '', searchableFields = []) => {
    if (!selectedContext) {
      return { items: [], totalCount: 0 };
    }

    const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;

    const policyTypes = [
      { apiVersion: 'apiextensions.crossplane.io/v1alpha1', kind: 'CompositionValidationPolicy' },
    ];

    const transformPolicies = (items, apiVersion, kind) => {
      return items.map(policy => ({
        name: policy.metadata?.name || 'unknown',
        namespace: policy.metadata?.namespace || null,
        uid: policy.metadata?.uid || '',
        creationTimestamp: policy.metadata?.creationTimestamp || '',
        labels: policy.metadata?.labels || {},
        conditions: policy.status?.conditions || [],
        validationActions: policy.spec?.validationActions || [],
        matchLabels: policy.spec?.matchLabels || {},
        spec: policy.spec || {},
        status: policy.status || {},
        apiVersion,
        kind,
      }));
    };

    const applySearchFilter = (items) => {
      const trimmedSearch = searchTerm.trim().toLowerCase();
      if (!trimmedSearch || searchableFields.length === 0) {
        return items;
      }
      return items.filter(item => {
        return searchableFields.some(field => {
          const value = field.split('.').reduce((obj, key) => obj?.[key], item);
          return String(value || '').toLowerCase().includes(trimmedSearch);
        });
      });
    };

    try {
      const allItems = [];

      for (const policyType of policyTypes) {
        try {
          let continueToken = null;
          do {
            const result = await kubernetesRepository.getResources(
              policyType.apiVersion, policyType.kind, null, contextName, 100, continueToken
            );
            const batch = result.items || [];
            allItems.push(...transformPolicies(batch, policyType.apiVersion, policyType.kind));
            continueToken = result.continueToken || null;
          } while (continueToken);
        } catch {
        }
      }

      const filteredItems = applySearchFilter(allItems);
      const startIndex = (page - 1) * limit;

      return {
        items: filteredItems.slice(startIndex, startIndex + limit),
        totalCount: filteredItems.length,
        continueToken: null,
      };
    } catch (err) {
      throw new Error(`Failed to fetch policies: ${err.message}`);
    }
  }, [kubernetesRepository, selectedContext]);

  useEffect(() => {
    if (!selectedContext) {
      setLoading(false);
      return;
    }
    setLoading(false);
  }, [selectedContext]);

  useEffect(() => {
    if (!selectedResource || !tableContainerRef.current) {
      setUseAutoHeight(false);
      return;
    }

    const checkTableHeight = () => {
      const container = tableContainerRef.current;
      if (!container) return;
      const viewportHeight = window.innerHeight;
      const halfViewport = (viewportHeight - 100) * 0.5;
      const tableHeight = container.scrollHeight;
      setUseAutoHeight(tableHeight > halfViewport);
    };

    checkTableHeight();
    const resizeObserver = new ResizeObserver(checkTableHeight);
    resizeObserver.observe(tableContainerRef.current);
    return () => resizeObserver.disconnect();
  }, [selectedResource, loading]);

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
      const previous = navigationHistory.at(-1);
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

  const columns = [
    {
      header: 'Name',
      accessor: 'name',
      minWidth: '200px',
    },
    {
      header: 'Kind',
      accessor: 'kind',
      minWidth: '180px',
    },
    {
      header: 'Status',
      accessor: 'conditions',
      minWidth: '120px',
      render: (row) => {
        const color = getStatusColor(row.conditions, row.kind);
        const text = getStatusText(row.conditions, row.kind);
        return (
          <HStack spacing={2}>
            <Box w="8px" h="8px" borderRadius="full" bg={`${color}.400`} />
            <Text fontSize="sm">{text}</Text>
          </HStack>
        );
      },
    },
    {
      header: 'Created',
      accessor: 'creationTimestamp',
      minWidth: '150px',
      render: (row) => row.creationTimestamp ? new Date(row.creationTimestamp).toLocaleString() : '-',
    },
  ];

  return (
    <Box display="flex" flexDirection="column" position="relative">
      <HStack justify="space-between" mb={6}>
        <Text fontSize="2xl" fontWeight="bold">Policies</Text>
      </HStack>

      <Box display="flex" flexDirection="column" gap={4}>
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
            fetchData={fetchPolicies}
            serverSidePagination={true}
            loading={loading}
          />
        </Box>

        {selectedResource && (
          <Box flex="1" display="flex" flexDirection="column" mb={8}>
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
