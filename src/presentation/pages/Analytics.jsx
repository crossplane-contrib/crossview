import {
  Box,
  Text,
  HStack,
  VStack,
} from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useAppContext } from '../providers/AppProvider.jsx';
import { getBackgroundColor, getBorderColor, getTextColor } from '../utils/theme.js';

export const Analytics = () => {
  const { selectedContext, colorMode } = useAppContext();
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedContext) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;

        const [summaryRes, trendRes] = await Promise.all([
          fetch(`/api/metrics/summary?context=${contextName}`),
          fetch(`/api/metrics/health-trend?context=${contextName}`),
        ]);

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
        }

        if (trendRes.ok) {
          const trendData = await trendRes.json();
          setTrend(trendData.metrics || []);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedContext]);

  if (!selectedContext) {
    return (
      <Box p={8} textAlign="center">
        <Text color={getTextColor(colorMode, 'secondary')}>Select a Kubernetes context to view analytics</Text>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box p={8} textAlign="center">
        <Text color={getTextColor(colorMode, 'secondary')}>Loading analytics...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={8}>
        <Text color="red.500">{error}</Text>
      </Box>
    );
  }

  const healthPercent = summary && summary.totalResources > 0
    ? Math.round((summary.healthyCount / summary.totalResources) * 100)
    : 0;

  return (
    <Box display="flex" flexDirection="column">
      <HStack justify="space-between" mb={6}>
        <Text fontSize="2xl" fontWeight="bold">Analytics</Text>
      </HStack>

      <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap={4} mb={6}>
        <StatCard
          label="Total Resources"
          value={summary?.totalResources ?? '-'}
          colorMode={colorMode}
        />
        <StatCard
          label="Healthy"
          value={summary?.healthyCount ?? '-'}
          color="green.500"
          colorMode={colorMode}
        />
        <StatCard
          label="Degraded"
          value={summary?.degradedCount ?? '-'}
          color="red.500"
          colorMode={colorMode}
        />
        <StatCard
          label="Health"
          value={summary ? `${healthPercent}%` : '-'}
          color={healthPercent >= 80 ? 'green.500' : healthPercent >= 50 ? 'yellow.500' : 'red.500'}
          colorMode={colorMode}
        />
        <StatCard
          label="Synced"
          value={summary?.syncedCount ?? '-'}
          color="blue.500"
          colorMode={colorMode}
        />
        <StatCard
          label="Unsynced"
          value={summary?.unsyncedCount ?? '-'}
          color="orange.500"
          colorMode={colorMode}
        />
      </Box>

      {trend.length > 0 ? (
        <Box
          p={4}
          borderRadius="md"
          bg={getBackgroundColor(colorMode, 'header')}
          border="1px solid"
          borderColor={getBorderColor(colorMode)}
        >
          <Text fontSize="md" fontWeight="semibold" mb={3} color={getTextColor(colorMode, 'primary')}>
            Health Trend (Last 24h)
          </Text>
          <VStack spacing={2} align="stretch">
            {trend.map((m, idx) => {
              const total = m.totalResources || 1;
              const pct = Math.round((m.healthyCount / total) * 100);
              return (
                <HStack key={idx} spacing={3}>
                  <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')} minW="140px">
                    {new Date(m.timestamp).toLocaleString()}
                  </Text>
                  <Box flex={1} bg={getBorderColor(colorMode)} borderRadius="full" h="8px">
                    <Box
                      h="8px"
                      borderRadius="full"
                      bg={pct >= 80 ? 'green.400' : pct >= 50 ? 'yellow.400' : 'red.400'}
                      w={`${pct}%`}
                      transition="width 0.3s"
                    />
                  </Box>
                  <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')} minW="40px" textAlign="right">
                    {pct}%
                  </Text>
                </HStack>
              );
            })}
          </VStack>
        </Box>
      ) : (
        <Box
          p={6}
          borderRadius="md"
          bg={getBackgroundColor(colorMode, 'header')}
          border="1px solid"
          borderColor={getBorderColor(colorMode)}
          textAlign="center"
        >
          <Text color={getTextColor(colorMode, 'secondary')}>
            No trend data yet. Metrics are collected periodically when the database is enabled.
          </Text>
        </Box>
      )}
    </Box>
  );
};

const StatCard = ({ label, value, color, colorMode }) => (
  <Box
    p={4}
    borderRadius="md"
    bg={getBackgroundColor(colorMode, 'header')}
    border="1px solid"
    borderColor={getBorderColor(colorMode)}
  >
    <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')} mb={1}>{label}</Text>
    <Text fontSize="2xl" fontWeight="bold" color={color || getTextColor(colorMode, 'primary')}>{value}</Text>
  </Box>
);
