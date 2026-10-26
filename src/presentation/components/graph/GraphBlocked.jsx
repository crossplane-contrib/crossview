import { Box, Text, Button } from '@chakra-ui/react';
import { MdWarning } from 'react-icons/md';
import PropTypes from 'prop-types';
import { getHealthColor } from '../common/ResourceRelations/utils.js';
import { formatCount } from '../../utils/graph/graphModel.js';
import { BLOCKED_ABOVE } from '../../utils/graph/graphBudget.js';
import { useMutedColor } from './useMutedColor.js';

// Shown in place of the graph when the limits ask for more nodes than the page will draw.
export const GraphBlocked = ({ count, onUseDefaults }) => {
  const muted = useMutedColor();
  return (
    <Box p={8} textAlign="center">
      <MdWarning size={32} color={getHealthColor('warning')} style={{ margin: '0 auto' }} />
      <Text mt={3} fontWeight="medium">
        The graph is not drawn: {formatCount(count)} nodes is more than the {formatCount(BLOCKED_ABOVE)} limit.
      </Text>
      <Text mt={1} fontSize="sm" color={muted}>
        More than that gets slow and can run out of memory. Lower a slider above, or add a filter.
      </Text>
      <Button mt={4} size="sm" variant="outline" onClick={onUseDefaults}>Use the default limits</Button>
    </Box>
  );
};

GraphBlocked.propTypes = {
  count: PropTypes.number.isRequired,
  onUseDefaults: PropTypes.func.isRequired,
};
