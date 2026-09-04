import {
  Box,
  VStack,
  HStack,
  Text,
  Image,
} from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight, FiChevronDown, FiChevronUp, FiLayout, FiSettings, FiPackage, FiFileText, FiLayers, FiBox, FiBook, FiServer, FiUsers, FiSliders, FiGrid, FiDatabase, FiCode, FiGithub, FiShield } from 'react-icons/fi';
import { useState, useEffect, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { colors, getBorderColor, getTextColor, getBackgroundColor, getSidebarColor, getAccentColor } from '../../utils/theme.js';
import appPackageJson from '../../../../package.json';
import { useVersionCheck } from '../../hooks/useVersionCheck.js';
import { FiArrowUp } from 'react-icons/fi';

export const Sidebar = ({ onToggle, onResize }) => {
  const appVersion = appPackageJson.version;
  const updateInfo = useVersionCheck(appVersion);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(280);
  const [isResizing, setIsResizing] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState({});
  const [compositeResourceKinds, setCompositeResourceKinds] = useState([]);
  const [loadingCompositeKinds, setLoadingCompositeKinds] = useState(false);
  const [contextSidebarWidth, setContextSidebarWidth] = useState(80);
  const sidebarRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { kubernetesRepository, selectedContext, colorMode, selectedContextError, isInClusterMode, authMode } = useAppContext();
  useEffect(() => {
    if (isInClusterMode) {
      setContextSidebarWidth(0);
      return;
    }
    const updateContextSidebarWidth = (event) => {
      const saved = localStorage.getItem('contextSidebarCollapsed');
      const eventWidth = Number(event?.detail?.width);
      const resolvedWidth = Number.isFinite(eventWidth) && eventWidth > 0 ? eventWidth : 60;
      setContextSidebarWidth(saved === 'true' ? 0 : resolvedWidth);
    };
    updateContextSidebarWidth();
    const handleWidthChange = (event) => {
      updateContextSidebarWidth(event);
    };
    window.addEventListener('contextSidebarWidthChanged', handleWidthChange);
    return () => window.removeEventListener('contextSidebarWidthChanged', handleWidthChange);
  }, [isInClusterMode]);

  useEffect(() => {
    const currentWidth = isCollapsed ? 60 : width;
    if (onToggle) {
      onToggle(isCollapsed, currentWidth);
    }
    if (onResize) {
      onResize(currentWidth);
    }
  }, [isCollapsed, width, onToggle, onResize]);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      if (newWidth >= 200 && newWidth <= 500) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);


  // Fetch composite resource kinds dynamically (lightweight - only gets kinds from XRDs)
  useEffect(() => {
    let isMounted = true;
    const loadCompositeResourceKinds = async () => {
      if (!selectedContext || !kubernetesRepository) {
        if (isMounted) {
          setCompositeResourceKinds([]);
          setLoadingCompositeKinds(false);
        }
        return;
      }
      
      if (isMounted) {
        setLoadingCompositeKinds(true);
      }
      
      try {
        const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;
        if (!contextName) {
          if (isMounted) {
            setCompositeResourceKinds([]);
            setLoadingCompositeKinds(false);
          }
          return;
        }
        
        // Use lightweight use case that only fetches XRDs and extracts kinds
        const { GetCompositeResourceKindsUseCase } = await import('../../../domain/usecases/GetCompositeResourceKindsUseCase.js');
        const useCase = new GetCompositeResourceKindsUseCase(kubernetesRepository);
        const kinds = await useCase.execute(contextName);
        
        if (isMounted) {
          setCompositeResourceKinds(Array.isArray(kinds) ? kinds : []);
          setLoadingCompositeKinds(false);
        }
      } catch (error) {
        // Silently fail - kinds will be empty, user can still navigate via the main page
        if (isMounted) {
          // Only log if it's not a network/API error (those are expected)
          if (!error.message || (!error.message.includes('500') && !error.message.includes('Failed to get'))) {
            console.warn('Failed to load composite resource kinds for sidebar:', error.message || error);
          }
          setCompositeResourceKinds([]);
          setLoadingCompositeKinds(false);
        }
      }
    };
    loadCompositeResourceKinds();
    return () => {
      isMounted = false;
    };
  }, [selectedContext, kubernetesRepository]);

  const menuItems = useMemo(() => ([
    { id: 'dashboard', label: 'Dashboard', icon: FiLayout, path: '/' },
    // Core Crossplane Resources (building blocks)
    { id: 'providers', label: 'Providers', icon: FiPackage, path: '/providers', tooltip: 'Crossplane providers that extend Kubernetes capabilities' },
    { id: 'functions', label: 'Functions', icon: FiCode, path: '/functions', tooltip: 'Crossplane Functions - composable building blocks for Compositions' },
    { id: 'xrds', label: 'XRDs', icon: FiBook, path: '/xrds', tooltip: 'Composite Resource Definitions - define custom resource types' },
    { id: 'compositions', label: 'Compositions', icon: FiLayers, path: '/compositions', tooltip: 'Templates that define how to compose resources' },
    { id: 'mrds', label: 'MRDs', icon: FiLayers, path: '/mrds', tooltip: 'Managed Resource Definitions - available managed resource types from providers' },
    { id: 'mraps', label: 'MRAPs', icon: FiShield, path: '/mraps', tooltip: 'Managed Resource Activation Policies - control managed resource activation' },
    // Crossplane Instances (created resources)
    {
      id: 'composite-resources',
      label: 'Composite Resources',
      icon: FiBox,
      path: '/composite-resources',
      tooltip: 'Composite Resources (XRs) - instances created from Compositions',
      hasSubMenu: true,
      getSubMenuItems: () => compositeResourceKinds.map(kind => ({
        id: `composite-resource-${kind.toLowerCase()}`,
        label: kind,
        path: `/composite-resources/${kind}`
      }))
    },
    { id: 'claims', label: 'Claims', icon: FiFileText, path: '/claims', tooltip: 'User-facing abstractions that create Composite Resources' },
    { id: 'managed-resources', label: 'Managed Resources', icon: FiServer, path: '/managed-resources', tooltip: 'Kubernetes resources created and managed by Crossplane (Deployments, Services, etc.)' },
    {
      id: 'settings',
      label: 'Settings',
      icon: FiSettings,
      path: '/settings',
      hasSubMenu: true,
      subMenuItems: [
        { id: 'settings-appearance', label: 'Appearance', icon: FiSliders, path: '/settings/appearance' },
        ...(authMode === 'session' ? [{ id: 'settings-users', label: 'User Management', icon: FiUsers, path: '/settings/user-management' }] : []),
        ...(isInClusterMode ? [] : [{ id: 'settings-contexts', label: 'Contexts', icon: FiDatabase, path: '/settings/context-management' }]),
      ]
    },
  ]), [authMode, compositeResourceKinds, isInClusterMode]);

  // Auto-expand menu if a sub-menu item is active
  useEffect(() => {
    menuItems.forEach(item => {
      if (item.hasSubMenu) {
        const subMenuItems = item.getSubMenuItems ? item.getSubMenuItems() : (item.subMenuItems || []);
        const hasActiveSub = subMenuItems.some(sub => location.pathname === sub.path || location.pathname.startsWith(sub.path + '/'));
        if (hasActiveSub) {
          setExpandedMenus(prev => ({
            ...prev,
            [item.id]: true
          }));
        }
      }
    });
  }, [location.pathname, menuItems]);

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const currentWidth = isCollapsed ? 60 : width;

  return (
    <Box
      ref={sidebarRef}
      as="aside"
      w={`${currentWidth}px`}
      h="100vh"
      bg={getBackgroundColor(colorMode, 'header')}
      _dark={{ bg: getBackgroundColor('dark', 'header') }}
      borderRight="1px solid"
      css={{
        borderColor: `${getBorderColor('light')} !important`,
        '.dark &': {
          borderColor: `${getBorderColor('dark')} !important`,
        }
      }}
      transition={isResizing ? 'none' : 'width 0.2s, left 0.2s'}
      position="fixed"
      left={`${isInClusterMode ? 0 : contextSidebarWidth}px`}
      top={0}
      zIndex={1000}
      display="flex"
      flexDirection="column"
    >
      {!isCollapsed && (
        <Box
          onMouseDown={handleMouseDown}
          cursor={isResizing ? 'col-resize' : 'ew-resize'}
          w="4px"
          h="100%"
          position="absolute"
          right={0}
          top={0}
          bg="transparent"
          _hover={{ bg: 'blue.200' }}
          zIndex={1001}
        />
      )}
      
      <VStack spacing={0} align="stretch" h="100%">
        <Box
          h="64px"
          p={isCollapsed ? 2 : 4}
          borderBottom="1px solid"
          css={{
            borderColor: `${getBorderColor('light')} !important`,
            '.dark &': {
              borderColor: `${getBorderColor('dark')} !important`,
            }
          }}
          display="flex"
          alignItems="center"
        >
          <HStack justify={isCollapsed ? 'center' : 'space-between'} w="100%" spacing={2}>
            {!isCollapsed && (
              <HStack spacing={3} align="center" flex={1}>
                <Image 
                  src="/images/cross-view-logo-sidebar.svg" 
                  alt="Crossview Logo" 
                  h="32px"
                  w="auto"
                  _dark={{ filter: 'brightness(0) invert(1)' }}
                />
                <Text fontSize="xl" fontWeight="bold" color={getTextColor(colorMode, 'inverse')} _dark={{ color: getTextColor('dark', 'inverse') }}>
                Crossview
              </Text>
              </HStack>
            )}
            {!isCollapsed && !isInClusterMode && (
              <Box
                as="button"
                onClick={() => {
                  const saved = localStorage.getItem('contextSidebarCollapsed');
                  const newState = saved !== 'true';
                  localStorage.setItem('contextSidebarCollapsed', newState.toString());
                  window.dispatchEvent(new CustomEvent('contextSidebarWidthChanged'));
                }}
                p={2}
                borderRadius="md"
                bg="transparent"
                display="flex"
                alignItems="center"
                justifyContent="center"
                minW="40px"
                minH="40px"
                aria-label="Toggle context sidebar"
                transition="all 0.2s"
                color={getTextColor(colorMode, 'secondary')}
                _dark={{ color: getTextColor('dark', 'secondary') }}
                _hover={{ 
                  bg: getBackgroundColor(colorMode, 'secondary'), 
                  _dark: { 
                    bg: getBackgroundColor('dark', 'secondary'),
                    color: getTextColor('dark', 'primary')
                  },
                  color: getTextColor(colorMode, 'primary')
                }}
                title="Toggle context sidebar"
              >
                <FiGrid size={18} />
              </Box>
            )}
            <Box
              as="button"
              onClick={toggleCollapse}
              p={2}
              borderRadius="md"
              bg="transparent"
              display="flex"
              alignItems="center"
              justifyContent="center"
              minW="40px"
              minH="40px"
              aria-label="Toggle sidebar"
              transition="all 0.2s"
              color="gray.600"
              _dark={{ color: 'gray.300' }}
              _hover={{ 
                bg: 'gray.100', 
                _dark: { 
                  bg: 'gray.800',
                  color: 'gray.200'
                },
                color: 'gray.700'
              }}
            >
              {isCollapsed ? (
                <FiChevronRight size={20} />
              ) : (
                <FiChevronLeft size={20} />
              )}
            </Box>
          </HStack>
        </Box>

        <Box flex={1} overflowY="auto" p={2}>
          {!isCollapsed && (
            <VStack spacing={1} align="stretch">
              <Text fontSize="xs" fontWeight="semibold" color={getTextColor(colorMode, 'tertiary')} px={3} py={2}>
                MENU
              </Text>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const subMenuItems = item.getSubMenuItems ? item.getSubMenuItems() : (item.subMenuItems || []);
                const isActive = location.pathname === item.path || (item.hasSubMenu && subMenuItems.some(sub => location.pathname === sub.path || location.pathname.startsWith(sub.path + '/')));
                const isExpanded = expandedMenus[item.id] || false;
                const hasSubMenu = item.hasSubMenu && subMenuItems && subMenuItems.length > 0;
                const shouldHideSubMenu = selectedContextError && hasSubMenu;
                
                return (
                  <Box key={item.id}>
                    <Box
                      as="button"
                      w="100%"
                      px={3}
                      py={2}
                      borderRadius="md"
                      textAlign="left"
                      bg={isActive ? getSidebarColor(colorMode, 'activeBg') : 'transparent'}
                      _dark={{ bg: isActive ? getBackgroundColor('dark', 'secondary') : 'transparent' }}
                      _hover={{ bg: isActive ? getSidebarColor(colorMode, 'hoverBg') : getBackgroundColor(colorMode, 'secondary'), _dark: { bg: isActive ? getBackgroundColor('dark', 'secondary') : getBackgroundColor('dark', 'secondary') } }}
                      onClick={() => {
                        if (hasSubMenu) {
                          toggleMenu(item.id);
                        } else {
                          navigate(item.path);
                        }
                      }}
                      transition="all 0.2s"
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <HStack spacing={3}>
                        <Icon 
                          size={18} 
                          style={{ 
                            color: isActive 
                              ? (colorMode === 'dark' ? colors.sidebar.dark.activeText : colors.sidebar.light.activeText)
                              : (colorMode === 'dark' ? colors.sidebar.dark.inactiveText : colors.sidebar.light.inactiveText)
                          }} 
                        />
                        <Text
                          fontSize="sm"
                          fontWeight={isActive ? 'semibold' : 'normal'}
                          color={isActive ? getAccentColor('blue', 'darker') : getTextColor(colorMode, 'primary')}
                          _dark={{ color: isActive ? getSidebarColor('dark', 'activeText') : getTextColor('dark', 'primary') }}
                        >
                          {item.label}
                        </Text>
                      </HStack>
                      {hasSubMenu && !shouldHideSubMenu && (
                        isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />
                      )}
                    </Box>
                    {hasSubMenu && isExpanded && !shouldHideSubMenu && (
                      <VStack spacing={0} align="stretch" pl={8} mt={1}>
                        {item.id === 'composite-resources' && loadingCompositeKinds ? (
                          <Box px={3} py={2} display="flex" alignItems="center" gap={2}>
                            <Box
                              w="12px"
                              h="12px"
                              border="2px solid"
                              borderColor={getBorderColor(colorMode, 'gray')}
                              borderTopColor={getAccentColor('blue', 'primary')}
                              borderRadius="50%"
                              style={{
                                animation: 'spin 1s linear infinite',
                              }}
                            />
                            <Text fontSize="xs" color={getTextColor(colorMode, 'tertiary')} _dark={{ color: getTextColor('dark', 'tertiary') }}>
                              Loading...
                            </Text>
                          </Box>
                        ) : subMenuItems.length === 0 ? (
                          <Box px={3} py={2}>
                            <Text fontSize="xs" color={getTextColor(colorMode, 'tertiary')} _dark={{ color: getTextColor('dark', 'tertiary') }}>
                              No items
                            </Text>
                          </Box>
                        ) : (
                          subMenuItems.map((subItem) => {
                            const isSubActive = location.pathname === subItem.path || location.pathname.startsWith(subItem.path + '/');
                            return (
                              <Box
                                key={subItem.id}
                                as="button"
                                w="100%"
                                px={3}
                                py={2}
                                borderRadius="md"
                                textAlign="left"
                                bg={isSubActive ? colors.sidebar.light.activeBg : 'transparent'}
                                _dark={{ bg: isSubActive ? 'gray.800' : 'transparent' }}
                                _hover={{ bg: isSubActive ? colors.sidebar.light.hoverBg : 'gray.100', _dark: { bg: isSubActive ? 'gray.800' : 'gray.800' } }}
                                onClick={() => navigate(subItem.path)}
                                transition="all 0.2s"
                              >
                                <Text
                                  fontSize="sm"
                                  fontWeight={isSubActive ? 'semibold' : 'normal'}
                                  color={isSubActive ? getAccentColor('blue', 'darker') : getTextColor(colorMode, 'secondary')}
                                  _dark={{ color: isSubActive ? getSidebarColor('dark', 'activeText') : getTextColor('dark', 'tertiary') }}
                                >
                                  {subItem.label}
                                </Text>
                              </Box>
                            );
                          })
                        )}
                      </VStack>
                    )}
                  </Box>
                );
              })}
            </VStack>
          )}
          {isCollapsed && (
            <VStack spacing={2} align="center" pt={2}>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Box
                    key={item.id}
                    as="button"
                    onClick={() => navigate(item.path)}
                    w="44px"
                    h="44px"
                    borderRadius="md"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    bg={isActive ? getSidebarColor(colorMode, 'hoverBg') : 'transparent'}
                    _dark={{ bg: isActive ? getBackgroundColor('dark', 'secondary') : 'transparent' }}
                    _hover={{ bg: isActive ? getAccentColor('blue', 'light') : getBackgroundColor(colorMode, 'secondary'), _dark: { bg: isActive ? getBackgroundColor('dark', 'secondary') : getBackgroundColor('dark', 'tertiary') } }}
                    aria-label={item.label}
                    transition="all 0.2s"
                  >
                    <Icon 
                      size={20} 
                      style={{ 
                        color: isActive 
                          ? (colorMode === 'dark' ? colors.sidebar.dark.activeText : colors.sidebar.light.activeText)
                          : (colorMode === 'dark' ? colors.sidebar.dark.inactiveText : colors.sidebar.light.inactiveText)
                      }} 
                    />
                  </Box>
                );
              })}
            </VStack>
          )}
        </Box>

        <Box
          p={isCollapsed ? 2 : 4}
          borderTop="1px solid"
          css={{
            borderColor: `${getBorderColor('light')} !important`,
            '.dark &': {
              borderColor: `${getBorderColor('dark')} !important`,
            }
          }}
        >
          {!isCollapsed && (
            <VStack spacing={3} align="stretch">
              <Box
                p={3}
                borderRadius="lg"
                bg={getBackgroundColor(colorMode, 'secondary')}
                border="1px solid"
                borderColor={getBorderColor(colorMode)}
                _dark={{
                  bg: getBackgroundColor('dark', 'secondary'),
                  borderColor: getBorderColor('dark')
                }}
              >
                <HStack justify="space-between" align="center" mb={1}>
                  <HStack spacing={2}>
                    <Box
                      as="a"
                      href="https://github.com/corpobit/crossview"
                      target="_blank"
                      rel="noopener noreferrer"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      w="22px"
                      h="22px"
                      borderRadius="md"
                      color={getTextColor(colorMode, 'primary')}
                      _dark={{ color: getTextColor('dark', 'primary') }}
                      _hover={{ bg: getBackgroundColor(colorMode, 'tertiary'), _dark: { bg: getBackgroundColor('dark', 'tertiary') } }}
                      transition="all 0.2s"
                      aria-label="Open Crossview GitHub repository"
                      title="Crossview on GitHub"
                    >
                      <FiGithub size={14} style={{ color: 'inherit' }} />
                    </Box>
                    <Text
                      fontSize="xs"
                      fontWeight="semibold"
                      color={getTextColor(colorMode, 'primary')}
                      _dark={{ color: getTextColor('dark', 'primary') }}
                      letterSpacing="0.03em"
                    >
                      CROSSVIEW
                    </Text>
                  </HStack>
                  <Box
                    px={2}
                    py={0.5}
                    borderRadius="full"
                    bg={getSidebarColor(colorMode, 'activeBg')}
                    _dark={{ bg: getSidebarColor('dark', 'activeBg') }}
                  >
                    <Text
                      fontSize="xs"
                      fontWeight="semibold"
                      color={getTextColor(colorMode, 'secondary')}
                      _dark={{ color: getTextColor('dark', 'secondary') }}
                    >
                      v{appVersion}
                    </Text>
                  </Box>
                </HStack>
                <Text
                  fontSize="xs"
                  color={getTextColor(colorMode, 'secondary')}
                  _dark={{ color: getTextColor('dark', 'secondary') }}
                >
                  Control plane visibility for Crossplane resources.
                </Text>
                <Text
                  fontSize="xs"
                  color={getTextColor(colorMode, 'tertiary')}
                  _dark={{ color: getTextColor('dark', 'tertiary') }}
                  mt={2}
                >
                  Maintained by Crossplane Contributors
                </Text>
                {updateInfo && (
                  <Box
                    as="a"
                    href={updateInfo.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    mt={3}
                    p={2}
                    borderRadius="md"
                    bg={updateInfo.isPrerelease ? 'purple.50' : 'green.50'}
                    border="1px solid"
                    borderColor={updateInfo.isPrerelease ? 'purple.200' : 'green.200'}
                    _dark={{
                      bg: updateInfo.isPrerelease ? 'rgba(168,85,247,0.15)' : 'rgba(16,185,129,0.15)',
                      borderColor: updateInfo.isPrerelease ? 'purple.700' : 'green.700',
                    }}
                    display="flex"
                    alignItems="center"
                    gap={2}
                    textDecoration="none"
                    transition="opacity 0.2s"
                    _hover={{ opacity: 0.8 }}
                  >
                    <FiArrowUp
                      size={12}
                      style={{ color: updateInfo.isPrerelease ? '#9333ea' : '#10b981', flexShrink: 0 }}
                    />
                    <Text
                      fontSize="xs"
                      fontWeight="medium"
                      color={updateInfo.isPrerelease ? 'purple.700' : 'green.700'}
                      _dark={{ color: updateInfo.isPrerelease ? 'purple.300' : 'green.300' }}
                    >
                      {updateInfo.isPrerelease ? 'RC' : 'Update'} v{updateInfo.latestVersion} available
                    </Text>
                  </Box>
                )}
              </Box>
            </VStack>
          )}
          {isCollapsed && (
            <VStack spacing={2} align="center">
              <Box
                as="a"
                href="https://github.com/corpobit/crossview"
                target="_blank"
                rel="noopener noreferrer"
                w="44px"
                h="44px"
                borderRadius="md"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg="transparent"
                _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
                aria-label="GitHub"
                transition="all 0.2s"
                textDecoration="none"
                color="gray.700"
                _dark={{ color: 'gray.300' }}
              >
                <FiGithub size={20} style={{ color: 'inherit' }} />
              </Box>
            </VStack>
          )}
        </Box>
      </VStack>

    </Box>
  );
};

Sidebar.propTypes = {
  onToggle: PropTypes.func,
  onResize: PropTypes.func,
};
