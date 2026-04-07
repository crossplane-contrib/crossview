import {
  Box,
  Text,
  HStack,
  Button,
  Badge,
} from '@chakra-ui/react';
import { FiArrowLeft, FiMinus, FiEye, FiEyeOff } from 'react-icons/fi';
import { useState } from 'react';
import { useAppContext } from '../../providers/AppProvider.jsx';
import { useOnWatchResources } from '../../providers/OnWatchResourcesProvider.jsx';
import { useResourceData } from '../../hooks/useResourceData.js';
import { ResourceTabs } from './ResourceTabs.jsx';
import { ResourceOverview } from './ResourceOverview.jsx';
import { ResourceYAML } from './ResourceYAML.jsx';
import { ResourceStatus } from './ResourceStatus.jsx';
import { ResourceRelations } from './ResourceRelations.jsx';
import { ResourceEvents } from './ResourceEvents.jsx';
import { ResourceDrift } from './ResourceDrift.jsx';
import { ResourceHistory } from './ResourceHistory.jsx';
import { getBorderColor } from '../../utils/theme.js';

export const ResourceDetails = ({ resource, onClose, onNavigate, onBack }) => {
  const { colorMode } = useAppContext();
  const { addResource, removeResource, watchedResources } = useOnWatchResources();
  const [activeTab, setActiveTab] = useState('overview');
  
  // Use the custom hook for resource data loading
  const { loading, fullResource, relatedResources, events, eventsLoading } = useResourceData(resource);

  const getResourceKey = (res) => {
    return `${res.apiVersion || ''}:${res.kind || ''}:${res.metadata?.namespace || ''}:${res.metadata?.name || ''}`;
  };

  // Check if resource is watched - use both current resource and fullResource
  const currentResource = fullResource || resource;
  const resourceKey = currentResource ? getResourceKey(currentResource) : null;
  const watchedResource = resourceKey ? watchedResources.find(r => {
    const rKey = r._key || getResourceKey(r);
    return rKey === resourceKey;
  }) : null;
  const isWatched = !!watchedResource;

  const handleWatchToggle = () => {
    if (isWatched && watchedResource) {
      // Unwatch the resource - use _key if available, otherwise calculate it
      const keyToRemove = watchedResource._key || getResourceKey(watchedResource);
      removeResource(keyToRemove);
    } else {
      // Watch the resource
      const resourceToAdd = fullResource || resource;
      if (resourceToAdd) {
        const resourceWithPlural = {
          ...resourceToAdd,
          _plural: resource.plural || resourceToAdd.plural || null,
        };
        addResource(resourceWithPlural);
      }
    }
  };

  if (!resource) return null;

  const handleRelatedClick = (related) => {
    // Ensure namespace is null (not "undefined" string) for cluster-scoped resources
    const namespace = related.namespace && related.namespace !== 'undefined' && related.namespace !== 'null' ? related.namespace : null;
    onNavigate({
      apiVersion: related.apiVersion,
      kind: related.kind,
      name: related.name,
      namespace: namespace,
      plural: related.plural || null, // Include plural if available
    });
  };

  return (
    <Box
      flex="1"
      display="flex"
      flexDirection="column"
      border="1px solid"
      borderRadius="lg"
      css={{
        borderColor: `${getBorderColor('light')} !important`,
        '.dark &': {
          borderColor: `${getBorderColor('dark')} !important`,
        }
      }}
      mt={4}
      pt={4}
      px={4}
      pb={4}
    >
      <Box
        p={4}
        pt={6}
        flexShrink={0}
        position="relative"
      >
        <HStack spacing={1} position="absolute" top={2} right={2}>
          <Button
            size="sm"
            variant={isWatched ? "solid" : "outline"}
            onClick={handleWatchToggle}
            colorScheme={isWatched ? "blue" : "blue"}
            fontSize="xs"
            px={2}
            h="24px"
          >
            <HStack spacing={1} alignItems="center">
              {isWatched ? <FiEyeOff size={14} /> : <FiEye size={14} />}
              <Text fontSize="xs">{isWatched ? "Watching" : "Watch"}</Text>
            </HStack>
          </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label="Minimize"
          minW="auto"
          w="32px"
          h="32px"
          p={0}
        >
          <FiMinus />
        </Button>
        </HStack>
        {onBack && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onBack}
            aria-label="Back"
            minW="auto"
            w="32px"
            h="32px"
            p={0}
            mb={3}
          >
            <FiArrowLeft />
          </Button>
        )}
        <HStack spacing={2} align="center">
          <Text fontSize="lg" fontWeight="bold" color="gray.700" _dark={{ color: 'gray.300' }}>
            {resource.kind || 'Resource'}
          </Text>
          <Badge colorScheme="blue">{resource.apiVersion}</Badge>
        </HStack>
        <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mt={1}>
          {resource.name}
          {resource.namespace && ` • ${resource.namespace}`}
        </Text>
      </Box>

      <Box flex={1} minH={0}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minH="200px" p={4}>
            <Text color="gray.700" _dark={{ color: 'gray.300' }}>Loading resource details...</Text>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column">
            {/* Tabs Navigation */}
            <Box px={4} pt={4} flexShrink={0}>
              <ResourceTabs
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                fullResource={fullResource}
                resource={resource}
                hasStatus={!!fullResource.status}
                hasRelations={relatedResources.length > 0}
                isNamespaced={(() => {
                  const namespace = fullResource.metadata?.namespace || resource.namespace || fullResource.namespace;
                  if (namespace && namespace !== 'undefined' && namespace !== 'null') {
                    return true;
                  }
                  const resourceKind = fullResource.kind || resource.kind;
                  const clusterScopedKinds = [
                    'CompositeResourceDefinition', 'Composition', 'Provider', 'ProviderConfig', 
                    'ClusterRole', 'ClusterRoleBinding', 'Namespace', 'Node', 'PersistentVolume'
                  ];
                  const isCompositeResource = resourceKind && resourceKind.startsWith('X') && !namespace;
                  const isClusterScoped = clusterScopedKinds.includes(resourceKind) || isCompositeResource;
                  
                  if (isCompositeResource) {
                    const hasResourceRefs = fullResource.spec?.resourceRefs && fullResource.spec.resourceRefs.length > 0;
                    return hasResourceRefs;
                  }
                  
                  return !isClusterScoped;
                })()}
              />
            </Box>

            {/* Tab Content */}
            <Box flex={1} minH={0}>
              {activeTab === 'overview' && (
                <ResourceOverview
                  fullResource={fullResource}
                  resource={resource}
                  relatedResources={relatedResources}
                  onRelatedClick={handleRelatedClick}
                />
              )}

              {activeTab === 'status' && <ResourceStatus fullResource={fullResource} />}

              {activeTab === 'yaml' && <ResourceYAML fullResource={fullResource} colorMode={colorMode} />}

              {activeTab === 'events' && <ResourceEvents events={events} eventsLoading={eventsLoading} />}

              {activeTab === 'relations' && (
                <ResourceRelations 
                  resource={resource} 
                  relatedResources={relatedResources} 
                  colorMode={colorMode} 
                />
              )}

              {activeTab === 'drift' && (
                <ResourceDrift resource={resource} fullResource={fullResource} />
              )}

              {activeTab === 'history' && (
                <ResourceHistory resource={resource} fullResource={fullResource} />
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

