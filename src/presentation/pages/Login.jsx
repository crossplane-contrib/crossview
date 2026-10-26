import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
} from '@chakra-ui/react';
import { Input } from '../components/common/Input.jsx';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../providers/AppProvider.jsx';
import { colors, getBorderColor, getBackgroundColor, getTextColor } from '../utils/theme.js';
import { withBasePath } from '../../basePath';

export const Login = () => {
  const navigate = useNavigate();
  const { authService, authChecked, user, login, colorMode } = useAppContext();
  const [isRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [authState, setAuthState] = useState(null);
  const [ssoStatus, setSsoStatus] = useState(null);

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);


  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Load SSO status
        const [sso, auth] = await Promise.all([
          authService.getSSOStatus(),
          authService.checkAuth(),
        ]);
        setSsoStatus(sso);
        setAuthState(auth);
        
        if (auth.authenticated) {
          navigate('/');
        }
      } catch (err) {
        console.error('Error checking auth:', err);
      }
    };
    if (authChecked && !user) {
      checkAuth();
    }
  }, [authChecked, user, navigate, authService]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ username, password });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked || (authState === null && !user)) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minH="100vh"
        bg={getBackgroundColor(colorMode, 'html')}
      >
        <VStack spacing={4}>
          <Box
            w="40px"
            h="40px"
            border="4px solid"
            borderColor={getBorderColor(colorMode, 'gray')}
            borderTopColor={getTextColor(colorMode, 'primary')}
            borderRadius="full"
            animation="spin 1s linear infinite"
          />
          <Text color={getTextColor(colorMode, 'secondary')} fontSize="sm">
            Loading...
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box
      minH="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      p={6}
      position="relative"
      overflow="hidden"
      bg={getBackgroundColor(colorMode, 'html')}
      css={{
        background: colorMode === 'dark'
          ? `linear-gradient(135deg, ${getBackgroundColor(colorMode, 'primary')} 0%, ${getBackgroundColor(colorMode, 'secondary')} 50%, ${getBackgroundColor(colorMode, 'primary')} 100%)`
          : `linear-gradient(135deg, ${getBackgroundColor(colorMode, 'html')} 0%, ${getBackgroundColor(colorMode, 'primary')} 50%, ${getBackgroundColor(colorMode, 'html')} 100%)`,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            radial-gradient(circle at 1px 1px, ${colors.pattern[colorMode].primary} 1px, transparent 0),
            radial-gradient(circle at 1px 1px, ${colors.pattern[colorMode].secondary} 1px, transparent 0)
          `,
          backgroundSize: '40px 40px, 20px 20px',
          backgroundPosition: '0 0, 20px 20px',
          opacity: 0.3,
          pointerEvents: 'none',
        }
      }}
    >
      <Box
        w="100%"
        maxW="400px"
        position="relative"
        zIndex={1}
      >
        {/* Login Form Card */}
        <Box
          w="100%"
          bg={getBackgroundColor(colorMode, 'primary')}
          borderRadius="xl"
          border="1px solid"
          borderColor={getBorderColor(colorMode, 'default')}
          p={8}
          boxShadow={colorMode === 'dark'
            ? `0 20px 60px ${colors.shadow.dark}, 0 0 0 1px ${getBorderColor(colorMode, 'default')}`
            : `0 20px 60px ${colors.shadow.light}, 0 0 0 1px ${getBorderColor(colorMode, 'default')}`
          }
          css={{
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s ease',
          }}
        >
          <VStack spacing={8} align="center" w="100%">
            {/* Logo */}
            <Box
              w="180px"
              h="110px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              mb={4}
            >
              <Box
                as="img"
                src={withBasePath('/images/crossview-logo.svg')}
                alt="Crossview Logo"
                w="100%"
                h="100%"
                objectFit="contain"
                css={{
                  filter: colorMode === 'dark' ? 'invert(1)' : 'none',
                  transition: 'transform 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.02)',
                  }
                }}
              />
            </Box>

            <VStack spacing={6} align="stretch" w="100%">

              {error && (
                <Box
                  p={4}
                  bg={colorMode === 'dark' ? 'red.950/50' : 'red.50'}
                  border="1px solid"
                  borderColor={colorMode === 'dark' ? 'red.800' : 'red.200'}
                  borderRadius="lg"
                  display="flex"
                  alignItems="center"
                  gap={3}
                  animation="slideIn 0.3s ease-out"
                >
                  <Box
                    w="20px"
                    h="20px"
                    borderRadius="full"
                    bg="red.500"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    <Text color="white" fontSize="xs" fontWeight="bold">!</Text>
                  </Box>
                  <Text fontSize="sm" color={colorMode === 'dark' ? 'red.300' : 'red.700'} fontWeight="500">
                    {error}
                  </Text>
                </Box>
              )}

              <Box as="form" onSubmit={handleSubmit} w="100%">
                {(

                    <VStack spacing={4} align="stretch">
                      <Input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        required
                      />
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                      />
                    </VStack>
                )}

                  <Button
                    type="submit"
                    w="100%"
                    mt={4}
                    bg={colorMode === 'dark' ? getTextColor(colorMode, 'primary') : getTextColor('light', 'primary')}
                    _hover={{
                      bg: colorMode === 'dark' ? getTextColor(colorMode, 'secondary') : getTextColor('light', 'secondary'),
                      transform: 'translateY(-1px)',
                      boxShadow: `0 4px 12px ${colors.shadow[colorMode]}`
                    }}
                    _active={{
                      transform: 'translateY(0)',
                    }}
                    color={colorMode === 'dark' ? getBackgroundColor(colorMode, 'primary') : getBackgroundColor('light', 'primary')}
                    disabled={loading}
                    py={6}
                    fontSize="md"
                    fontWeight="600"
                    borderRadius="lg"
                    transition="all 0.2s ease"
                  >
                    {loading ? (
                      <HStack spacing={2}>
                        <Box
                          w="16px"
                          h="16px"
                          border="2px solid"
                          borderColor={colorMode === 'dark' ? getBackgroundColor(colorMode, 'primary') : getBackgroundColor('light', 'primary')}
                          borderTopColor="transparent"
                          borderRadius="full"
                          animation="spin 0.8s linear infinite"
                        />
                        <Text>Processing...</Text>
                      </HStack>
                    ) : (
                      isRegisterMode ? 'Create Account' : 'Sign In'
                    )}
                  </Button>
              </Box>

              {/* SSO Login Options */}
              {(ssoStatus.oidc.enabled || ssoStatus.saml.enabled) && (
                <>
                    <HStack spacing={4} align="center" w="100%">
                      <Box h="1px" flex={1} bg={getBorderColor(colorMode, 'gray')} />
                      <Text
                        fontSize="xs"
                        fontWeight="600"
                        color={getTextColor(colorMode, 'tertiary')}
                        textTransform="uppercase"
                        letterSpacing="1px"
                        px={2}
                      >
                        Or continue with
                      </Text>
                      <Box h="1px" flex={1} bg={getBorderColor(colorMode, 'gray')} />
                    </HStack>
                  <VStack spacing={3} align="stretch" w="100%">
                    {ssoStatus.oidc.enabled && (
                      <Button
                        as="a"
                        href={authService.getOIDCLoginURL()}
                        w="100%"
                        py={6}
                        bg={getBackgroundColor(colorMode, 'primary')}
                        _hover={{
                          bg: getBackgroundColor(colorMode, 'secondary'),
                          transform: 'translateY(-1px)',
                          boxShadow: `0 4px 12px ${colors.shadow[colorMode]}`
                        }}
                        _active={{
                          transform: 'translateY(0)',
                        }}
                        color={getTextColor(colorMode, 'primary')}
                        border="1px solid"
                        borderColor={getBorderColor(colorMode, 'default')}
                        borderRadius="lg"
                        fontWeight="600"
                        fontSize="sm"
                        transition="all 0.2s ease"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={2}
                      >
                        <Box
                          w="20px"
                          h="20px"
                          borderRadius="sm"
                          bg="blue.500"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Text color="white" fontSize="xs" fontWeight="bold">O</Text>
                        </Box>
                        Sign in with OIDC
                      </Button>
                    )}
                    {ssoStatus.saml.enabled && (
                      <Button
                        as="a"
                        href={authService.getSAMLLoginURL()}
                        w="100%"
                        py={6}
                        bg={getBackgroundColor(colorMode, 'primary')}
                        _hover={{
                          bg: getBackgroundColor(colorMode, 'secondary'),
                          transform: 'translateY(-1px)',
                          boxShadow: `0 4px 12px ${colors.shadow[colorMode]}`
                        }}
                        _active={{
                          transform: 'translateY(0)',
                        }}
                        color={getTextColor(colorMode, 'primary')}
                        border="1px solid"
                        borderColor={getBorderColor(colorMode, 'default')}
                        borderRadius="lg"
                        fontWeight="600"
                        fontSize="sm"
                        transition="all 0.2s ease"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={2}
                      >
                        <Box
                          w="20px"
                          h="20px"
                          borderRadius="sm"
                          bg="green.500"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                        >
                          <Text color="white" fontSize="xs" fontWeight="bold">S</Text>
                        </Box>
                        Sign in with SAML
                      </Button>
                    )}
                  </VStack>
                </>
              )}
                <Text
                  fontSize="sm"
                  textAlign="center"
                  color={getTextColor(colorMode, 'tertiary')}
                  mt={2}
                  fontWeight="500"
                >
                  Need an account? Contact an administrator
                </Text>
              
            </VStack>
          </VStack>
        </Box>
      </Box>
    </Box>
  );
};

