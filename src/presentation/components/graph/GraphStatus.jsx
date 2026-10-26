import { useState } from 'react';
import { Box, HStack, Text, Button, SimpleGrid, Slider } from '@chakra-ui/react';
import { MdWarning, MdInfo, MdExpandMore, MdExpandLess, MdAdd, MdRemove } from 'react-icons/md';
import PropTypes from 'prop-types';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { getBorderColor, getAccentColor } from '../../utils/theme.js';
import { getHealthColor } from '../common/ResourceRelations/utils.js';
import { formatCount } from '../../utils/graph/graphModel.js';
import { stepsFor, stepIndexAfter } from '../../utils/graph/graphLimits.js';
import { useMutedColor } from './useMutedColor.js';

const MAX_NOTICES_SHOWN = 3;
const INFO_COLOR = getAccentColor('blue');

const noticeShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  severity: PropTypes.oneOf(['warning', 'info']).isRequired,
  message: PropTypes.string.isRequired,
});

const sliderShape = PropTypes.shape({
  type: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  color: PropTypes.string.isRequired,
  matched: PropTypes.number.isRequired,
  shown: PropTypes.number.isRequired,
  limit: PropTypes.number.isRequired,
});

// Applying a limit redraws the graph, which is slow. So while dragging, the thumb and label move
// on their own and the limit is applied once on release; the buttons apply it straight away.
const useDeferredIndex = (committedIndex, stepCount, applyIndex) => {
  const [draft, setDraft] = useState(null);
  const index = draft ?? committedIndex;
  const commit = (next) => {
    applyIndex(next);
    setDraft(null);
  };

  return {
    index,
    previewing: draft !== null,
    onInput: setDraft,
    onStep: (delta) => applyIndex(stepIndexAfter(index, delta, stepCount)),
    onCommit: commit,
  };
};

const StepButton = ({ label, onClick, disabled, children }) => (
  <Button size="xs" variant="ghost" minW="22px" h="22px" p={0} flexShrink={0} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
    {children}
  </Button>
);

StepButton.propTypes = { label: PropTypes.string.isRequired, onClick: PropTypes.func.isRequired, disabled: PropTypes.bool, children: PropTypes.node };

// One slider per type. It moves through a short list of values, which spreads small numbers out.
const LimitSlider = ({ slider, onChange }) => {
  const muted = useMutedColor();
  const steps = stepsFor(slider.matched, slider.limit);
  const control = useDeferredIndex(steps.indexOf(slider.limit), steps.length, (next) => {
    if (steps[next] !== slider.limit) onChange(slider.type, steps[next]);
  });
  const limit = steps[control.index];
  return (
    <Box minW={0}>
      <HStack gap={2} minW={0}>
        <Box w="4px" h="14px" borderRadius="sm" bg={slider.color} flexShrink={0} />
        <Text fontSize="sm" truncate title={slider.label}>{slider.label}</Text>
      </HStack>
      <HStack gap={1}>
        <StepButton label={`Show fewer ${slider.label}`} onClick={() => control.onStep(-1)} disabled={control.index === 0}><MdRemove size={16} /></StepButton>
        <Slider.Root
          flex="1"
          minW={0}
          size="sm"
          min={0}
          max={steps.length - 1}
          step={1}
          value={[control.index]}
          onValueChange={({ value }) => control.onInput(value[0])}
          onValueChangeEnd={({ value }) => control.onCommit(value[0])}
          aria-label={[`Show up to ${formatCount(limit)} ${slider.label}`]}
          title={`Show up to ${formatCount(limit)}`}
        >
          <Slider.Control>
            <Slider.Track>
              <Slider.Range bg={slider.color} />
            </Slider.Track>
            <Slider.Thumb index={0} bg="white" borderColor={slider.color} borderWidth="2px">
              <Slider.HiddenInput />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>
        <StepButton label={`Show more ${slider.label}`} onClick={() => control.onStep(1)} disabled={control.index === steps.length - 1}><MdAdd size={16} /></StepButton>
      </HStack>
      <Text fontSize="xs" color={control.previewing ? slider.color : muted} whiteSpace="nowrap">
        {control.previewing ? `Show up to ${formatCount(limit)}` : `${formatCount(slider.shown)} of ${formatCount(slider.matched)} shown`}
      </Text>
    </Box>
  );
};

LimitSlider.propTypes = { slider: sliderShape.isRequired, onChange: PropTypes.func.isRequired };

