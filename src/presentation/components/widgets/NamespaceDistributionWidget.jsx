import { Box, Text, VStack, HStack, Spinner } from '@chakra-ui/react';
import { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { GetCompositeResourcesUseCase } from '../../../domain/usecases/GetCompositeResourcesUseCase.js';
import { GetClaimsUseCase } from '../../../domain/usecases/GetClaimsUseCase.js';
import { Container } from '../common/Container.jsx';

export const NamespaceDistributionWidget = () => {
  const { kubernetesRepository, selectedContext } = useAppContext();
  const [compositeResources, setCompositeResources] = useState([]);
  const [claims, setClaims] = useState([]);
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
        
        const [compositeData, claimsData] = await Promise.all([
          new GetCompositeResourcesUseCase(kubernetesRepository)
            .execute(contextName, 100, null)
            .catch(() => ({ items: [] })),
          new GetClaimsUseCase(kubernetesRepository)
            .execute(contextName, 100, null)
            .catch(() => ({ items: [] })),
        ]);
        
        setCompositeResources(Array.isArray(compositeData) ? compositeData : (compositeData?.items || []));
        setClaims(Array.isArray(claimsData) ? claimsData : (claimsData?.items || []));
      } catch (err) {
        console.warn('Failed to fetch namespace data:', err.message);
        setError(err.message);
        setCompositeResources([]);
        setClaims([]);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedContext, kubernetesRepository]);

  const namespaceData = useMemo(() => {
    const allResources = [...compositeResources, ...claims];
    const namespaceMap = {};
    
    allResources.forEach(resource => {
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
  }, [compositeResources, claims]);

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

