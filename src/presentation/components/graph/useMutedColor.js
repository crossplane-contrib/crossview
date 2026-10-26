import { useAppContext } from '../../providers/AppProvider.jsx';
import { getTextColor } from '../../utils/theme.js';

// The theme's secondary text colour, for hints and labels.
export const useMutedColor = () => getTextColor(useAppContext().colorMode, 'secondary');