const Notice = ({ notice }) => {
  const Icon = notice.severity === 'warning' ? MdWarning : MdInfo;
  const color = notice.severity === 'warning' ? getHealthColor('warning') : INFO_COLOR;
  return (
    <HStack align="flex-start" gap={2}>
      <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <Text fontSize="sm">{notice.message}</Text>
    </HStack>
  );
};

Notice.propTypes = { notice: noticeShape.isRequired };

const BODY_ID = 'graph-status-body';

// It starts closed, unless the graph could not be drawn. Closed it is one line: what is shown and a warning if that is not everything. Open, it has the
// sliders to change that, the resources that need attention, and notices about the data.
export const GraphNotices = ({ notices }) => {
  const muted = useMutedColor();
  if (notices.length === 0) return null;
  return (
    <Box mt={2}>
      {notices.slice(0, MAX_NOTICES_SHOWN).map((notice) => <Notice key={notice.id} notice={notice} />)}
      {notices.length > MAX_NOTICES_SHOWN && (
        <Text fontSize="xs" color={muted} mt={1}>and {notices.length - MAX_NOTICES_SHOWN} more notices</Text>
      )}
    </Box>
  );
};

GraphNotices.propTypes = { notices: PropTypes.arrayOf(noticeShape).isRequired };

export const GraphStatus = ({ headline, alerts, hintText, sliders, attention, notices, defaultOpen, onLimitChange, onShowUnhealthy }) => {
  const { colorMode } = useAppContext();
  const muted = useMutedColor();
  const [open, setOpen] = useState(defaultOpen);
  const warn = headline.warn || notices.length > 0;
  const Chevron = open ? MdExpandLess : MdExpandMore;

  return (
    <Box border="1px solid" borderColor={getBorderColor(colorMode)} borderRadius="md" mb={3}>
      <HStack
        as="button"
        type="button"
        w="100%"
        px={4}
        py={2.5}
        gap={3}
        textAlign="left"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls={BODY_ID}
      >
        {warn ? <MdWarning size={18} color={getHealthColor('warning')} style={{ flexShrink: 0 }} /> : <MdInfo size={18} color={INFO_COLOR} style={{ flexShrink: 0 }} />}
        <Text fontSize="sm" fontWeight="medium" flex="1" minW={0} noOfLines={1} title={headline.text}>{headline.text}</Text>
        {alerts.length > 0 && <Text fontSize="xs" color={muted} whiteSpace="nowrap">{alerts.join(' · ')}</Text>}
        <HStack gap={1} flexShrink={0} color={muted}>
          <Text fontSize="xs">{open ? 'Hide' : 'Adjust'}</Text>
          <Chevron size={20} />
        </HStack>
      </HStack>

      {open && (
        <Box id={BODY_ID} px={4} pb={3}>
          {hintText && <Text fontSize="sm" color={muted}>{hintText}</Text>}

          {sliders.length > 0 && (
            <SimpleGrid columns={{ base: 1, md: 2, xl: sliders.length }} gap={5} mt={2}>
              {sliders.map((slider) => <LimitSlider key={slider.type} slider={slider} onChange={onLimitChange} />)}
            </SimpleGrid>
          )}

          {attention && (
            <HStack mt={3} gap={2} wrap="wrap">
              <MdWarning size={16} color={getHealthColor('warning')} />
              <Text fontSize="sm">{attention.text}</Text>
              {!attention.active && <Button size="xs" variant="outline" onClick={onShowUnhealthy}>Show only these</Button>}
            </HStack>
          )}

          <GraphNotices notices={notices} />
        </Box>
      )}
    </Box>
  );
};

GraphStatus.propTypes = {
  headline: PropTypes.shape({ text: PropTypes.string.isRequired, warn: PropTypes.bool.isRequired }).isRequired,
  alerts: PropTypes.arrayOf(PropTypes.string).isRequired,
  hintText: PropTypes.string,
  sliders: PropTypes.arrayOf(sliderShape).isRequired,
  attention: PropTypes.shape({ text: PropTypes.string.isRequired, active: PropTypes.bool.isRequired }),
  notices: PropTypes.arrayOf(noticeShape).isRequired,
  defaultOpen: PropTypes.bool,
  onLimitChange: PropTypes.func.isRequired,
  onShowUnhealthy: PropTypes.func.isRequired,
};
