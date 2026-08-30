import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Textarea,
  Input,
  Icon,
} from '@chakra-ui/react';
import { FiUpload, FiCheckCircle, FiAlertCircle, FiCheck, FiTrash2, FiRefreshCw, FiDatabase, FiServer } from 'react-icons/fi';
import { useState, useRef } from 'react';
import { Container } from '../components/common/Container.jsx';
import { Dialog } from '../components/common/Dialog.jsx';
import { useAppContext } from '../providers/AppProvider.jsx';

const MAX_CONTEXT_BADGE_LABEL_LENGTH = 8;

export const ContextManagement = () => {
  const { contexts, kubernetesRepository, getKubernetesContextsUseCase, selectedContext, colorMode, contextAliases } = useAppContext();
  const [kubeConfigText, setKubeConfigText] = useState('');
  const [loading, setLoading] = useState(false);
  const [deletingContext, setDeletingContext] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [contextToDelete, setContextToDelete] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const fileInputRef = useRef(null);

  const getFirstLetter = (name) => (name ? name.charAt(0).toUpperCase() : '?');

  const getContextBadgeLabel = (name) => {
    const rawLabel = (contextAliases[name] || getFirstLetter(name) || '?').trim();
    if (rawLabel.length <= MAX_CONTEXT_BADGE_LABEL_LENGTH) {
      return rawLabel;
    }
    return `${rawLabel.slice(0, MAX_CONTEXT_BADGE_LABEL_LENGTH - 1)}...`;
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        setKubeConfigText(content);
        setValidationError(null);
        setError(null);
      }
    };
    reader.readAsText(file);
  };

  const validateKubeConfig = async (configText) => {
    if (!configText.trim()) {
      setValidationError('Kubeconfig cannot be empty');
      return false;
    }

    try {
      const lines = configText.trim().split('\n');
      if (lines.length === 0) {
        setValidationError('Kubeconfig cannot be empty');
        return false;
      }

      const hasApiVersion = lines.some(line => line.includes('apiVersion:'));
      const hasKind = lines.some(line => line.includes('kind:'));

      if (!hasApiVersion || !hasKind) {
        setValidationError('Invalid kubeconfig format: missing apiVersion or kind');
        return false;
      }

      return true;
    } catch (err) {
      setValidationError(err.message || 'Invalid kubeconfig format');
      return false;
    }
  };

  const handleAddContext = async () => {
    setError(null);
    setSuccess(null);
    setValidationError(null);

    if (!kubeConfigText.trim()) {
      setError('Please provide a kubeconfig');
      return;
    }

    setLoading(true);
    try {
      const isValid = await validateKubeConfig(kubeConfigText);
      if (!isValid) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/contexts/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ kubeConfig: kubeConfigText }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          if (response.status === 404) {
            errorMessage = 'Endpoint not found. Please ensure the backend server is running and has been restarted with the latest changes.';
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setSuccess(result.message || 'Context added successfully');
      setKubeConfigText('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await refreshContexts();
    } catch (err) {
      setError(err.message || 'Failed to add context');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveContextClick = (contextName) => {
    setContextToDelete(contextName);
    setIsDeleteDialogOpen(true);
  };

  const handleRemoveContextConfirm = async () => {
    if (!contextToDelete) return;

    setDeletingContext(contextToDelete);
    setError(null);
    setSuccess(null);
    setIsDeleteDialogOpen(false);

    try {
      await kubernetesRepository.removeContext(contextToDelete);
      setSuccess(`Context "${contextToDelete}" removed successfully`);
      await refreshContexts();
    } catch (err) {
      setError(err.message || 'Failed to remove context');
    } finally {
      setDeletingContext(null);
      setContextToDelete(null);
    }
  };

  const refreshContexts = async () => {
    setRefreshing(true);
    try {
      await getKubernetesContextsUseCase.execute();
      window.dispatchEvent(new CustomEvent('contextsUpdated'));
    } catch (err) {
      console.warn('Failed to refresh contexts:', err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Box>
      <HStack justify="space-between" align="center" mb={6}>
        <Text fontSize="2xl" fontWeight="bold">
          Context Management
        </Text>
        <Button
          leftIcon={<FiRefreshCw />}
          onClick={refreshContexts}
          variant="outline"
          size="sm"
          isLoading={refreshing}
        >
          Refresh
        </Button>
      </HStack>

      <VStack spacing={6} align="stretch">
        {contexts && contexts.length > 0 && (
          <Container p={6}>
            <HStack justify="space-between" align="center" mb={4}>
              <HStack spacing={3}>
                <Icon as={FiDatabase} boxSize={5} color="blue.500" />
                <Text fontSize="lg" fontWeight="semibold">
                  Existing Contexts
                </Text>
              </HStack>
              <Text fontSize="sm" color="gray.500" _dark={{ color: 'gray.400' }}>
                {contexts.length} {contexts.length === 1 ? 'context' : 'contexts'}
              </Text>
            </HStack>
            <VStack spacing={3} align="stretch">
              {contexts.map((contextName) => {
                const name = typeof contextName === 'string' ? contextName : contextName?.name || contextName;
                const isSelected = selectedContext === name;
                const hasError = false;
                const rawAlias = contextAliases[name] || '';
                const label = getContextBadgeLabel(name);

                return (
                  <Box
                    key={name}
                    p={4}
                    borderRadius="lg"
                    border="1px solid"
                    borderColor={isSelected ? 'blue.300' : 'gray.200'}
                    bg={isSelected ? 'blue.50' : 'white'}
                    _dark={{
                      borderColor: isSelected ? 'blue.600' : 'gray.600',
                      bg: isSelected ? 'blue.900' : 'gray.800'
                    }}
                    transition="all 0.2s"
                    _hover={{
                      borderColor: isSelected ? 'blue.400' : 'gray.300',
                      shadow: 'sm',
                      transform: 'translateY(-1px)',
                      _dark: {
                        borderColor: isSelected ? 'blue.500' : 'gray.500'
                      }
                    }}
                  >
                    <HStack justify="space-between" align="center">
                      <HStack spacing={3} flex={1}>
                        <Box
                          w="40px"
                          h="40px"
                          borderRadius="lg"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          bg={isSelected ? 'blue.500' : 'gray.200'}
                          color={isSelected ? 'white' : 'gray.700'}
                          _dark={{ bg: isSelected ? 'blue.600' : 'gray.700', color: isSelected ? 'white' : 'gray.300' }}
                          fontWeight="bold"
                          fontSize={label.length > 3 ? 'sm' : 'lg'}
                          flexShrink={0}
                          title={rawAlias || name}
                        >
                          {label}
                        </Box>
                        <VStack align="start" spacing={0} flex={1} minW={0}>
                          <HStack spacing={2} align="center">
                            <Text
                              fontSize="md"
                              fontWeight="semibold"
                              noOfLines={1}
                              color={isSelected ? 'blue.700' : 'gray.800'}
                              _dark={{ color: isSelected ? 'blue.200' : 'gray.200' }}
                            >
                              {name}
                            </Text>
                            {isSelected && (
                              <Box
                                px={2}
                                py={0.5}
                                borderRadius="full"
                                bg="blue.100"
                                fontSize="xs"
                                fontWeight="medium"
                                color="blue.700"
                                _dark={{ bg: 'blue.800', color: 'blue.200' }}
                              >
                                Active
                              </Box>
                            )}
                            {hasError && (
                              <Icon as={FiAlertCircle} boxSize={4} color="red.500" />
                            )}
                          </HStack>
                          <Text
                            fontSize="xs"
                            color="gray.500"
                            _dark={{ color: 'gray.400' }}
                            noOfLines={1}
                          >
                            {hasError ? 'Connection error' : 'Kubernetes context'}
                          </Text>
                        </VStack>
                      </HStack>
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        leftIcon={<FiTrash2 />}
                        onClick={() => handleRemoveContextClick(name)}
                        isLoading={deletingContext === name}
                        isDisabled={deletingContext !== null || refreshing}
                        _hover={{
                          bg: 'red.50',
                          _dark: { bg: 'red.900' }
                        }}
                      >
                        Remove
                      </Button>
                    </HStack>
                  </Box>
                );
              })}
            </VStack>
          </Container>
        )}

        <Container p={6}>
          <VStack spacing={4} align="stretch">
            <HStack spacing={3} mb={2}>
              <Icon as={FiServer} boxSize={5} color="blue.500" />
              <Text fontSize="lg" fontWeight="semibold">
                Add Kubernetes Context
              </Text>
            </HStack>
            <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }} mb={2}>
              Upload a kubeconfig file or paste the kubeconfig content. The context will be verified before being added.
            </Text>

            <HStack spacing={4}>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                display="none"
                id="kubeconfig-file-input"
              />
              <Button
                leftIcon={<FiUpload />}
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                borderColor="gray.300"
                color="gray.700"
                _dark={{ borderColor: 'gray.600', color: 'gray.300', _hover: { bg: 'gray.700', borderColor: 'gray.500' } }}
                _hover={{ bg: 'gray.50', borderColor: 'gray.400' }}
              >
                Upload File
              </Button>
              <Text fontSize="sm" color="gray.500" _dark={{ color: 'gray.400' }}>
                or
              </Text>
              <Text fontSize="sm" color="gray.600" _dark={{ color: 'gray.400' }}>
                Paste kubeconfig below
              </Text>
            </HStack>

            <Textarea
              value={kubeConfigText}
              onChange={(e) => {
                setKubeConfigText(e.target.value);
                setValidationError(null);
                setError(null);
              }}
              placeholder="Paste your kubeconfig YAML here..."
              minH="300px"
              fontFamily="mono"
              fontSize="sm"
              bg="white"
              borderColor="gray.300"
              color="gray.800"
              _dark={{
                bg: 'gray.700',
                borderColor: 'gray.600',
                color: 'gray.200',
                _placeholder: { color: 'gray.400' }
              }}
              _focus={{
                borderColor: 'blue.500',
                boxShadow: '0 0 0 1px var(--chakra-colors-blue-500)',
                _dark: {
                  borderColor: 'blue.400',
                  boxShadow: '0 0 0 1px var(--chakra-colors-blue-400)'
                }
              }}
            />

            {validationError && (
              <Box
                p={4}
                borderRadius="md"
                bg="red.50"
                _dark={{ bg: 'red.900', borderColor: 'red.700' }}
                border="1px solid"
                borderColor="red.200"
              >
                <HStack spacing={3} align="flex-start">
                  <Icon as={FiAlertCircle} boxSize={5} color="red.500" flexShrink={0} mt={0.5} />
                  <Box flex={1}>
                    <Text fontSize="md" fontWeight="semibold" color="red.800" _dark={{ color: 'red.200' }} mb={1}>
                      Validation Error
                    </Text>
                    <Text fontSize="sm" color="red.700" _dark={{ color: 'red.300' }}>
                      {validationError}
                    </Text>
                  </Box>
                </HStack>
              </Box>
            )}

            {error && (
              <Box
                p={4}
                borderRadius="md"
                bg="red.50"
                _dark={{ bg: 'red.900', borderColor: 'red.700' }}
                border="1px solid"
                borderColor="red.200"
              >
                <HStack spacing={3} align="flex-start">
                  <Icon as={FiAlertCircle} boxSize={5} color="red.500" flexShrink={0} mt={0.5} />
                  <Box flex={1}>
                    <Text fontSize="md" fontWeight="semibold" color="red.800" _dark={{ color: 'red.200' }} mb={1}>
                      Error
                    </Text>
                    <Text fontSize="sm" color="red.700" _dark={{ color: 'red.300' }}>
                      {error}
                    </Text>
                  </Box>
                </HStack>
              </Box>
            )}

            {success && (
              <Box
                p={4}
                borderRadius="md"
                bg="green.50"
                _dark={{ bg: 'green.900', borderColor: 'green.700' }}
                border="1px solid"
                borderColor="green.200"
              >
                <HStack spacing={3} align="flex-start">
                  <Icon as={FiCheck} boxSize={5} color="green.500" flexShrink={0} mt={0.5} />
                  <Box flex={1}>
                    <Text fontSize="md" fontWeight="semibold" color="green.800" _dark={{ color: 'green.200' }} mb={1}>
                      Success
                    </Text>
                    <Text fontSize="sm" color="green.700" _dark={{ color: 'green.300' }}>
                      {success}
                    </Text>
                  </Box>
                </HStack>
              </Box>
            )}

            <HStack justify="flex-end" spacing={3}>
              <Button
                onClick={() => {
                  setKubeConfigText('');
                  setError(null);
                  setSuccess(null);
                  setValidationError(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
                variant="ghost"
              >
                Clear
              </Button>
              <Button
                onClick={handleAddContext}
                isLoading={loading}
                leftIcon={loading ? undefined : <FiCheckCircle />}
                colorScheme="blue"
              >
                Add Context
              </Button>
            </HStack>
          </VStack>
        </Container>
      </VStack>

      <Dialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleRemoveContextConfirm}
        title="Remove Context"
        message={`Are you sure you want to remove context "${contextToDelete}"? This action cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        confirmColorScheme="red"
        colorMode={colorMode}
      />
    </Box>
  );
};

