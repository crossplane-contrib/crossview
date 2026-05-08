import {
  Box,
  Text,
  HStack,
  VStack,
  SimpleGrid,
  Badge,
} from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppContext } from '../providers/AppProvider.jsx';
import { ResourceDetails } from '../components/common/ResourceDetails.jsx';
import { LoadingSpinner } from '../components/common/LoadingSpinner.jsx';
import { Dropdown } from '../components/common/Dropdown.jsx';
import { Input } from '../components/common/Input.jsx';
import { Container } from '../components/common/Container.jsx';
import { GetProvidersUseCase } from '../../domain/usecases/GetProvidersUseCase.js';

export const Providers = () => {
  const { kubernetesRepository, selectedContext } = useAppContext();
  const location = useLocation();
  const [providers, setProviders] = useState([]);
  const [filteredProviders, setFilteredProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [useSplitView, setUseSplitView] = useState(false);
  const gridContainerRef = useRef(null);
  const loadingContextRef = useRef(null);

  // Close resource detail when route changes
  useEffect(() => {
    setSelectedResource(null);
    setNavigationHistory([]);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;
    
    const loadProviders = async () => {
      if (!selectedContext) {
        setLoading(false);
        return;
      }
      
      const currentContext = selectedContext;
      loadingContextRef.current = currentContext;
      
      try {
        setLoading(true);
        setError(null);
        const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext.name || selectedContext;
        const useCase = new GetProvidersUseCase(kubernetesRepository);
        const data = await useCase.execute(contextName);
        
        if (isMounted && loadingContextRef.current === currentContext) {
          setProviders(data);
        }
      } catch (err) {
        if (isMounted && loadingContextRef.current === currentContext) {
          setError(err.message);
        }
      } finally {
        if (isMounted && loadingContextRef.current === currentContext) {
          setLoading(false);
        }
      }
    };

    loadProviders();
    
    return () => {
      isMounted = false;
    };
  }, [selectedContext, kubernetesRepository]);

  useEffect(() => {
    let filtered = providers;
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        const isHealthy = p.healthy;
        const isInstalled = p.installed;
        let status = 'Not Installed';
        if (isInstalled) {
          status = isHealthy ? 'Healthy' : 'Unhealthy';
        }
        return status === statusFilter;
      });
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.package && p.package.toLowerCase().includes(query)) ||
        (p.revision && p.revision.toLowerCase().includes(query)) ||
        (p.controllerConfigRef && p.controllerConfigRef.toLowerCase().includes(query))
      );
    }
    
    setFilteredProviders(filtered);
  }, [providers, statusFilter, searchQuery]);

  useEffect(() => {
    if (!selectedResource || !gridContainerRef.current) {
      setUseSplitView(false);
      return;
    }

    const checkGridHeight = () => {
      const container = gridContainerRef.current;
      if (!container) return;
      
      const viewportHeight = window.innerHeight;
      const halfViewport = (viewportHeight - 100) * 0.5; // Account for header
      const gridHeight = container.scrollHeight;
      
      setUseSplitView(gridHeight > halfViewport);
    };

    // Check immediately
    checkGridHeight();

    // Check on resize
    const resizeObserver = new ResizeObserver(checkGridHeight);
    resizeObserver.observe(gridContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [selectedResource, filteredProviders]);

  if (loading) {
    return <LoadingSpinner message="Loading providers..." />;
  }

  if (error) {
    return (
      <Box>
        <Text fontSize="2xl" fontWeight="bold" mb={6}>Providers</Text>
        <Box
          p={6}
          bg="red.50"
          _dark={{ bg: 'red.900', borderColor: 'red.700', color: 'red.100' }}
          border="1px"
          borderColor="red.200"
          borderRadius="md"
          color="red.800"
        >
          <Text fontWeight="bold" mb={2}>Error loading providers</Text>
          <Text>{error}</Text>
        </Box>
      </Box>
    );
  }

  const handleCardClick = (item) => {
    const clickedResource = {
      apiVersion: item.apiVersion || 'pkg.crossplane.io/v1',
      kind: item.kind || 'Provider',
      name: item.name,
      namespace: item.namespace || null,
    };

    // If clicking the same card that's already open, close the slideout
    if (selectedResource && 
        selectedResource.name === clickedResource.name &&
        selectedResource.kind === clickedResource.kind &&
        selectedResource.apiVersion === clickedResource.apiVersion &&
        selectedResource.namespace === clickedResource.namespace) {
      setSelectedResource(null);
      setNavigationHistory([]);
      return;
    }

    // Otherwise, open/update the slideout with the new resource
    // Clear navigation history when opening from grid (not from another resource)
    setNavigationHistory([]);
    setSelectedResource(clickedResource);
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

  const getStatusBadge = (provider) => {
    const isHealthy = provider.healthy;
    const isInstalled = provider.installed;
    let status = 'Not Installed';
    let colorScheme = 'gray';
    
    if (isInstalled) {
      status = isHealthy ? 'Healthy' : 'Unhealthy';
      colorScheme = isHealthy ? 'green' : 'yellow';
    }
    
        return (
      <Badge
        colorScheme={colorScheme}
              px={2}
              py={1}
              borderRadius="md"
              fontSize="xs"
              fontWeight="semibold"
      >
        {status}
      </Badge>
    );
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      position="relative"
    >
      <HStack justify="space-between" mb={6}>
        <Text fontSize="2xl" fontWeight="bold">Providers</Text>
        <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
          {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''}
        </Text>
      </HStack>

      <HStack spacing={4} mb={4}>
        <Box flex={1} position="relative">
          <Box
            position="absolute"
            left="12px"
            top="14px"
            zIndex={1}
            pointerEvents="none"
            color="gray.400"
          >
            <FiSearch size={18} />
          </Box>
          <Input
            placeholder="Search providers by name, package, revision..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            pl="40px"
          />
        </Box>
        <Dropdown
          minW="180px"
          placeholder="All Statuses"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'Healthy', label: 'Healthy' },
            { value: 'Unhealthy', label: 'Unhealthy' },
            { value: 'Not Installed', label: 'Not Installed' }
          ]}
        />
      </HStack>

      <Box
        display="flex"
        flexDirection="column"
        gap={4}
      >
        <Box
          ref={gridContainerRef}
          flex={selectedResource ? (useSplitView ? '0 0 50%' : '0 0 auto') : '1'}
          display="flex"
          flexDirection="column"
          minH={0}
          maxH={selectedResource && useSplitView ? '50vh' : 'none'}
          overflowY={selectedResource && useSplitView ? 'auto' : 'visible'}
        >
          {filteredProviders.length === 0 ? (
              <Container p={8} textAlign="center">
                <Text color="gray.500" fontSize="lg">
                  No providers found
                </Text>
              </Container>
            ) : (
              <SimpleGrid
                columns={{ base: 1, md: 2, lg: 3, xl: 4 }}
                spacing={6}
                p={4}
              >
                {filteredProviders.map((provider) => (
                  <Container
                    key={provider.name}
                    p={4}
                    m={2}
                    cursor="pointer"
                    _hover={{
                      transform: 'translateY(-2px)',
                      boxShadow: 'md',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => handleCardClick(provider)}
                    transition="all 0.2s"
                  >
                    <VStack align="stretch" spacing={3}>
                      <HStack justify="space-between" align="start">
                        <Text
                          fontSize="lg"
                          fontWeight="bold"
                          noOfLines={1}
                          title={provider.name}
                        >
                          {provider.name}
                        </Text>
                        {getStatusBadge(provider)}
                      </HStack>

                      <VStack align="stretch" spacing={2}>
                        <Box>
                          <Text fontSize="xs" color="gray.500" mb={1}>
                            Package
                          </Text>
                          <Text fontSize="sm" noOfLines={2} title={provider.package}>
                            {provider.package || '-'}
                          </Text>
                        </Box>

                        {provider.revision && (
                          <Box>
                            <Text fontSize="xs" color="gray.500" mb={1}>
                              Revision
                            </Text>
                            <Text fontSize="sm">{provider.revision}</Text>
                          </Box>
                        )}

                        {provider.controllerConfigRef && (
                          <Box>
                            <Text fontSize="xs" color="gray.500" mb={1}>
                              Controller Config
                            </Text>
                            <Text fontSize="sm" noOfLines={1}>
                              {provider.controllerConfigRef}
                            </Text>
                          </Box>
                        )}

                        {provider.creationTimestamp && (
                          <Box>
                            <Text fontSize="xs" color="gray.500" mb={1}>
                              Created
                            </Text>
                            <Text fontSize="sm">
                              {new Date(provider.creationTimestamp).toLocaleDateString()}
                            </Text>
                          </Box>
                        )}
                      </VStack>
                    </VStack>
                  </Container>
                ))}
              </SimpleGrid>
            )}
        </Box>
        
        {selectedResource && (
          <Box
            flex="1"
            display="flex"
            flexDirection="column"
            mb={8}
          >
            <ResourceDetails
                resource={selectedResource}
                onClose={handleClose}
                onNavigate={handleNavigate}
                onBack={navigationHistory.length > 0 ? handleBack : undefined}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

