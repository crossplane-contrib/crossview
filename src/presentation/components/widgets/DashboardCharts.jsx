import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { useId } from 'react';
import PropTypes from 'prop-types';
import { getAccentColor, getStatusColor } from '../../utils/theme.js';

const STATUSES = [
  { key: 'ready', label: 'Ready', color: getStatusColor('green') },
  { key: 'notReady', label: 'Not ready', color: getStatusColor('red') },
  { key: 'unknown', label: 'Unknown', color: getStatusColor('gray') },
];
const SERIES = [
  { key: 'compositeResources', label: 'Composite resources', color: getAccentColor('blue') },
  { key: 'claims', label: 'Claims', color: getAccentColor('purple', 'medium') },
  { key: 'managedResources', label: 'Managed resources', color: getStatusColor('cyan') },
];

const Legend = ({ entries }) => (
  <HStack flexWrap="wrap" gap={4} fontSize="xs">
    {entries.map(({ label, color }) => (
      <HStack key={label} gap={2}>
        <Box w={2.5} h={2.5} borderRadius="full" bg={color} />
        <Text>{label}</Text>
      </HStack>
    ))}
  </HStack>
);

Legend.propTypes = { entries: PropTypes.arrayOf(PropTypes.shape({
  label: PropTypes.string.isRequired, color: PropTypes.string.isRequired,
})).isRequired };

export const ReadinessChart = ({ health }) => {
  const titleId = useId();
  const total = STATUSES.reduce((sum, entry) => sum + health[entry.key], 0);
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <HStack gap={6} flexWrap="wrap" justify="center" py={4}>
      <Box w="190px" flexShrink={0}>
        <svg viewBox="0 0 190 190" role="img" aria-labelledby={titleId} width="100%">
          <title id={titleId}>{`Resource readiness: ${health.ready} ready, ${health.notReady} not ready, ${health.unknown} unknown`}</title>
          <circle cx="95" cy="95" r={radius} fill="none" stroke="currentColor" opacity="0.1" strokeWidth="18" />
          {STATUSES.map(({ key, label, color }) => {
            const length = total ? health[key] / total * circumference : 0;
            const currentOffset = offset;
            offset += length;
            if (!length) return null;
            return (
              <circle key={key} cx="95" cy="95" r={radius} fill="none" stroke={color}
                strokeWidth="18" strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-currentOffset} transform="rotate(-90 95 95)" tabIndex={0}>
                <title>{`${label}: ${health[key]} (${Math.round(health[key] / total * 100)}%)`}</title>
              </circle>
            );
          })}
          <text x="95" y="94" textAnchor="middle" fill="currentColor" fontSize="30" fontWeight="700">
            {total ? `${Math.round(health.ready / total * 100)}%` : 'N/A'}
          </text>
          <text x="95" y="116" textAnchor="middle" fill="currentColor" fontSize="12">ready</text>
        </svg>
      </Box>
      <VStack align="stretch" gap={4} flex={1} minW="130px">
        {STATUSES.map(({ key, label, color }) => (
          <HStack key={key} justify="space-between">
            <HStack gap={2}><Box w={2.5} h={2.5} borderRadius="full" bg={color} /><Text fontSize="sm">{label}</Text></HStack>
            <Text fontWeight="semibold" fontVariantNumeric="tabular-nums">{health[key].toLocaleString()}</Text>
          </HStack>
        ))}
        <HStack justify="space-between" pt={2} borderTop="1px solid" borderColor="currentColor">
          <Text fontSize="sm">Loaded resources</Text><Text fontWeight="bold">{total.toLocaleString()}</Text>
        </HStack>
      </VStack>
    </HStack>
  );
};

ReadinessChart.propTypes = { health: PropTypes.shape({
  ready: PropTypes.number.isRequired, notReady: PropTypes.number.isRequired, unknown: PropTypes.number.isRequired,
}).isRequired };

