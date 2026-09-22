import { Box, Text, VStack, HStack, Spinner } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { GetCompositeResourcesUseCase } from '../../../domain/usecases/GetCompositeResourcesUseCase.js';
import { GetClaimsUseCase } from '../../../domain/usecases/GetClaimsUseCase.js';
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
  const { kubernetesRepository, selectedContext } = useAppContext();
  const [namespaceData, setNamespaceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      if (!selectedContext) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const contextName = typeof selectedContext === 'string' 
          ? selectedContext 
          : selectedContext.name || selectedContext;
        
        // No limit: the distribution has to be counted over every composite
        // resource and claim. A limit here would truncate the newest N items
        // (the use cases sort by creationTimestamp descending) and report the
        // namespaces of that sample as if they were the whole cluster.
        const [compositeData, claimsData] = await Promise.all([
          new GetCompositeResourcesUseCase(kubernetesRepository)
            .execute(contextName, null, null)
            .catch(() => ({ items: [] })),
          new GetClaimsUseCase(kubernetesRepository)
            .execute(contextName, null, null)
            .catch(() => ({ items: [] })),
        ]);
        
        // Reduce to per-namespace counts before storing. Keeping the resources
        // themselves in state would retain every composite resource and claim
        // in memory for as long as the dashboard is open, for a widget that
        // only ever renders five numbers.
        setNamespaceData(countByNamespace(
          Array.isArray(compositeData) ? compositeData : (compositeData?.items || []),
          Array.isArray(claimsData) ? claimsData : (claimsData?.items || []),
        ));
      } catch (err) {
        console.warn('Failed to fetch namespace data:', err.message);
        setError(err.message);
        setNamespaceData([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedContext, kubernetesRepository]);

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

