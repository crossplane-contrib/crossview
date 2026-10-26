import { Box, HStack, Text, Button } from '@chakra-ui/react';
import PropTypes from 'prop-types';
import { Input } from '../common/Input.jsx';
import { Dropdown } from '../common/Dropdown.jsx';
import { NODE_TYPES, NODE_TYPE_LABELS, formatCount } from '../../utils/graph/graphModel.js';
import { NODE_TYPE_COLORS } from './graphEdgeStyles.js';
import { graphFiltersShape, optionShape } from './graphPropTypes.js';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { getBorderColor, getAccentColor } from '../../utils/theme.js';
import { getHealthColor } from '../common/ResourceRelations/utils.js';
import { useMutedColor } from './useMutedColor.js';

const Section = ({ label, children, borderColor, first }) => {
  const muted = useMutedColor();
  return (
    <HStack
      align="center"
      gap={4}
      py={2}
      borderTop={first ? 'none' : '1px solid'}
      borderColor={borderColor}
    >
      <Text w="56px" flexShrink={0} fontSize="xs" fontWeight="semibold" color={muted} textTransform="uppercase" letterSpacing="wide">
        {label}
      </Text>
      <HStack gap={2} wrap="wrap" flex="1" minW={0}>
        {children}
      </HStack>
    </HStack>
  );
};

Section.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
  borderColor: PropTypes.string,
  first: PropTypes.bool,
};

// On is a tinted background with a coloured border, like the active item in the sidebar.
const Toggle = ({ color, active, onClick, children }) => {
  const muted = useMutedColor();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      gap={2}
      aria-pressed={active}
      bg={active ? `${color}1f` : 'transparent'}
      borderColor={active ? color : undefined}
      color={active ? undefined : muted}
      _hover={{ bg: `${color}33` }}
    >
      {children}
    </Button>
  );
};

Toggle.propTypes = {
  color: PropTypes.string.isRequired,
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  children: PropTypes.node,
};

const TypeToggle = ({ type, count, active, onClick }) => (
  <Toggle color={NODE_TYPE_COLORS[type]} active={active} onClick={onClick}>
    <Box w="4px" h="14px" borderRadius="sm" bg={NODE_TYPE_COLORS[type]} opacity={active ? 1 : 0.45} />
    {NODE_TYPE_LABELS[type]}
    <Text as="span" fontSize="xs" opacity={0.7}>{formatCount(count)}</Text>
  </Toggle>
);

TypeToggle.propTypes = {
  type: PropTypes.string.isRequired,
  count: PropTypes.number.isRequired,
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
};

const describeFocusState = ({ focusLabel, selectedLabel, hasFocus, selectionDiffers, hasSelection }) => {
  if (!hasFocus) return hasSelection ? `Selected: ${selectedLabel}` : 'Select a node, then focus to see only its chain';
  return selectionDiffers ? `Focused on ${focusLabel}. Selected: ${selectedLabel}` : `Focused on ${focusLabel}`;
};

const FocusControls = ({ focusId, focusLabel, selectedId, selectedLabel, canClear, onFocus, onClear }) => {
  const muted = useMutedColor();
  const hasFocus = Boolean(focusId);
  const hasSelection = Boolean(selectedId);
  const selectionDiffers = hasSelection && selectedId !== focusId;
  return (
    <>
      <Button
        size="sm"
        bg={getAccentColor('blue', 'primary')}
        color="white"
        _hover={{ bg: getAccentColor('blue', 'light') }}
        disabled={!selectionDiffers}
        onClick={() => onFocus(selectedId)}
      >
        {hasFocus ? 'Re-focus' : 'Focus'}
      </Button>
      <Button size="sm" variant="outline" disabled={!canClear} onClick={onClear}>
        Clear
      </Button>
      <Text fontSize="sm" color={muted} ml={2} noOfLines={1}>
        {describeFocusState({ focusLabel, selectedLabel, hasFocus, selectionDiffers, hasSelection })}
      </Text>
    </>
  );
};

FocusControls.propTypes = {
  focusId: PropTypes.string.isRequired,
  focusLabel: PropTypes.string,
  selectedId: PropTypes.string,
  selectedLabel: PropTypes.string,
  canClear: PropTypes.bool.isRequired,
  onFocus: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};

const withAllOption = (allLabel, options) => [{ value: '', label: allLabel }, ...options];

export const GraphFilters = ({ filters, typeCounts, namespaces, kinds, focusLabel, selectedId, selectedLabel, canClear, onChange, onClear }) => {
  const { colorMode } = useAppContext();
  const borderColor = getBorderColor(colorMode);
  const namespaceOptions = withAllOption('All namespaces', namespaces.map((ns) => ({ value: ns, label: ns })));

  const toggleType = (type) => {
    const types = filters.types.includes(type) ? filters.types.filter((t) => t !== type) : [...filters.types, type];
    onChange({ types });
  };

  // Picking the one already on turns it off.
  const toggleHealth = (health) => onChange({ health: filters.health === health ? '' : health });

  return (
    <Box border="1px solid" borderColor={borderColor} borderRadius="md" px={4} mb={3}>
      <Section label="Show" borderColor={borderColor} first>
        {NODE_TYPES.map((type) => (
          <TypeToggle key={type} type={type} count={typeCounts[type]} active={filters.types.includes(type)} onClick={() => toggleType(type)} />
        ))}
      </Section>

      <Section label="Filter" borderColor={borderColor}>
        <Input
          placeholder="Search name, kind, namespace"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          maxW="280px"
        />
        <Dropdown options={withAllOption('All kinds', kinds)} value={filters.kind} onChange={(kind) => onChange({ kind })} minW="360px" />
        <Dropdown options={namespaceOptions} value={filters.namespace} onChange={(namespace) => onChange({ namespace })} minW="180px" />
        <Toggle color={getHealthColor('healthy')} active={filters.health === 'healthy'} onClick={() => toggleHealth('healthy')}>
          Show Healthy
        </Toggle>
        <Toggle color={getHealthColor('warning')} active={filters.health === 'unhealthy'} onClick={() => toggleHealth('unhealthy')}>
          Show Unhealthy
        </Toggle>
      </Section>

      <Section label="Focus" borderColor={borderColor}>
        <FocusControls
          focusId={filters.focus}
          focusLabel={focusLabel}
          selectedId={selectedId}
          selectedLabel={selectedLabel}
          canClear={canClear}
          onFocus={(focus) => onChange({ focus })}
          onClear={onClear}
        />
      </Section>
    </Box>
  );
};

GraphFilters.propTypes = {
  filters: graphFiltersShape.isRequired,
  typeCounts: PropTypes.objectOf(PropTypes.number).isRequired,
  namespaces: PropTypes.arrayOf(PropTypes.string).isRequired,
  kinds: PropTypes.arrayOf(optionShape).isRequired,
  focusLabel: PropTypes.string,
  selectedId: PropTypes.string,
  selectedLabel: PropTypes.string,
  canClear: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
};
