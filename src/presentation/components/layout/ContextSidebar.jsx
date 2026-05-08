import {
  Box,
  VStack,
  HStack,
  Text,
  Icon,
} from '@chakra-ui/react';
import { FiAlertCircle, FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { getBorderColor, getBackgroundColor, getTextColor, getAccentColor, getStatusColor } from '../../utils/theme.js';

export const ContextSidebar = () => {
  const { contexts, selectedContext, setSelectedContext, contextErrors, colorMode, isInClusterMode } = useAppContext();
  const navigate = useNavigate();

  if (isInClusterMode) {
    return null;
  }

  const handleContextClick = async (contextName) => {
    await setSelectedContext(contextName);
  };

  const getFirstLetter = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name || selectedContext;

  const bgColor = getBackgroundColor(colorMode, 'sidebar');
  const borderColor = getBorderColor(colorMode);

  return (
    <Box
      w="60px"
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
              const hasError = contextErrors[name];
              return (
                <Box
                  key={name}
                  as="button"
                  onClick={() => handleContextClick(name)}
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
                  title={name}
                >
                  <Text fontSize="md" fontWeight="bold">
                    {getFirstLetter(name)}
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

