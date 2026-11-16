import { Text, Spinner } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { GetManagedResourcesUseCase } from '../../../domain/usecases/GetManagedResourcesUseCase.js';
import { Container } from '../common/Container.jsx';

export const ManagedResourcesCountWidget = () => {
  const { kubernetesRepository, selectedContext } = useAppContext();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      if (!selectedContext) {
        setCount(0);
        setError(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const contextName = typeof selectedContext === 'string' 
          ? selectedContext 
          : selectedContext.name || selectedContext;
        
        const result = await new GetManagedResourcesUseCase(kubernetesRepository)
          .execute(contextName, null, false, { limit: 1 });
        if (active) setCount(result.totalCount);
      } catch (err) {
        console.warn('Failed to fetch managed resources:', err.message);
        if (active) {
          setError(err.message);
          setCount(0);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => { active = false; };
  }, [selectedContext, kubernetesRepository]);

  if (loading) {
    return (
      <Container p={6} display="flex" justifyContent="center" alignItems="center" minH="120px">
        <Spinner size="md" />
      </Container>
    );
  }

  if (error) {
    return (
      <Container p={6}>
        <Text fontSize="sm" color="gray.600" mb={2}>Managed Resources</Text>
        <Text fontSize="sm" color="red.500">Error loading</Text>
      </Container>
    );
  }

  return (
    <Container p={6}>
      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={3}>Managed Resources</Text>
      <Text fontSize="3xl" fontWeight="bold" color="gray.900" _dark={{ color: 'gray.100' }} mb={1}>{count || 0}</Text>
      <Text fontSize="xs" color="gray.500" _dark={{ color: 'gray.500' }}>Total managed</Text>
    </Container>
  );
};
