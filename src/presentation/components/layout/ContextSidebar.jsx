import {
  Box,
  VStack,
  Text,
  Icon,
} from '@chakra-ui/react';
import { FiAlertCircle, FiPlus } from 'react-icons/fi';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { getBorderColor, getBackgroundColor, getTextColor, getAccentColor, getStatusColor } from '../../utils/theme.js';

const MIN_CONTEXT_SIDEBAR_WIDTH = 60;
const MAX_CONTEXT_SIDEBAR_WIDTH = 140;
const SIDEBAR_LABEL_CHAR_WIDTH = 7;
const MAX_CONTEXT_BADGE_LABEL_LENGTH = 12;

export const ContextSidebar = () => {
  const { contexts, selectedContext, setSelectedContext, colorMode, isInClusterMode, contextAliases } = useAppContext();
  const navigate = useNavigate();

  const getFirstLetter = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  const getContextBadgeLabel = (name) => {
    const rawLabel = (contextAliases[name] || getFirstLetter(name) || '?').trim();
    if (rawLabel.length <= MAX_CONTEXT_BADGE_LABEL_LENGTH) {
      return rawLabel;
    }
    return `${rawLabel.slice(0, MAX_CONTEXT_BADGE_LABEL_LENGTH - 1)}...`;
  };

  const contextSidebarWidth = useMemo(() => {
    if (!contexts || contexts.length === 0) {
      return MIN_CONTEXT_SIDEBAR_WIDTH;
    }

    const maxLabelLength = contexts.reduce((maxLen, context) => {
      const name = typeof context === 'string' ? context : context.name || context;
      const rawLabel = (contextAliases[name] || getFirstLetter(name) || '?').trim();
      return Math.max(maxLen, Math.min(rawLabel.length, MAX_CONTEXT_BADGE_LABEL_LENGTH));
    }, 1);

    return Math.min(
      MAX_CONTEXT_SIDEBAR_WIDTH,
      Math.max(MIN_CONTEXT_SIDEBAR_WIDTH, 24 + (maxLabelLength * SIDEBAR_LABEL_CHAR_WIDTH)),
    );
  }, [contexts, contextAliases]);

  useEffect(() => {
    if (isInClusterMode) {
      return;
    }
    window.dispatchEvent(new CustomEvent('contextSidebarWidthChanged', {
      detail: { width: contextSidebarWidth },
    }));
  }, [contextSidebarWidth, isInClusterMode]);

  if (isInClusterMode) {
    return null;
  }

  const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name || selectedContext;

  const bgColor = getBackgroundColor(colorMode, 'sidebar');
  const borderColor = getBorderColor(colorMode);

  return (
    <Box
      w={`${contextSidebarWidth}px`}
      h="100vh"
      bg={bgColor}
      borderRight="1px solid"
      borderColor={borderColor}
      position="fixed"
      left={0}
      top={0}
      zIndex={1001}
      display="flex"
      flexDirection="column"
    >
      <Box flex={1} overflowY="auto" p={2}>
        {contexts.length === 0 ? (
          <VStack spacing={3} align="center" justify="center" h="100%">
            <Box
              w="44px"
              h="44px"
              borderRadius="lg"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg={getBackgroundColor(colorMode, 'secondary')}
              _dark={{ bg: getBackgroundColor('dark', 'tertiary'), borderColor: getBorderColor('dark', 'gray') }}
              border="2px dashed"
              borderColor={getBorderColor(colorMode, 'gray')}
              cursor="pointer"
              _hover={{
                bg: getBackgroundColor(colorMode, 'tertiary'),
                borderColor: getAccentColor('blue', 'light'),
                _dark: { bg: getBackgroundColor('dark', 'tertiary'), borderColor: getAccentColor('blue', 'primary') }
              }}
              transition="all 0.2s"
            >
              <Icon as={FiPlus} boxSize={5} color={getTextColor(colorMode, 'tertiary')} _dark={{ color: getTextColor('dark', 'tertiary') }} />
            </Box>
          </VStack>
        ) : (
          <VStack spacing={2} align="stretch">
            {contexts.map((context) => {
              const name = typeof context === 'string' ? context : context.name || context;
              const isSelected = contextName === name;
              const hasError = false;
              const rawAlias = contextAliases[name] || '';
              const label = getContextBadgeLabel(name);
              return (
                <Box
                  key={name}
                  as="button"
                  onClick={() => setSelectedContext(name)}
                  w="100%"
                  p={0}
                  borderRadius="lg"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  bg={isSelected ? getAccentColor('blue', 'primary') : getBackgroundColor(colorMode, 'tertiary')}
                  _dark={{ bg: isSelected ? getAccentColor('blue', 'medium') : getBackgroundColor('dark', 'tertiary'), color: isSelected ? getTextColor('dark', 'inverse') : getTextColor('dark', 'primary') }}
                  color={isSelected ? getTextColor(colorMode, 'inverse') : getTextColor(colorMode, 'primary')}
                  _hover={{
                    bg: isSelected ? getAccentColor('blue', 'medium') : getBackgroundColor(colorMode, 'tertiary'),
                    border: '1px solid',
                    borderColor: getAccentColor('blue', 'light'),
                    _dark: { 
                      bg: isSelected ? getAccentColor('blue', 'dark') : getBackgroundColor('dark', 'tertiary'),
                      borderColor: getAccentColor('blue', 'primary')
                    }
                  }}
                  position="relative"
                  transition="all 0.2s"
                  h="44px"
                  cursor="default"
                  title={rawAlias ? `${name} (${rawAlias})` : name}
                >
                  <Text fontSize={label.length > 3 ? 'xs' : 'md'} fontWeight="bold">
                    {label}
                  </Text>
                  {hasError && (
                    <Box
                      position="absolute"
                      top="-2px"
                      right="-2px"
                      w="12px"
                      h="12px"
                      borderRadius="full"
                      bg={getStatusColor('red')}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Icon as={FiAlertCircle} boxSize={6} color={getTextColor(colorMode, 'inverse')} />
                    </Box>
                  )}
                </Box>
              );
            })}
            <Box
              as="button"
              onClick={() => navigate('/settings/context-management')}
              w="100%"
              p={0}
              borderRadius="lg"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="transparent"
              border="2px dashed"
              borderColor={getBorderColor(colorMode, 'gray')}
              color={getTextColor(colorMode, 'tertiary')}
              _dark={{ borderColor: getBorderColor('dark', 'gray'), color: getTextColor('dark', 'tertiary') }}
              _hover={{
                borderColor: getAccentColor('blue', 'light'),
                color: getAccentColor('blue', 'primary'),
                _dark: { borderColor: getAccentColor('blue', 'primary'), color: getAccentColor('blue', 'light') }
              }}
              transition="all 0.2s"
              h="44px"
              title="Add Context"
            >
              <Icon as={FiPlus} boxSize={5} />
            </Box>
          </VStack>
        )}
      </Box>
    </Box>
  );
};

