import { Box, Button, HStack, Popover, Portal, Text, VStack } from '@chakra-ui/react';
import { Children, cloneElement, useRef, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiGrid, FiMaximize2, FiMove } from 'react-icons/fi';
import PropTypes from 'prop-types';
import { DASHBOARD_PANELS, dashboardGridSlots } from '../../utils/dashboardLayout.js';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { getBackgroundColor, getBorderColor, getTextColor, getAccentColor } from '../../utils/theme.js';

const layoutShape = PropTypes.shape({
  order: PropTypes.arrayOf(PropTypes.string).isRequired,
  hidden: PropTypes.arrayOf(PropTypes.string).isRequired,
  sizes: PropTypes.objectOf(PropTypes.shape({
    span: PropTypes.number.isRequired, height: PropTypes.number,
  })).isRequired,
});

export const DashboardPanelMenu = ({ layout, onToggle, onReset }) => {
  const { colorMode } = useAppContext();
  return (
    <Popover.Root positioning={{ placement: 'bottom-end' }}>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm"><FiGrid /> Panels <FiChevronDown /></Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content bg={getBackgroundColor(colorMode, 'header')} color={getTextColor(colorMode, 'primary')}
            borderColor={getBorderColor(colorMode)} width="280px">
            <Popover.Body p={4}>
              <Popover.Title fontWeight="semibold" mb={1}>Dashboard panels</Popover.Title>
              <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')} mb={3}>Choose panels. Drag their header handles to reorder and bottom-right corners to resize.</Text>
              <VStack align="stretch" gap={1}>
                {DASHBOARD_PANELS.map(panel => (
                  <Box as="label" key={panel.id} display="flex" alignItems="center" gap={3} py={2} cursor="pointer">
                    <input type="checkbox" checked={!layout.hidden.includes(panel.id)} onChange={() => onToggle(panel.id)} />
                    <Text fontSize="sm">{panel.label}</Text>
                  </Box>
                ))}
              </VStack>
              <Button variant="outline" size="sm" w="100%" mt={3} onClick={onReset}>Reset layout</Button>
              <Text fontSize="xs" color={getTextColor(colorMode, 'secondary')} mt={2}>Saved in this browser.</Text>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

DashboardPanelMenu.propTypes = {
  layout: layoutShape.isRequired, onToggle: PropTypes.func.isRequired, onReset: PropTypes.func.isRequired,
};

export const DashboardGrid = ({ layout, onMove, onReorder, onResize, children }) => {
  const { colorMode } = useAppContext();
  const [dragging, setDragging] = useState(null);
  const [target, setTarget] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [resizing, setResizing] = useState(null);
  const gridRef = useRef(null);
  const resizeRef = useRef(null);
  const content = new Map(Children.toArray(children).map(child => [child.props.id, child]));
  const visible = layout.order.filter(id => !layout.hidden.includes(id));
  const previewLayout = resizing
    ? { ...layout, sizes: { ...layout.sizes, [resizing.id]: resizing.size } }
    : layout;
  const slots = dashboardGridSlots(previewLayout);
  const move = (id, direction) => {
    onMove(id, direction);
    setAnnouncement(`${DASHBOARD_PANELS.find(panel => panel.id === id).label} moved ${direction < 0 ? 'earlier' : 'later'}.`);
  };
  const dragOver = (event, id) => {
    if (!dragging) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setTarget(id);
  };
  const drop = (event, id, span) => {
    event.preventDefault();
    if (dragging) {
      onReorder(dragging, id);
      if (span) {
        onResize(dragging, { ...layout.sizes[dragging], span });
      }
      setAnnouncement(`${DASHBOARD_PANELS.find(panel => panel.id === dragging).label} position updated.`);
    }
    setDragging(null);
    setTarget(null);
  };
  const finishResize = (event, commit) => {
    const active = resizeRef.current;
    if (!active) return;
    resizeRef.current = null;
    setResizing(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (commit) {
      onResize(active.id, active.size);
      setAnnouncement(`${active.label} resized to ${active.size.span / 12 * 100}% width and ${active.size.height} pixels high.`);
    }
  };
  return (
    <>
      <Box role="status" aria-live="polite" position="absolute" width="1px" height="1px" overflow="hidden" clipPath="inset(50%)">{announcement}</Box>
      {visible.length === 0 && <Box p={8} textAlign="center" border="1px dashed" borderColor={getBorderColor(colorMode)} borderRadius="xl">
        <Text fontWeight="medium">All panels are hidden.</Text>
        <Text fontSize="sm" mt={2}>Use the Panels menu to show panels or reset your layout.</Text>
      </Box>}
      <Box ref={gridRef} display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'repeat(12, minmax(0, 1fr))' }} gap={5}>
        {slots.map(slot => {
          if (slot.target) return (
            <Box key={slot.target} data-dashboard-dropzone={slot.target}
              display={{ base: dragging ? 'flex' : 'none', xl: 'flex' }}
              alignItems="center" justifyContent="center" minH="140px"
              gridColumn={{ base: '1', xl: `span ${slot.span}` }} borderRadius="xl"
              border="1px dashed" borderColor={target === slot.target ? getAccentColor('blue') : getBorderColor(colorMode)}
              bg={target === slot.target ? getBackgroundColor(colorMode, 'tertiary') : 'transparent'}
              onDragOver={event => dragOver(event, slot.target)} onDrop={event => drop(event, slot.target, slot.span)}>
              <VStack gap={2} color={getTextColor(colorMode, 'secondary')}>
                <FiMove /><Text fontSize="sm">Drop a panel here</Text>
                {!dragging && <Button variant="ghost" size="xs" onClick={() => {
                  const previous = slots.find(entry => entry.id === slot.previous);
                  onResize(slot.previous, { ...layout.sizes[slot.previous], span: previous.span + slot.span });
                }}>Expand previous panel to fill</Button>}
              </VStack>
            </Box>
          );
          const { id } = slot;
          const index = visible.indexOf(id);
          const panel = DASHBOARD_PANELS.find(entry => entry.id === id);
          const size = previewLayout.sizes[id];
          const controls = (
            <HStack gap={0} flexShrink={0} color={getTextColor(colorMode, 'secondary')}>
              <Button variant="ghost" size="xs" aria-label={`Move ${panel.label} earlier`} title="Move earlier"
                disabled={index === 0} onClick={() => move(id, -1)}><FiChevronUp /></Button>
              <Button variant="ghost" size="xs" aria-label={`Move ${panel.label} later`} title="Move later"
                disabled={index === visible.length - 1} onClick={() => move(id, 1)}><FiChevronDown /></Button>
              <Button draggable variant="ghost" size="xs" cursor="grab"
                aria-label={`Drag ${panel.label} to reorder`} title="Drag to reorder. Arrow keys move this panel."
                onDragStart={event => {
                  event.dataTransfer.setData('text/plain', id);
                  event.dataTransfer.effectAllowed = 'move';
                  setDragging(id);
                }}
                onDragEnd={() => { setDragging(null); setTarget(null); }}
                onKeyDown={event => {
                  if (event.key === 'ArrowUp' && index > 0) { event.preventDefault(); move(id, -1); }
                  if (event.key === 'ArrowDown' && index < visible.length - 1) { event.preventDefault(); move(id, 1); }
                }}><FiMove /></Button>
            </HStack>
          );
          return (
            <Box key={id} data-dashboard-panel={id} minW={0} display="flex" flexDirection="column" position="relative"
              gridColumn={{ base: '1', xl: `span ${slot.span}` }}
              height={size?.height ? `${size.height}px` : 'auto'}
              outline={target === id && dragging !== id ? `2px solid ${getAccentColor('blue')}` : 'none'}
              outlineOffset="4px" borderRadius="xl" opacity={dragging === id ? 0.55 : 1}
              onDragOver={event => dragOver(event, id)}
              onDrop={event => drop(event, id)}>
              {cloneElement(content.get(id), { controls })}
              <Button variant="ghost" size="xs" position="absolute" right={1.5} bottom={1.5}
                color={getTextColor(colorMode, 'secondary')} cursor="nwse-resize" touchAction="none"
                aria-label={`Resize ${panel.label}`} title="Drag to resize. Left/Right changes width; Up/Down changes height. Enter fills the row."
                onPointerDown={event => {
                  if (event.button !== 0) return;
                  event.preventDefault();
                  const bounds = event.currentTarget.parentElement.getBoundingClientRect();
                  const grid = gridRef.current;
                  const styles = getComputedStyle(grid);
                  const columns = styles.gridTemplateColumns.split(' ').length;
                  const gap = Number.parseFloat(styles.columnGap) || 0;
                  const startSize = { span: slot.span, height: Math.max(260, Math.min(1600, Math.round(bounds.height))) };
                  resizeRef.current = {
                    id, label: panel.label, x: event.clientX, y: event.clientY,
                    startSize, size: startSize, columnWidth: (grid.clientWidth + gap) / 12,
                    desktop: columns === 12,
                  };
                  setResizing({ id, size: startSize });
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerMove={event => {
                  const active = resizeRef.current;
                  if (!active || active.id !== id) return;
                  const span = active.desktop
                    ? Math.max(3, Math.min(12, Math.round((active.startSize.span + (event.clientX - active.x) / active.columnWidth) / 3) * 3))
                    : active.startSize.span;
                  const height = Math.max(260, Math.min(1600, Math.round(active.startSize.height + event.clientY - active.y)));
                  active.size = { span, height };
                  setResizing({ id, size: active.size });
                }}
                onPointerUp={event => finishResize(event, true)}
                onPointerCancel={event => finishResize(event, false)}
                onLostPointerCapture={event => finishResize(event, false)}
                onKeyDown={event => {
                  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Home'].includes(event.key)) return;
                  event.preventDefault();
                  const next = { span: slot.span, ...layout.sizes[id] };
                  if (event.key === 'ArrowLeft') next.span = Math.max(3, next.span - 3);
                  if (event.key === 'ArrowRight') next.span = Math.min(12, next.span + 3);
                  if (event.key === 'Enter') next.span = 12;
                  if (event.key === 'Home') { next.span = panel.span; delete next.height; }
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    const height = next.height || event.currentTarget.parentElement.getBoundingClientRect().height;
                    next.height = Math.max(260, Math.min(1600, Math.round(height + (event.key === 'ArrowUp' ? -40 : 40))));
                  }
                  onResize(id, next);
                  setAnnouncement(`${panel.label} size updated.`);
                }}><FiMaximize2 /></Button>
            </Box>
          );
        })}
        {dragging && slots[slots.length - 1]?.target !== 'end' && (
          <Box data-dashboard-dropzone="end" gridColumn={{ base: '1', xl: '1 / -1' }} p={6}
            border="1px dashed" borderColor={target === 'end' ? getAccentColor('blue') : getBorderColor(colorMode)}
            borderRadius="xl" textAlign="center" onDragOver={event => dragOver(event, 'end')} onDrop={event => drop(event, 'end')}>
            <Text fontSize="sm">Drop here to move to the end</Text>
          </Box>
        )}
      </Box>
    </>
  );
};

DashboardGrid.propTypes = {
  layout: layoutShape.isRequired, onMove: PropTypes.func.isRequired,
  onReorder: PropTypes.func.isRequired, onResize: PropTypes.func.isRequired, children: PropTypes.node.isRequired,
};
