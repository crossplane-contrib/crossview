import { Box, Text, HStack, Icon, Button, VStack } from '@chakra-ui/react';
import { FiAlertCircle, FiChevronRight } from 'react-icons/fi';
import { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar.jsx';
import { ContextSidebar } from './ContextSidebar.jsx';
import { Header } from './Header.jsx';
import { OnWatchResourcesSlideout } from '../common/OnWatchResourcesSlideout.jsx';
import { NotificationToast } from '../common/NotificationToast.jsx';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { useOnWatchResources } from '../../providers/OnWatchResourcesProvider.jsx';
import { getBackgroundColor } from '../../utils/theme.js';

export const Layout = ({ children }) => {
  const { colorMode, selectedContextError, selectedContext, isInClusterMode, contexts, setSelectedContext } = useAppContext();
  const { watchedResources, isCollapsed: isOnWatchCollapsed, notifications, removeNotification } = useOnWatchResources();
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [contextSidebarWidth, setContextSidebarWidth] = useState(60);
  const [showContextSidebar, setShowContextSidebar] = useState(() => {
    if (isInClusterMode) return false;
    const saved = localStorage.getItem('contextSidebarCollapsed');
    return saved !== 'true';
  });
  const onWatchWidth = watchedResources.length > 0 && !isOnWatchCollapsed ? 400 : 0;

  const getWorkingContexts = () => {
    try {
      const workingCtxs = JSON.parse(localStorage.getItem('workingContexts') || '[]');
      const contextNames = contexts.map(ctx => typeof ctx === 'string' ? ctx : ctx?.name || ctx);
      return contextNames.filter(ctx => workingCtxs.includes(ctx) && ctx !== selectedContext);
    } catch {
      return [];
    }
  };

  const workingContexts = getWorkingContexts();
  const hasContextError = selectedContextError && selectedContext;
  const showMainSidebar = !hasContextError;

  const handleSidebarToggle = (collapsed, width) => {
    setSidebarWidth(width || (collapsed ? 60 : 280));
  };

  const handleSidebarResize = (newWidth) => {
    setSidebarWidth(newWidth);
  };

  useEffect(() => {
    if (isInClusterMode) {
      setContextSidebarWidth(0);
      setShowContextSidebar(false);
      return;
    }
    const updateContextSidebarWidth = () => {
      const saved = localStorage.getItem('contextSidebarCollapsed');
      const isCollapsed = saved === 'true';
      setContextSidebarWidth(isCollapsed ? 0 : 60);
      setShowContextSidebar(!isCollapsed);
    };
    updateContextSidebarWidth();
    const handleWidthChange = () => {
      updateContextSidebarWidth();
    };
    window.addEventListener('contextSidebarWidthChanged', handleWidthChange);
    return () => window.removeEventListener('contextSidebarWidthChanged', handleWidthChange);
  }, [isInClusterMode]);

  const bgColor = getBackgroundColor(colorMode, 'html');
  const totalLeftWidth = showMainSidebar ? sidebarWidth + (isInClusterMode ? 0 : contextSidebarWidth) : 0;

  if (hasContextError) {
    return (
      <Box minH="100vh" bg={bgColor}>
        <Box 
          minH="100vh"
          display="flex"
          alignItems="center"
          justifyContent="center"
          p={6}
        >
          <Box maxW="500px" w="100%">
            <Box
              p={6}
              borderRadius="md"
              bg="red.50"
              _dark={{ bg: 'red.900', borderColor: 'red.700' }}
              border="1px solid"
              borderColor="red.200"
            >
              <VStack spacing={4} align="stretch">
                <HStack spacing={3} align="flex-start">
                  <Icon as={FiAlertCircle} boxSize={8} color="red.500" flexShrink={0} />
                  <Box flex={1}>
                    <Text fontSize="lg" fontWeight="bold" color="red.800" _dark={{ color: 'red.200' }} mb={1}>
                      Context Connection Error
                    </Text>
                    <Text fontSize="sm" color="red.700" _dark={{ color: 'red.300' }}>
                      {selectedContextError}
                    </Text>
                  </Box>
                </HStack>
                {workingContexts.length > 0 && (
                  <VStack align="stretch" spacing={3} pt={4} borderTop="1px solid" borderColor="red.200" _dark={{ borderColor: 'red.700' }}>
                    <Text fontSize="sm" fontWeight="semibold" color="red.700" _dark={{ color: 'red.300' }}>
                      Switch to an available context:
                    </Text>
                    <VStack spacing={2} align="stretch">
                      {workingContexts.map((ctx) => (
                        <Button
                          key={ctx}
                          w="100%"
                          colorScheme="red"
                          variant="solid"
                          fontSize="sm"
                          onClick={() => setSelectedContext(ctx)}
                          rightIcon={<FiChevronRight boxSize={4} />}
                          justifyContent="space-between"
                          px={4}
                        >
                          {ctx}
                        </Button>
                      ))}
                    </VStack>
                  </VStack>
                )}
              </VStack>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg={bgColor}>
      {!isInClusterMode && showContextSidebar && <ContextSidebar />}
      <Sidebar onToggle={handleSidebarToggle} onResize={handleSidebarResize} />
      <Box 
        ml={`${totalLeftWidth}px`} 
        mr={`${onWatchWidth}px`}
        transition="margin-left 0.2s, margin-right 0.3s"
        w={`calc(100% - ${totalLeftWidth}px - ${onWatchWidth}px)`}
        maxW={`calc(100% - ${totalLeftWidth}px - ${onWatchWidth}px)`}
        overflow="hidden"
      >
        <Header sidebarWidth={totalLeftWidth} />
        <Box pt="64px" px={6} pb={0} mb={0} bg={bgColor} minH="calc(100vh - 64px)" w="100%" maxW="100%" overflowX="hidden">
          <Box pt={6} pb={0} mb={0}>
            {children}
          </Box>
        </Box>
      </Box>
      <OnWatchResourcesSlideout />
      {notifications.map((notification, index) => (
        <Box
          key={notification.id}
          position="fixed"
          top={`${80 + index * 90}px`}
          right="24px"
          zIndex={10000}
        >
          <NotificationToast
            message={notification.message}
            resourceName={notification.resourceName}
            onClose={() => removeNotification(notification.id)}
            colorMode={colorMode}
          />
        </Box>
      ))}
    </Box>
  );
};

