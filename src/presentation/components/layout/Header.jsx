import {
  Box,
  HStack,
  Text,
  IconButton,
  VStack,
} from '@chakra-ui/react';
import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FiUser, FiLogOut, FiSettings, FiMoon, FiSun, FiBook } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../common/SearchBar.jsx';
import { Dialog } from '../common/Dialog.jsx';
import { getBorderColor, getBackgroundColor, getTextColor, getStatusColor } from '../../utils/theme.js';
import { useAppContext } from '../../providers/AppProvider.jsx';

export const Header = ({ sidebarWidth, transitionsEnabled = true }) => {
  const { 
    selectedContext, 
    selectedContextError, 
    user, 
    logout,
    authMode,
    colorMode, 
    setColorMode,
    isInClusterMode 
  } = useAppContext();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const userMenuRef = useRef(null);

  const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name || selectedContext;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userMenuOpen]);

  const handleLogout = async () => {
    setIsLogoutDialogOpen(false);
    setUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const toggleColorMode = () => {
    setColorMode(colorMode === 'light' ? 'dark' : 'light');
  };

  const bgColor = getBackgroundColor(colorMode, 'primary');
  const borderColor = getBorderColor(colorMode);
  const hoverBg = getBackgroundColor(colorMode, 'secondary');
  const textColor = getTextColor(colorMode, 'primary');
  const secondaryTextColor = getTextColor(colorMode, 'secondary');

  return (
    <Box
      as="header"
      h="64px"
      bg={getBackgroundColor(colorMode, 'header')}
      _dark={{ bg: getBackgroundColor('dark', 'header') }}
      borderBottom="1px solid"
      css={{
        borderColor: `${getBorderColor('light')} !important`,
        '.dark &': {
          borderColor: `${getBorderColor('dark')} !important`,
        }
      }}
      position="fixed"
      top={0}
      left={`${sidebarWidth}px`}
      right={0}
      zIndex={999}
      px={6}
      display="flex"
      alignItems="center"
      transition={transitionsEnabled ? 'left 0.2s' : 'none'}
    >
      <HStack h="100%" justify="space-between" w="100%" spacing={6}>
        <HStack spacing={4} flex={1} align="center">
        <Text fontSize="lg" fontWeight="semibold" color={getTextColor(colorMode, 'primary')} _dark={{ color: getTextColor('dark', 'primary') }}>
          Crossplane Dashboard
        </Text>
          {contextName && (
            <HStack spacing={2} align="center">
              <Box
                w="6px"
                h="6px"
                borderRadius="full"
                bg={selectedContextError ? getStatusColor('red') : getStatusColor('green')}
                _dark={{ bg: selectedContextError ? getStatusColor('red') : getStatusColor('green') }}
              />
              <Text fontSize="sm" color={getTextColor(colorMode, 'tertiary')} _dark={{ color: getTextColor('dark', 'tertiary') }} fontWeight="medium">
                {isInClusterMode ? 'In-Cluster' : contextName}
              </Text>
            </HStack>
          )}
        </HStack>

        <HStack spacing={2}>
          <IconButton
            as="a"
            href="https://github.com/corpobit/crossview/blob/main/docs/GETTING_STARTED.md"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open documentation"
            variant="ghost"
            size="sm"
            color={getTextColor(colorMode, 'secondary')}
            _dark={{ color: getTextColor('dark', 'secondary') }}
            _hover={{
              bg: getBackgroundColor(colorMode, 'secondary'),
              _dark: { bg: getBackgroundColor('dark', 'tertiary') }
            }}
            title="Documentation"
          >
            <FiBook size={18} />
          </IconButton>

          <IconButton
            aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
            variant="ghost"
            size="sm"
            onClick={toggleColorMode}
            color={getTextColor(colorMode, 'secondary')}
            _dark={{ color: getTextColor('dark', 'secondary') }}
            _hover={{
              bg: getBackgroundColor(colorMode, 'secondary'),
              _dark: { bg: getBackgroundColor('dark', 'tertiary') }
            }}
            title={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
          >
            {colorMode === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
          </IconButton>

        <SearchBar />

          {user && (
            <Box position="relative" ref={userMenuRef}>
              <IconButton
                aria-label="User menu"
                variant="ghost"
                size="sm"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                color="gray.600"
                _dark={{ color: 'gray.300' }}
                _hover={{
                  bg: 'gray.100',
                  _dark: { bg: 'gray.700' }
                }}
              >
                <FiUser size={18} />
              </IconButton>
              {userMenuOpen && (
                <Box
                  position="absolute"
                  top="100%"
                  right={0}
                  mt={2}
                  minW="200px"
                  borderRadius="lg"
                  border="1px solid"
                  borderColor={borderColor}
                  bg={bgColor}
                  boxShadow="xl"
                  zIndex={1000}
                  overflow="hidden"
                >
                  <VStack align="stretch" spacing={0}>
                    <Box px={4} py={3} borderBottom={`1px solid ${borderColor}`}>
                      <Text fontSize="sm" fontWeight="semibold" color={textColor}>
                        {user.username || user.email}
                      </Text>
                      {user.email && user.email !== user.username && (
                        <Text fontSize="xs" color={secondaryTextColor} mt={0.5}>
                          {user.email}
                        </Text>
                      )}
                    </Box>
                    <Box
                      as="button"
                      w="100%"
                      px={4}
                      py={2.5}
                      textAlign="left"
                      onClick={() => {
                        navigate('/settings');
                        setUserMenuOpen(false);
                      }}
                      display="flex"
                      alignItems="center"
                      gap={3}
                      color={textColor}
                      _hover={{ bg: hoverBg }}
                      transition="background-color 0.15s"
                    >
                      <FiSettings size={16} />
                      <Text fontSize="sm">Settings</Text>
                    </Box>
                    {authMode === 'session' && (
                    <Box
                      as="button"
                      w="100%"
                      px={4}
                      py={2.5}
                      textAlign="left"
                      onClick={() => {
                        setIsLogoutDialogOpen(true);
                        setUserMenuOpen(false);
                      }}
                      display="flex"
                      alignItems="center"
                      gap={3}
                      color={getStatusColor('red')}
                      _dark={{ color: getStatusColor('red') }}
                      _hover={{ bg: hoverBg }}
                      transition="background-color 0.15s"
                    >
                      <FiLogOut size={16} />
                      <Text fontSize="sm">Logout</Text>
                    </Box>
                    )}
                  </VStack>
                </Box>
              )}
            </Box>
          )}
        </HStack>
      </HStack>

      <Dialog
        isOpen={isLogoutDialogOpen}
        onClose={() => setIsLogoutDialogOpen(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        message="Are you sure you want to logout? You will need to login again to access the application."
        confirmLabel="Logout"
        cancelLabel="Cancel"
        confirmColorScheme="red"
        colorMode={colorMode}
      />
    </Box>
  );
};

Header.propTypes = {
  sidebarWidth: PropTypes.number.isRequired,
  transitionsEnabled: PropTypes.bool,
};
