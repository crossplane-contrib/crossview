import { Text, VStack, HStack, Spinner } from '@chakra-ui/react';
import { useContext, useMemo } from 'react';
import { DashboardDataContext } from '../../hooks/useDashboardData.js';
import { Container } from '../common/Container.jsx';

const countByNamespace = (compositeResources, claims) => {
  const namespaceMap = {};
  
  [...compositeResources, ...claims].forEach(resource => {
    const ns = resource.namespace || '(none)';
    if (!namespaceMap[ns]) {
      namespaceMap[ns] = 0;
    }
    namespaceMap[ns]++;
  });
  
  return Object.entries(namespaceMap)
    .map(([namespace, count]) => ({ namespace, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
};

export const NamespaceDistributionWidget = () => {
  const { compositeResources, claims } = useContext(DashboardDataContext);
  const loading = compositeResources.loading || claims.loading;
  const error = compositeResources.error || claims.error;
  const namespaceData = useMemo(
    () => countByNamespace(compositeResources.items, claims.items),
    [compositeResources.items, claims.items],
  );

  if (loading) {
    return (
      <Container p={6} display="flex" justifyContent="center" alignItems="center" minH="200px">
        <Spinner size="md" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container p={6}>
        <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={4} fontWeight="medium">Namespace Distribution</Text>
        <Text fontSize="sm" color="red.500">Error loading</Text>
      </Container>
    );
  }

  return (
    <Container p={6}>
      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={4} fontWeight="medium">Top Namespaces</Text>
      <VStack align="stretch" spacing={3}>
        {namespaceData.length > 0 ? (
          namespaceData.map(({ namespace, count }) => (
            <HStack key={namespace} justify="space-between">
              <Text fontSize="sm" color="gray.700" _dark={{ color: 'gray.300' }} isTruncated maxW="70%">
                {namespace}
              </Text>
              <Text fontSize="sm" fontWeight="semibold" color="gray.900" _dark={{ color: 'gray.100' }}>
                {count}
              </Text>
            </HStack>
          ))
        ) : (
          <Text fontSize="sm" color="gray.500" _dark={{ color: 'gray.500' }}>No resources found</Text>
        )}
      </VStack>
    </Container>
  );
};
