import { Box, Text, Badge, HStack } from '@chakra-ui/react';
import { useMemo, useEffect, useRef } from 'react';
import { FiGitMerge, FiAlertCircle } from 'react-icons/fi';
import { EditorView } from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { MergeView } from '@codemirror/merge';
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

function filterToSchema(obj, schema) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const key of Object.keys(schema)) {
    if (!(key in obj)) continue;
    const sv = schema[key];
    const ov = obj[key];
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && ov && typeof ov === 'object' && !Array.isArray(ov)) {
      result[key] = filterToSchema(ov, sv);
    } else {
      result[key] = ov;
    }
  }
  return result;
}

function SplitDiffView({ forProvider, atProvider, colorMode }) {
  const ref = useRef(null);
  const viewRef = useRef(null);
  const isDark = colorMode === 'dark';

  const atYaml = useMemo(
    () => YAML.stringify(sortKeys(filterToSchema(atProvider || {}, forProvider || {})), { indent: 2, simpleKeys: true }),
    [atProvider, forProvider]
  );
  const forYaml = useMemo(
    () => YAML.stringify(sortKeys(forProvider || {}), { indent: 2, simpleKeys: true }),
    [forProvider]
  );

  useEffect(() => {
    if (!ref.current) return;
    if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null; }

    const extensions = [
      yaml(),
      EditorView.lineWrapping,
      EditorView.editable.of(false),
      ...(isDark ? [crossviewMirrorTheme] : []),
      EditorView.theme({ '&': { fontSize: '0.75rem', lineHeight: '1.5' } }),
    ];

    viewRef.current = new MergeView({
      parent: ref.current,
      a: { doc: atYaml, extensions },
      b: { doc: forYaml, extensions },
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { minSize: 4, margin: 2 },
    });

    return () => { if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null; } };
  }, [atYaml, forYaml, isDark]);

  return (
    <Box>
      <HStack mb={2} fontSize="xs" color={getTextColor(colorMode, 'secondary')}>
        <Text fontFamily="mono" fontWeight="semibold" flex={1} textAlign="center">status.atProvider (current)</Text>
        <Text fontFamily="mono" fontWeight="semibold" flex={1} textAlign="center">spec.forProvider (desired)</Text>
      </HStack>
      <Box
        ref={ref}
        borderRadius="md"
        overflow="hidden"
        border="1px solid"
        borderColor={getBorderColor(colorMode)}
        sx={{
          '.cm-mergeView': { width: '100%' },
          '.cm-mergeViewEditor': { flex: 1 },
          '.cm-deletedChunk': { backgroundColor: 'rgba(248,81,73,0.15)' },
          '.cm-deletedChunk .cm-deletedText': { backgroundColor: 'rgba(248,81,73,0.35)' },
          '.cm-changedChunk': { backgroundColor: 'rgba(56,139,253,0.12)' },
          '.cm-changedText': { backgroundColor: 'rgba(56,139,253,0.35)' },
        }}
      />
    </Box>
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
      <Box p={3} mb={4} borderRadius="md" bg={getBackgroundColor(colorMode, 'secondary')} border="1px solid" borderColor={getBorderColor(colorMode)}>
        <HStack spacing={2} flexWrap="wrap" gap={2}>
          {realDiff > 0 ? <FiAlertCircle size={14} color="#dd6b20" /> : <FiGitMerge size={14} color="#38a169" />}
          <Text fontSize="sm" fontWeight="semibold" color={getTextColor(colorMode, 'primary')}>
            {realDiff === 0 ? 'In sync — no drift detected' : `${realDiff} field${realDiff !== 1 ? 's' : ''} differ`}
          </Text>
          {toAdd.length      > 0 && <Badge colorScheme="blue"   fontSize="2xs">{toAdd.length} to add</Badge>}
          {changed.length    > 0 && <Badge colorScheme="orange" fontSize="2xs">{changed.length} changed</Badge>}
          {providerOnlyCount > 0 && <Badge colorScheme="gray"   fontSize="2xs">{providerOnlyCount} provider-managed</Badge>}
        </HStack>
      </Box>

      <SplitDiffView forProvider={forProvider} atProvider={atProvider} colorMode={colorMode} />
    </Box>
  );
};