export const NamespaceChart = ({ namespaces }) => {
  const visible = namespaces.slice(0, 6);
  const maximum = Math.max(1, ...visible.map(entry => entry.total));
  return (
    <VStack align="stretch" gap={4} py={3}>
      {visible.length === 0 && <Text fontSize="sm">No resources in the loaded snapshot.</Text>}
      {visible.map(entry => (
        <Box key={entry.label}>
          <HStack justify="space-between" mb={1.5}>
            <Text fontSize="sm" truncate title={entry.label}>{entry.label}</Text>
            <Text fontSize="sm" fontWeight="semibold">{entry.total.toLocaleString()}</Text>
          </HStack>
          <svg viewBox="0 0 500 14" role="img" aria-label={`${entry.label}: ${entry.ready} ready, ${entry.notReady} not ready, ${entry.unknown} unknown`} width="100%" height="14">
            <rect width="500" height="14" rx="4" fill="currentColor" opacity="0.06" />
            {STATUSES.map(({ key, label, color }, index) => {
              const x = STATUSES.slice(0, index).reduce((sum, status) => sum + entry[status.key], 0) / maximum * 500;
              return <rect key={key} x={x} width={entry[key] / maximum * 500} height="14" fill={color}>
                <title>{`${entry.label} - ${label}: ${entry[key]}`}</title>
              </rect>;
            })}
          </svg>
        </Box>
      ))}
      {visible.length > 0 && <Legend entries={STATUSES} />}
      {namespaces.length > 6 && <Text fontSize="xs">Showing 6 of {namespaces.length} namespaces, ordered by resource count.</Text>}
    </VStack>
  );
};

NamespaceChart.propTypes = { namespaces: PropTypes.arrayOf(PropTypes.shape({
  label: PropTypes.string.isRequired, total: PropTypes.number.isRequired,
  ready: PropTypes.number.isRequired, notReady: PropTypes.number.isRequired, unknown: PropTypes.number.isRequired,
})).isRequired };

export const CreationChart = ({ activity }) => {
  const titleId = useId();
  const totals = activity.map(day => SERIES.reduce((sum, series) => sum + day[series.key], 0));
  const maximum = Math.max(4, ...totals);
  const ceiling = Math.ceil(maximum / 4) * 4;
  const step = 620 / activity.length;
  return (
    <Box>
      <svg viewBox="0 0 700 240" role="img" aria-labelledby={titleId} width="100%">
        <title id={titleId}>{`Resource creation by UTC day. ${activity.map((day, index) => `${day.date}: ${totals[index]}`).join(', ')}`}</title>
        {[0, 1, 2, 3, 4].map(tick => (
          <g key={tick}>
            <line x1="48" x2="675" y1={190 - tick * 40} y2={190 - tick * 40} stroke="currentColor" opacity="0.1" />
            <text x="38" y={194 - tick * 40} textAnchor="end" fill="currentColor" fontSize="11">{ceiling * tick / 4}</text>
          </g>
        ))}
        {activity.map((day, index) => (
          <g key={day.date} tabIndex={0} role="img" aria-label={`${day.date}: ${SERIES.map(series => `${day[series.key]} ${series.label}`).join(', ')}`}>
            <title>{`${day.date} UTC\n${SERIES.map(series => `${series.label}: ${day[series.key]}`).join('\n')}`}</title>
            <rect x={50 + index * step} y="30" width={step - 5} height="160" fill="transparent" />
            {SERIES.map(({ key, color }, seriesIndex) => {
              const previous = SERIES.slice(0, seriesIndex).reduce((sum, series) => sum + day[series.key], 0);
              const height = day[key] / ceiling * 160;
              return <rect key={key} x={50 + index * step} y={190 - previous / ceiling * 160 - height}
                width={step - 5} height={height} fill={color} rx="2" />;
            })}
            {(index % Math.ceil(activity.length / 7) === 0 || index === activity.length - 1) && (
              <text x={50 + index * step + (step - 5) / 2} y="214" textAnchor="middle" fill="currentColor" fontSize="11">{day.date.slice(5)}</text>
            )}
          </g>
        ))}
      </svg>
      <Legend entries={SERIES} />
      {totals.every(total => total === 0) && <Text fontSize="sm" mt={3}>No surviving resources were created during this period.</Text>}
    </Box>
  );
};

CreationChart.propTypes = { activity: PropTypes.arrayOf(PropTypes.shape({
  date: PropTypes.string.isRequired, compositeResources: PropTypes.number.isRequired,
  claims: PropTypes.number.isRequired, managedResources: PropTypes.number.isRequired,
})).isRequired };
