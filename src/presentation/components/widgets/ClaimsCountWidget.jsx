import { Text, Spinner } from '@chakra-ui/react';
import { useContext } from 'react';
import { DashboardDataContext } from '../../hooks/useDashboardData.js';
import { Container } from '../common/Container.jsx';

export const ClaimsCountWidget = () => {
  const { claims: { items: claims, loading, error } } = useContext(DashboardDataContext);

  const count = (claims || []).length;

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
        <Text fontSize="sm" color="gray.600" mb={2}>Claims</Text>
        <Text fontSize="sm" color="red.500">Error loading</Text>
      </Container>
    );
  }

  return (
    <Container p={6}>
      <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={3}>Claims</Text>
      <Text fontSize="3xl" fontWeight="bold" color="gray.900" _dark={{ color: 'gray.100' }} mb={1}>{count || 0}</Text>
      <Text fontSize="xs" color="gray.500" _dark={{ color: 'gray.500' }}>Total claims</Text>
    </Container>
  );
};
