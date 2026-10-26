import { Text } from '@chakra-ui/react';
import { useMutedColor } from './useMutedColor.js';

export const GraphLegend = () => {
  const muted = useMutedColor();
  return (
    <Text fontSize="xs" color={muted} mt={2}>
      Arrows take the colour of what they point to. A red border means Ready or Synced is False, and an orange border means Ready is Unknown. Scrolling moves the page; hold Ctrl and scroll, or pinch, to zoom the graph.
    </Text>
  );
};
