import { Box, Text, VStack, HStack, Badge } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { getBackgroundColor, getBorderColor, getTextColor } from '../../utils/theme.js';

export const ResourceHistory = ({ resource, fullResource }) => {
  const { selectedContext, colorMode } = useAppContext();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!resource || !selectedContext) return;

      setLoading(true);
      setError(null);

      try {
        const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;
        const apiVersion = fullResource?.apiVersion || resource.apiVersion;
        const kind = fullResource?.kind || resource.kind;
        const name = resource.name || fullResource?.metadata?.name;
        const namespace = resource.namespace || fullResource?.metadata?.namespace;

        const params = new URLSearchParams({ apiVersion, kind, name, context: contextName, limit: '50' });
        if (namespace && namespace !== 'undefined' && namespace !== 'null') {
          params.set('namespace', namespace);
        }

        const response = await fetch(`/api/resource/history?${params}`);
        if (!response.ok) {
          if (response.status === 501) {
            setError('History tracking requires database to be enabled');
            return;
          }
          throw new Error('Failed to fetch history');
        }
        const data = await response.json();
        setHistory(data.events || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [resource, fullResource, selectedContext]);

  if (loading) {
    return (
      <Box p={4} display="flex" justifyContent="center">
        <Text color={getTextColor(colorMode, 'secondary')}>Loading history...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Text color={getTextColor(colorMode, 'secondary')}>{error}</Text>
      </Box>
    );
  }

  if (history.length === 0) {
    return (
      <Box p={4} display="flex" justifyContent="center">
        <Text color={getTextColor(colorMode, 'secondary')}>No history recorded yet</Text>
      </Box>
    );
  }

  const getEventColor = (eventType) => {
    switch (eventType) {
      case 'created': return 'green';
      case 'updated': return 'blue';
      case 'deleted': return 'red';
      default: return 'gray';
    }
  };

  return (
    <Box p={4}>
      <VStack spacing={3} align="stretch">
        {history.map((event, idx) => (
          <Box
            key={event.id || idx}
            p={3}
            borderRadius="md"
            bg={getBackgroundColor(colorMode, 'secondary')}
            border="1px solid"
            borderColor={getBorderColor(colorMode)}
            position="relative"
          >
            {idx < history.length - 1 && (
              <Box
                position="absolute"
                left="22px"
                top="40px"
                bottom="-16px"
                w="2px"
                bg={getBorderColor(colorMode)}
              />
            )}
            <HStack spacing={3} align="flex-start">
              <Box
                w="10px"
                h="10px"
                borderRadius="full"
                bg={`${getEventColor(event.eventType)}.400`}
                mt="6px"
                flexShrink={0}
              />
              <Box flex={1}>
                <HStack spacing={2} mb={1}>
                  <Badge colorScheme={getEventColor(event.eventType)} fontSize="xs">
                    {event.eventType}
                  </Badge>
                  <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')}>
                    {new Date(event.createdAt).toLocaleString()}
                  </Text>
                </HStack>
                <Text fontSize="sm" color={getTextColor(colorMode, 'primary')}>
                  {event.kind}/{event.name}
                </Text>
              </Box>
            </HStack>
          </Box>
        ))}
      </VStack>
    </Box>
  );
};
