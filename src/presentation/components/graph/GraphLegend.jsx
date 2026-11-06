import { Text } from '@chakra-ui/react';
import { useMutedColor } from './useMutedColor.js';

export const GraphLegend = () => {
  const muted = useMutedColor();
  return (
    <Text fontSize="xs" color={muted} mt={2}>
      Connections end in filled circles at the target resource and take its colour. Hover or focus a resource to highlight its connections across columns. Select a row to keep its relationships highlighted and open resource details. A red marker means Ready or Synced is False, and an orange marker means Ready is Unknown or the resource is unresolved.
    </Text>
  );
};
