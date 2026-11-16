import { Box, Text, VStack, HStack, Spinner } from '@chakra-ui/react';
import { useContext, useMemo } from 'react';
import { DashboardDataContext } from '../../hooks/useDashboardData.js';
import { Container } from '../common/Container.jsx';

const summarizeHealth = (compositeResources, claims) => {
  let ready = 0;
  let notReady = 0;
  let unknown = 0;

  [...compositeResources, ...claims].forEach(resource => {
    const conditions = resource.conditions || [];
    const readyCondition = conditions.find(c => c.type === 'Ready' || c.type === 'Synced');
    
    if (readyCondition) {
      if (readyCondition.status === 'True') {
        ready++;
      } else {
        notReady++;
      }
    } else if (conditions.length > 0) {
      const trueCondition = conditions.find(c => c.status === 'True');
      if (trueCondition) {
        ready++;
      } else {
        unknown++;
      }
    } else {
      unknown++;
    }
  });

  const total = ready + notReady + unknown;
  const healthPercentage = total > 0 ? Math.round((ready / total) * 100) : 0;

  return { ready, notReady, unknown, total, healthPercentage };
};

export const ResourceHealthWidget = () => {
  const { compositeResources, claims } = useContext(DashboardDataContext);
  const loading = compositeResources.loading || claims.loading;
  const error = compositeResources.error || claims.error;
  const health = useMemo(
    () => summarizeHealth(compositeResources.items, claims.items),
    [compositeResources.items, claims.items],
  );

  const getHealthColor = (percentage) => {
    if (percentage >= 80) return 'green';
    if (percentage >= 50) return 'yellow';
    return 'red';
  };

  const healthColor = getHealthColor(health?.healthPercentage || 0);

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
        <Text fontSize="lg" fontWeight="bold" mb={4}>Resource Health</Text>
        <Text fontSize="sm" color="red.500">Error loading</Text>
      </Container>
    );
  }

  const percentage = health?.healthPercentage || 0;

  return (
    <Container p={6}>
      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={4} fontWeight="medium">Resource Health</Text>
      
      <VStack spacing={4} align="stretch">
        <Box>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>Overall Health</Text>
            <Text fontSize="lg" fontWeight="bold" color={`${healthColor}.600`} _dark={{ color: `${healthColor}.400` }}>
              {percentage}%
            </Text>
          </HStack>
          <Box
            w="100%"
            h="12px"
            bg="gray.200"
            _dark={{ bg: 'gray.700' }}
            borderRadius="full"
            overflow="hidden"
          >
            <Box
              h="100%"
              bg={`${healthColor}.500`}
              _dark={{ bg: `${healthColor}.400` }}
              width={`${percentage}%`}
              transition="width 0.3s ease"
              borderRadius="full"
            />
          </Box>
        </Box>

        <VStack align="stretch" spacing={2}>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Box w={2} h={2} borderRadius="full" bg="green.500" />
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>Ready</Text>
            </HStack>
            <Text fontSize="sm" fontWeight="medium" color="gray.900" _dark={{ color: 'gray.100' }}>{health?.ready || 0}</Text>
          </HStack>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Box w={2} h={2} borderRadius="full" bg="red.500" />
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>Not Ready</Text>
            </HStack>
            <Text fontSize="sm" fontWeight="medium" color="gray.900" _dark={{ color: 'gray.100' }}>{health?.notReady || 0}</Text>
          </HStack>
          <HStack justify="space-between">
            <HStack spacing={2}>
              <Box w={2} h={2} borderRadius="full" bg="gray.400" />
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>Unknown</Text>
            </HStack>
            <Text fontSize="sm" fontWeight="medium" color="gray.900" _dark={{ color: 'gray.100' }}>{health?.unknown || 0}</Text>
          </HStack>
          <Box pt={2} borderTop="1px solid" borderColor="gray.200" _dark={{ borderColor: 'gray.700' }}>
            <HStack justify="space-between">
              <Text fontSize="sm" fontWeight="medium" color="gray.600" _dark={{ color: 'gray.400' }}>Total</Text>
              <Text fontSize="sm" fontWeight="bold" color="gray.900" _dark={{ color: 'gray.100' }}>{health?.total || 0}</Text>
            </HStack>
          </Box>
        </VStack>
      </VStack>
    </Container>
  );
};
