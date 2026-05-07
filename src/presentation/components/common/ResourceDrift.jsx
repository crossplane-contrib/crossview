import { Box, Text, Badge, HStack, Grid } from '@chakra-ui/react';
import { useMemo } from 'react';
import { FiGitMerge, FiAlertCircle } from 'react-icons/fi';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import YAML from 'yaml';
import { getDriftEntries } from '../../utils/driftUtils.js';
import { crossviewMirrorTheme } from '../../utils/crossviewMirrorTheme.js';
import { getBackgroundColor, getBorderColor, getTextColor } from '../../utils/theme.js';
import { useAppContext } from '../../providers/AppProvider.jsx';

function sortKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sortKeys(obj[k]); return acc; }, {});
  }
  return obj;
}

function PlanView({ forProvider, atProvider, colorMode }) {
  const isDark = colorMode === 'dark';

  const forYaml = useMemo(
    () => YAML.stringify(sortKeys(forProvider || {}), { indent: 2, simpleKeys: true }),
    [forProvider]
  );
  const atYaml = useMemo(
    () => YAML.stringify(sortKeys(atProvider || {}), { indent: 2, simpleKeys: true }),
    [atProvider]
  );

  return (
    <Grid templateColumns="1fr 1fr" gap={4}>
      <Box>
        <Text fontSize="xs" fontWeight="semibold" mb={2} fontFamily="mono" color={getTextColor(colorMode, 'secondary')}>
          status.atProvider — current state
        </Text>
        <Box borderRadius="md" overflow="hidden">
          <CodeMirror
            value={atYaml}
            extensions={[yaml()]}
            theme={isDark ? crossviewMirrorTheme : undefined}
            readOnly
            style={{ fontSize: '0.75rem', lineHeight: '1.5' }}
          />
        </Box>
      </Box>
      <Box>
        <Text fontSize="xs" fontWeight="semibold" mb={2} fontFamily="mono" color={getTextColor(colorMode, 'secondary')}>
          spec.forProvider — desired state
        </Text>
        <Box borderRadius="md" overflow="hidden">
          <CodeMirror
            value={forYaml}
            extensions={[yaml()]}
            theme={isDark ? crossviewMirrorTheme : undefined}
            readOnly
            style={{ fontSize: '0.75rem', lineHeight: '1.5' }}
          />
        </Box>
      </Box>
    </Grid>
  );
}

export const ResourceDrift = ({ fullResource }) => {
  const { colorMode } = useAppContext();

  const forProvider = fullResource?.spec?.forProvider;
  const atProvider  = fullResource?.status?.atProvider;
  const entries     = useMemo(() => getDriftEntries(fullResource), [fullResource]);

  if (!forProvider && !atProvider) {
    return (
      <Box p={6} textAlign="center" bg={getBackgroundColor(colorMode, 'secondary')} borderRadius="md" m={4}>
        <Text color={getTextColor(colorMode, 'tertiary')} fontSize="sm">
          This resource does not have <Text as="span" fontFamily="mono">spec.forProvider</Text> or{' '}
          <Text as="span" fontFamily="mono">status.atProvider</Text>. Drift detection is only available for Crossplane managed resources.
        </Text>
      </Box>
    );
  }
  if (!forProvider) {
    return (
      <Box p={6} textAlign="center" bg={getBackgroundColor(colorMode, 'secondary')} borderRadius="md" m={4}>
        <Text color={getTextColor(colorMode, 'tertiary')} fontSize="sm">
          No <Text as="span" fontFamily="mono">spec.forProvider</Text> found.
        </Text>
      </Box>
    );
  }
  if (!atProvider) {
    return (
      <Box p={6} textAlign="center" bg={getBackgroundColor(colorMode, 'secondary')} borderRadius="md" m={4}>
        <Text color={getTextColor(colorMode, 'tertiary')} fontSize="sm">
          No <Text as="span" fontFamily="mono">status.atProvider</Text> yet — resource may still be provisioning.
        </Text>
      </Box>
    );
  }

  const toAdd    = entries.filter(e => e.type === 'removed');
  const changed  = entries.filter(e => e.type === 'changed');
  const realDiff = toAdd.length + changed.length;
  const providerOnlyCount = Object.keys(atProvider).filter(k => !(k in (forProvider || {}))).length;

  return (
    <Box p={4} flex={1} overflowY="auto">
      {/* Summary bar */}
      <Box p={3} mb={4} borderRadius="md" bg={getBackgroundColor(colorMode, 'secondary')} border="1px solid" borderColor={getBorderColor(colorMode)}>
        <HStack spacing={2} flexWrap="wrap" gap={2}>
          {realDiff > 0 ? <FiAlertCircle size={14} color="#dd6b20" /> : <FiGitMerge size={14} color="#38a169" />}
          <Text fontSize="sm" fontWeight="semibold" color={getTextColor(colorMode, 'primary')}>
            {realDiff === 0 ? 'In sync — no drift detected' : `${realDiff} field${realDiff !== 1 ? 's' : ''} differ`}
          </Text>
          {toAdd.length   > 0 && <Badge colorScheme="blue"   fontSize="2xs">{toAdd.length} to add</Badge>}
          {changed.length > 0 && <Badge colorScheme="orange" fontSize="2xs">{changed.length} changed</Badge>}
          {providerOnlyCount > 0 && <Badge colorScheme="gray" fontSize="2xs">{providerOnlyCount} provider-managed</Badge>}
        </HStack>
      </Box>

      <PlanView forProvider={forProvider} atProvider={atProvider} colorMode={colorMode} />
    </Box>
  );
};
