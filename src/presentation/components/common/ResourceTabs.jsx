import { HStack, Button } from '@chakra-ui/react';
import { FiActivity, FiGitMerge } from 'react-icons/fi';

export const ResourceTabs = ({ 
  activeTab, 
  setActiveTab, 
  fullResource, 
  resource, 
  hasStatus, 
  hasRelations, 
  isNamespaced,
  hasDrift,
}) => {
  return (
    <HStack spacing={0} borderBottom="1px solid" borderColor="gray.200" _dark={{ borderColor: 'gray.700' }} mb={4}>
      <Button
        variant="ghost"
        size="sm"
        borderRadius="none"
        borderBottom="2px solid"
        borderBottomColor={activeTab === 'overview' ? 'blue.500' : 'transparent'}
        color={activeTab === 'overview' ? 'blue.600' : 'gray.600'}
        _dark={{
          color: activeTab === 'overview' ? 'blue.400' : 'gray.400',
          borderBottomColor: activeTab === 'overview' ? 'blue.400' : 'transparent',
        }}
        onClick={() => setActiveTab('overview')}
        _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
      >
        Overview
      </Button>
      <Button
        variant="ghost"
        size="sm"
        borderRadius="none"
        borderBottom="2px solid"
        borderBottomColor={activeTab === 'yaml' ? 'blue.500' : 'transparent'}
        color={activeTab === 'yaml' ? 'blue.600' : 'gray.600'}
        _dark={{
          color: activeTab === 'yaml' ? 'blue.400' : 'gray.400',
          borderBottomColor: activeTab === 'yaml' ? 'blue.400' : 'transparent',
        }}
        onClick={() => setActiveTab('yaml')}
        _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
      >
        YAML
      </Button>
      {hasStatus && (
        <Button
          variant="ghost"
          size="sm"
          borderRadius="none"
          borderBottom="2px solid"
          borderBottomColor={activeTab === 'status' ? 'blue.500' : 'transparent'}
          color={activeTab === 'status' ? 'blue.600' : 'gray.600'}
          _dark={{
            color: activeTab === 'status' ? 'blue.400' : 'gray.400',
            borderBottomColor: activeTab === 'status' ? 'blue.400' : 'transparent',
          }}
          onClick={() => setActiveTab('status')}
          _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
          leftIcon={<FiActivity />}
        >
          Status
        </Button>
      )}
      {hasRelations && (
        <Button
          variant="ghost"
          size="sm"
          borderRadius="none"
          borderBottom="2px solid"
          borderBottomColor={activeTab === 'relations' ? 'blue.500' : 'transparent'}
          color={activeTab === 'relations' ? 'blue.600' : 'gray.600'}
          _dark={{
            color: activeTab === 'relations' ? 'blue.400' : 'gray.400',
            borderBottomColor: activeTab === 'relations' ? 'blue.400' : 'transparent',
          }}
          onClick={() => setActiveTab('relations')}
          _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
        >
          Relations
        </Button>
      )}
      {isNamespaced && (
        <Button
          variant="ghost"
          size="sm"
          borderRadius="none"
          borderBottom="2px solid"
          borderBottomColor={activeTab === 'events' ? 'blue.500' : 'transparent'}
          color={activeTab === 'events' ? 'blue.600' : 'gray.600'}
          _dark={{
            color: activeTab === 'events' ? 'blue.400' : 'gray.400',
            borderBottomColor: activeTab === 'events' ? 'blue.400' : 'transparent',
          }}
          onClick={() => setActiveTab('events')}
          _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
          leftIcon={<FiActivity />}
        >
          Events
        </Button>
      )}
      {hasDrift && (
        <Button
          variant="ghost"
          size="sm"
          borderRadius="none"
          borderBottom="2px solid"
          borderBottomColor={activeTab === 'drift' ? 'orange.500' : 'transparent'}
          color={activeTab === 'drift' ? 'orange.600' : 'gray.600'}
          _dark={{
            color: activeTab === 'drift' ? 'orange.400' : 'gray.400',
            borderBottomColor: activeTab === 'drift' ? 'orange.400' : 'transparent',
          }}
          onClick={() => setActiveTab('drift')}
          _hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}
          leftIcon={<FiGitMerge />}
        >
          Drift
        </Button>
      )}
    </HStack>
  );
};

