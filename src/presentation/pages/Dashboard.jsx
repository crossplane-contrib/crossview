import {
  Box,
  Text,
} from '@chakra-ui/react';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../providers/AppProvider.jsx';
import { ResourceDetails } from '../components/common/ResourceDetails.jsx';
import { DashboardDataContext, useDashboardData } from '../hooks/useDashboardData.js';
import { getBackgroundColor, getTextColor, getBorderColor, getAccentColor } from '../utils/theme.js';

const ProvidersStatusWidget = lazy(() => import('../components/widgets/ProvidersStatusWidget.jsx').then(module => ({ default: module.ProvidersStatusWidget })));
const FunctionsCountWidget = lazy(() => import('../components/widgets/FunctionsCountWidget.jsx').then(module => ({ default: module.FunctionsCountWidget })));
const CompositionsCountWidget = lazy(() => import('../components/widgets/CompositionsCountWidget.jsx').then(module => ({ default: module.CompositionsCountWidget })));
const ClaimsCountWidget = lazy(() => import('../components/widgets/ClaimsCountWidget.jsx').then(module => ({ default: module.ClaimsCountWidget })));
const XRDCountWidget = lazy(() => import('../components/widgets/XRDCountWidget.jsx').then(module => ({ default: module.XRDCountWidget })));
const CompositeResourcesWidget = lazy(() => import('../components/widgets/CompositeResourcesWidget.jsx').then(module => ({ default: module.CompositeResourcesWidget })));
const ResourceHealthWidget = lazy(() => import('../components/widgets/ResourceHealthWidget.jsx').then(module => ({ default: module.ResourceHealthWidget })));
const ManagedResourcesCountWidget = lazy(() => import('../components/widgets/ManagedResourcesCountWidget.jsx').then(module => ({ default: module.ManagedResourcesCountWidget })));
const NamespaceDistributionWidget = lazy(() => import('../components/widgets/NamespaceDistributionWidget.jsx').then(module => ({ default: module.NamespaceDistributionWidget })));
const RecentActivityWidget = lazy(() => import('../components/widgets/RecentActivityWidget.jsx').then(module => ({ default: module.RecentActivityWidget })));

// Loading fallback component for each widget
// eslint-disable-next-line react/prop-types
const WidgetSuspense = ({ children }) => {
  const { colorMode } = useAppContext();
  return (
    <Suspense fallback={
      <Box 
        p={6} 
        bg={getBackgroundColor(colorMode, 'header')} 
        _dark={{ bg: getBackgroundColor('dark', 'header'), borderColor: getBorderColor('dark', 'gray') }} 
        border="1px solid" 
        borderColor={getBorderColor(colorMode, 'gray')}
        borderRadius="md" 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minH="150px"
      >
        <Text fontSize="sm" color={getTextColor(colorMode, 'tertiary')}>Loading...</Text>
      </Box>
    }>
      {children}
    </Suspense>
  );
};

export const Dashboard = () => {
  const location = useLocation();
  const { kubernetesRepository, selectedContext, colorMode } = useAppContext();
  const dashboardData = useDashboardData(kubernetesRepository, selectedContext);
  const [selectedResource, setSelectedResource] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);

  // Close resource detail when route changes
  useEffect(() => {
    setSelectedResource(null);
    setNavigationHistory([]);
  }, [location.pathname]);

  const handleResourceClick = (resource) => {
    // If clicking the same resource that's already open, close the slideout
    if (selectedResource && 
        selectedResource.name === resource.name &&
        selectedResource.kind === resource.kind &&
        selectedResource.apiVersion === resource.apiVersion &&
        selectedResource.namespace === resource.namespace) {
      setSelectedResource(null);
      setNavigationHistory([]);
      return;
    }

    // Otherwise, open/update the slideout with the new resource
    setNavigationHistory([]);
    setSelectedResource(resource);
  };

  const handleNavigate = (resource) => {
    setNavigationHistory(prev => [...prev, selectedResource]);
    setSelectedResource(resource);
  };

  const handleBack = () => {
    if (navigationHistory.length > 0) {
      const previous = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));
      setSelectedResource(previous);
    } else {
      setSelectedResource(null);
    }
  };

  const handleClose = () => {
    setSelectedResource(null);
    setNavigationHistory([]);
  };

  if (!selectedContext) {
    return (
      <Box>
        <Text fontSize="2xl" fontWeight="bold" mb={6}>
          Dashboard
        </Text>
        <Box p={6} bg={getAccentColor('yellow', 'light')} _dark={{ bg: getAccentColor('yellow', 'primary'), color: getTextColor('dark', 'inverse') }} borderRadius="md" color={getTextColor(colorMode, 'primary')}>
          <Text>Please select a Kubernetes context to view the dashboard.</Text>
        </Box>
      </Box>
    );
  }

  return (
    <DashboardDataContext.Provider value={dashboardData}>
    <Box position="relative" pb={8}>
      <Box mb={4}>
        <Text fontSize="3xl" fontWeight="semibold" color={getTextColor(colorMode, 'primary')} _dark={{ color: getTextColor('dark', 'primary') }} mb={2}>
          Dashboard
        </Text>
        <Text fontSize="sm" color={getTextColor(colorMode, 'secondary')} _dark={{ color: getTextColor('dark', 'tertiary') }}>
          Overview of your Crossplane resources and cluster status
        </Text>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)', xl: 'repeat(6, 1fr)' }}
        gap={4}
        mb={4}
      >
        <WidgetSuspense>
          <CompositionsCountWidget />
        </WidgetSuspense>
        
        <WidgetSuspense>
          <ClaimsCountWidget />
        </WidgetSuspense>

        <WidgetSuspense>
          <XRDCountWidget />
        </WidgetSuspense>

        <WidgetSuspense>
          <ManagedResourcesCountWidget />
        </WidgetSuspense>

        <WidgetSuspense>
          <ProvidersStatusWidget />
        </WidgetSuspense>

        <WidgetSuspense>
          <FunctionsCountWidget />
        </WidgetSuspense>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', lg: '1fr 1fr' }}
        gap={4}
        mb={4}
      >
        <WidgetSuspense>
          <ResourceHealthWidget />
        </WidgetSuspense>
        
        <WidgetSuspense>
          <NamespaceDistributionWidget />
        </WidgetSuspense>
      </Box>

      <Box
        display="grid"
        gridTemplateColumns={{ base: '1fr', lg: 'minmax(250px, 350px) minmax(0, 1fr)' }}
        gap={4}
        alignItems="stretch"
        w="100%"
        maxW="100%"
      >
        <Box h="100%" minW={0} maxW="100%" overflow="hidden">
          <WidgetSuspense>
            <RecentActivityWidget />
          </WidgetSuspense>
        </Box>
        
        <Box h="100%" minW={0} maxW="100%" overflow="hidden">
          <WidgetSuspense>
            <CompositeResourcesWidget onResourceClick={handleResourceClick} />
          </WidgetSuspense>
        </Box>
      </Box>

      {selectedResource && (
        <ResourceDetails
          resource={selectedResource}
          onClose={handleClose}
          onNavigate={handleNavigate}
          onBack={navigationHistory.length > 0 ? handleBack : undefined}
        />
      )}
    </Box>
    </DashboardDataContext.Provider>
  );
};
