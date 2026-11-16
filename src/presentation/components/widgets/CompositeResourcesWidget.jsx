import { Box, Text, Spinner, HStack } from '@chakra-ui/react';
import { useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DashboardDataContext } from '../../hooks/useDashboardData.js';
import { Container } from '../common/Container.jsx';
import { DataTable } from '../common/DataTable.jsx';
import { getStatusColor, getStatusText, getSyncedStatus, getReadyStatus, getResponsiveStatus } from '../../utils/resourceStatus.js';

export const CompositeResourcesWidget = ({ onResourceClick }) => {
  const { compositeResources: { items: compositeResources, loading, error } } = useContext(DashboardDataContext);

  const resources = useMemo(() => {
    // Sort by creation timestamp and take the 10 most recent
    return (compositeResources || [])
      .filter(r => r.creationTimestamp)
      .sort((a, b) => new Date(b.creationTimestamp) - new Date(a.creationTimestamp))
      .slice(0, 10);
  }, [compositeResources]);


  const columns = [
    {
      header: 'Name',
      accessor: 'name',
      minWidth: '200px',
    },
    {
      header: 'Kind',
      accessor: 'kind',
      minWidth: '150px',
    },
    {
      header: 'Status',
      accessor: 'status',
      minWidth: '160px',
      render: (row) => {
        const syncedStatus = getSyncedStatus(row.conditions);
        const readyStatus = getReadyStatus(row.conditions);
        const responsiveStatus = getResponsiveStatus(row.conditions);
        const statusText = getStatusText(row.conditions);
        
        const statusBadges = [syncedStatus, readyStatus, responsiveStatus].filter(Boolean);
        
        if (statusBadges.length > 0) {
          return (
            <HStack spacing={2}>
              {statusBadges.map((status, idx) => (
                <Box
                  key={idx}
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
              ))}
            </HStack>
          );
        }
        
        const statusColor = getStatusColor(row.conditions);
        return (
          <Box
            as="span"
            display="inline-block"
            px={2}
            py={1}
            borderRadius="md"
            fontSize="xs"
            fontWeight="semibold"
            bg={`${statusColor}.100`}
            _dark={{ bg: `${statusColor}.800`, color: `${statusColor}.100` }}
            color={`${statusColor}.800`}
          >
            {statusText}
          </Box>
        );
      },
    },
    {
      header: 'Composition',
      accessor: 'compositionRef',
      minWidth: '150px',
      render: (row) => row.compositionRef?.name || '-',
    },
    {
      header: 'Created',
      accessor: 'creationTimestamp',
      minWidth: '150px',
      render: (row) => row.creationTimestamp ? new Date(row.creationTimestamp).toLocaleString() : '-',
    },
  ];

  const handleRowClick = (item) => {
    const clickedResource = {
      apiVersion: item.apiVersion,
      kind: item.kind,
      name: item.name,
      namespace: item.namespace || null,
    };

    if (onResourceClick) {
      onResourceClick(clickedResource);
    }
  };

  if (loading) {
    return (
      <Container p={6} h="100%" display="flex" justifyContent="center" alignItems="center" minH="200px">
        <Spinner size="md" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container p={6} h="100%" display="flex" flexDirection="column">
        <Text fontSize="lg" fontWeight="bold" mb={4}>Recent Composite Resources</Text>
        <Text fontSize="sm" color="red.500">Error loading</Text>
      </Container>
    );
  }

  return (
    <Container p={6} h="100%" display="flex" flexDirection="column">
      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={4} fontWeight="medium">Recent Composite Resources</Text>
      {resources.length > 0 ? (
        <Box flex={1} minH={0} display="flex" flexDirection="column">
          <DataTable
            data={resources}
            columns={columns}
            searchableFields={['name', 'kind', 'compositionRef.name']}
            itemsPerPage={5}
            onRowClick={handleRowClick}
          />
            </Box>
      ) : (
        <Text color="gray.500" _dark={{ color: 'gray.500' }} fontSize="sm">No composite resources found</Text>
      )}
    </Container>
  );
};

CompositeResourcesWidget.propTypes = {
  onResourceClick: PropTypes.func,
};
