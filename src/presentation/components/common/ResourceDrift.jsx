import { Box, Text, HStack, VStack, Badge } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { getBackgroundColor, getBorderColor, getTextColor } from '../../utils/theme.js';

export const ResourceDrift = ({ resource, fullResource }) => {
  const { selectedContext, colorMode } = useAppContext();
  const [drift, setDrift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDrift = async () => {
      if (!resource || !selectedContext) return;

      setLoading(true);
      setError(null);

      try {
        const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;
        const apiVersion = fullResource?.apiVersion || resource.apiVersion;
        const kind = fullResource?.kind || resource.kind;
        const name = resource.name || fullResource?.metadata?.name;
        const namespace = resource.namespace || fullResource?.metadata?.namespace;

        const params = new URLSearchParams({ apiVersion, kind, name, context: contextName });
        if (namespace && namespace !== 'undefined' && namespace !== 'null') {
          params.set('namespace', namespace);
        }

        const response = await fetch(`/api/resource/drift?${params}`);
        if (!response.ok) throw new Error('Failed to fetch drift data');
        const data = await response.json();
        setDrift(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDrift();
  }, [resource, fullResource, selectedContext]);

  if (loading) {
    return (
      <Box p={4} display="flex" justifyContent="center">
        <Text color={getTextColor(colorMode, 'secondary')}>Analyzing drift...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4}>
        <Text color="red.500">Failed to analyze drift: {error}</Text>
      </Box>
    );
  }

  if (!drift) return null;

  return (
    <Box p={4}>
      <VStack spacing={4} align="stretch">
        <HStack spacing={3} align="center">
          <Box
            w="12px"
            h="12px"
            borderRadius="full"
            bg={drift.hasDrift ? 'red.400' : 'green.400'}
          />
          <Text fontSize="lg" fontWeight="bold" color={getTextColor(colorMode, 'primary')}>
            {drift.hasDrift ? 'Drift Detected' : 'No Drift'}
          </Text>
        </HStack>

        <Text fontSize="sm" color={getTextColor(colorMode, 'secondary')}>
          {drift.driftSummary}
        </Text>

        {drift.syncedCondition && (
          <Box
            p={3}
            borderRadius="md"
            bg={getBackgroundColor(colorMode, 'secondary')}
            border="1px solid"
            borderColor={getBorderColor(colorMode)}
          >
            <HStack spacing={2} mb={1}>
              <Text fontSize="sm" fontWeight="semibold" color={getTextColor(colorMode, 'primary')}>
                Synced
              </Text>
              <Badge colorScheme={drift.syncedCondition.status === 'True' ? 'green' : 'red'}>
                {drift.syncedCondition.status}
              </Badge>
            </HStack>
            {drift.syncedCondition.reason && (
              <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')}>
                {drift.syncedCondition.reason}: {drift.syncedCondition.message}
              </Text>
            )}
          </Box>
        )}

        {drift.readyCondition && (
          <Box
            p={3}
            borderRadius="md"
            bg={getBackgroundColor(colorMode, 'secondary')}
            border="1px solid"
            borderColor={getBorderColor(colorMode)}
          >
            <HStack spacing={2} mb={1}>
              <Text fontSize="sm" fontWeight="semibold" color={getTextColor(colorMode, 'primary')}>
                Ready
              </Text>
              <Badge colorScheme={drift.readyCondition.status === 'True' ? 'green' : 'red'}>
                {drift.readyCondition.status}
              </Badge>
            </HStack>
            {drift.readyCondition.reason && (
              <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')}>
                {drift.readyCondition.reason}: {drift.readyCondition.message}
              </Text>
            )}
          </Box>
        )}

        {drift.fieldDiffs && drift.fieldDiffs.length > 0 && (
          <Box>
            <Text fontSize="sm" fontWeight="semibold" color={getTextColor(colorMode, 'primary')} mb={2}>
              Field Differences ({drift.fieldDiffs.length})
            </Text>
            <VStack spacing={2} align="stretch">
              {drift.fieldDiffs.map((diff, idx) => (
                <Box
                  key={idx}
                  p={3}
                  borderRadius="md"
                  bg={getBackgroundColor(colorMode, 'secondary')}
                  border="1px solid"
                  borderColor={getBorderColor(colorMode)}
                >
                  <Text fontSize="xs" fontWeight="semibold" fontFamily="mono" color={getTextColor(colorMode, 'primary')} mb={1}>
                    {diff.path}
                  </Text>
                  <HStack spacing={4}>
                    <Box flex={1}>
                      <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')}>Desired</Text>
                      <Text fontSize="xs" fontFamily="mono" color="green.500">
                        {JSON.stringify(diff.desired)}
                      </Text>
                    </Box>
                    <Box flex={1}>
                      <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')}>Actual</Text>
                      <Text fontSize="xs" fontFamily="mono" color="red.500">
                        {JSON.stringify(diff.actual)}
                      </Text>
                    </Box>
                  </HStack>
                </Box>
              ))}
            </VStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
};
