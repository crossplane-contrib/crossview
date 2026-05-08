import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { BrowserRouter } from 'react-router-dom';
import { KubernetesApiRepository } from '../../data/repositories/KubernetesApiRepository.js';
import { GetDashboardDataUseCase } from '../../domain/usecases/GetDashboardDataUseCase.js';
import { GetKubernetesContextsUseCase } from '../../domain/usecases/GetKubernetesContextsUseCase.js';
import { AuthService } from '../../domain/services/AuthService.js';
import { UserService } from '../../domain/services/UserService.js';
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { colors } from '../utils/theme.js';

const AppContext = createContext(null);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const kubernetesRepository = useMemo(() => new KubernetesApiRepository(), []);
  const getDashboardDataUseCase = useMemo(() => new GetDashboardDataUseCase(kubernetesRepository), [kubernetesRepository]);
  const getKubernetesContextsUseCase = useMemo(() => new GetKubernetesContextsUseCase(kubernetesRepository), [kubernetesRepository]);
  const authService = useMemo(() => new AuthService(), []);
  const userService = useMemo(() => new UserService(), []);
  const [selectedContext, setSelectedContext] = useState(() => {
    try {
      const saved = localStorage.getItem('lastUsedContext');
      return saved || null;
    } catch {
      return null;
    }
  });
  const [contexts, setContexts] = useState([]);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [contextErrors, setContextErrors] = useState({});
  const [workingContexts, setWorkingContexts] = useState(() => {
    try {
      const saved = localStorage.getItem('workingContexts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [colorMode, setColorMode] = useState(() => {
    const saved = localStorage.getItem('colorMode');
    return saved || 'light';
  });
  const [savedSearches, setSavedSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('savedSearches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isInClusterMode = useMemo(() => {
    if (contexts.length !== 1) return false;
    const contextName = typeof contexts[0] === 'string' ? contexts[0] : contexts[0]?.name || contexts[0];
    return contextName === 'in-cluster';
  }, [contexts]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setServerError(null);
        const authState = await authService.checkAuth();
        if (authState.authenticated) {
          setUser(authState.user);
        }
        if (authState.authMode != null) {
          setAuthMode(authState.authMode);
        }
      } catch (error) {
        console.warn('Failed to check auth:', error);
        const errorMessage = (error.message || '').toLowerCase();
        const errorName = error.name || '';
        const originalError = error.originalError || error;
        
        const isAuthError = errorMessage.includes('401') || 
                           errorMessage.includes('403') || 
                           errorMessage.includes('unauthorized') || 
                           errorMessage.includes('forbidden');
        
        if (!isAuthError) {
          setServerError('Unable to connect to the server. Please ensure the server is running and accessible.');
        } else {
          setServerError(null);
        }
      } finally {
        setAuthChecked(true);
      }
    };
    checkAuth();
  }, [authService]);

  useEffect(() => {
    const loadContexts = async () => {
      if (!user) return;
      try {
        const contextsList = await getKubernetesContextsUseCase.execute();
        setContexts(contextsList);
        
        if (contextsList.length > 0) {
          const contextNames = contextsList.map(ctx => typeof ctx === 'string' ? ctx : ctx?.name || ctx);
          const currentContextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name || selectedContext;
          
          if (currentContextName && contextNames.includes(currentContextName)) {
            try {
              const isValid = await kubernetesRepository.isConnected(currentContextName);
              if (isValid) {
                await kubernetesRepository.setContext(currentContextName);
                setWorkingContexts(prev => {
                  if (!prev.includes(currentContextName)) {
                    const updated = [...prev, currentContextName];
                    localStorage.setItem('workingContexts', JSON.stringify(updated));
                    return updated;
                  }
                  return prev;
                });
                return;
              }
            } catch (error) {
              console.warn(`Saved context ${currentContextName} is not working, trying others...`);
            }
          }
          
          const lastUsedContext = localStorage.getItem('lastUsedContext');
          let contextToSet = null;
          
          if (lastUsedContext && contextNames.includes(lastUsedContext)) {
            contextToSet = lastUsedContext;
          } else {
          const current = await kubernetesRepository.getCurrentContext();
            if (current && contextNames.includes(current)) {
              contextToSet = current;
            } else {
              const workingContextsList = JSON.parse(localStorage.getItem('workingContexts') || '[]');
              const workingContext = workingContextsList.find(ctx => contextNames.includes(ctx));
              if (workingContext) {
                contextToSet = workingContext;
              } else {
                contextToSet = contextNames[0];
              }
            }
          }
          
          if (contextToSet) {
            try {
              const isValid = await kubernetesRepository.isConnected(contextToSet);
              if (isValid) {
                await kubernetesRepository.setContext(contextToSet);
          setSelectedContext(contextToSet);
                localStorage.setItem('lastUsedContext', contextToSet);
                setWorkingContexts(prev => {
                  const updated = prev.includes(contextToSet) ? prev : [...prev, contextToSet];
                  localStorage.setItem('workingContexts', JSON.stringify(updated));
                  return updated;
                });
              } else {
                await tryFindWorkingContext(contextsList, contextNames);
              }
            } catch (error) {
              console.warn(`Context ${contextToSet} is not working, trying others...`);
              await tryFindWorkingContext(contextsList, contextNames);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to load contexts:', error.message);
        setContexts([]);
      }
    };
    
    const tryFindWorkingContext = async (contextsList, contextNames) => {
      for (const contextName of contextNames) {
        try {
          const isValid = await kubernetesRepository.isConnected(contextName);
          if (isValid) {
            await kubernetesRepository.setContext(contextName);
            setSelectedContext(contextName);
            localStorage.setItem('lastUsedContext', contextName);
            setWorkingContexts(prev => {
              const updated = prev.includes(contextName) ? prev : [...prev, contextName];
              localStorage.setItem('workingContexts', JSON.stringify(updated));
              return updated;
            });
            return;
          }
        } catch (error) {
          continue;
        }
      }
    };
    
    if (contexts.length === 0 && user) {
      loadContexts();
    }
  }, [user, kubernetesRepository, getKubernetesContextsUseCase]);

  useEffect(() => {
    const handleContextsUpdated = async () => {
      if (!user) return;
      try {
        const contextsList = await getKubernetesContextsUseCase.execute();
        setContexts(contextsList);
      } catch (error) {
        console.warn('Failed to refresh contexts:', error.message);
      }
    };

    window.addEventListener('contextsUpdated', handleContextsUpdated);
    return () => {
      window.removeEventListener('contextsUpdated', handleContextsUpdated);
    };
  }, [user, getKubernetesContextsUseCase]);

  useEffect(() => {
    const checkContextConnection = async () => {
      if (!selectedContext || !user) return;
      
      const contextNameStr = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name || selectedContext;
      if (!contextNameStr) return;
      
      try {
        const isConnected = await kubernetesRepository.isConnected(contextNameStr);
        
        if (!isConnected) {
          setContextErrors(prev => ({
            ...prev,
            [contextNameStr]: 'Unable to connect to the Kubernetes cluster. Please check your connection settings.'
          }));
          setWorkingContexts(prev => {
            const updated = prev.filter(ctx => ctx !== contextNameStr);
            localStorage.setItem('workingContexts', JSON.stringify(updated));
            return updated;
          });
          tryNextWorkingContext(contextNameStr);
        } else {
          setContextErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[contextNameStr];
            return newErrors;
          });
          setWorkingContexts(prev => {
            if (!prev.includes(contextNameStr)) {
              const updated = [...prev, contextNameStr];
              localStorage.setItem('workingContexts', JSON.stringify(updated));
              return updated;
            }
            return prev;
          });
        }
      } catch (error) {
        setContextErrors(prev => ({
          ...prev,
          [contextNameStr]: error.message || 'Failed to connect to the Kubernetes cluster.'
        }));
        setWorkingContexts(prev => {
          const updated = prev.filter(ctx => ctx !== contextNameStr);
          localStorage.setItem('workingContexts', JSON.stringify(updated));
          return updated;
        });
        tryNextWorkingContext(contextNameStr);
      }
    };
    
    checkContextConnection();
  }, [selectedContext, user, kubernetesRepository]);

  const handleContextChange = async (contextName) => {
    try {
      const contextNameStr = typeof contextName === 'string' ? contextName : contextName?.name || contextName;
      
      try {
        await kubernetesRepository.setContext(contextNameStr);
      } catch (error) {
        console.warn('Error setting context:', error);
      }
      
      setSelectedContext(contextNameStr);
      localStorage.setItem('lastUsedContext', contextNameStr);
      setContextErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[contextNameStr];
        return newErrors;
      });
      
      kubernetesRepository.isConnected(contextNameStr).then(isConnected => {
        if (isConnected) {
          setWorkingContexts(prev => {
            if (!prev.includes(contextNameStr)) {
              const updated = [...prev, contextNameStr];
              localStorage.setItem('workingContexts', JSON.stringify(updated));
              return updated;
            }
            return prev;
          });
        } else {
          setContextErrors(prev => ({
            ...prev,
            [contextNameStr]: 'Unable to connect to the Kubernetes cluster. Please check your connection settings.'
          }));
          setWorkingContexts(prev => {
            const updated = prev.filter(ctx => ctx !== contextNameStr);
            localStorage.setItem('workingContexts', JSON.stringify(updated));
            return updated;
          });
          tryNextWorkingContext(contextNameStr);
        }
      }).catch(error => {
        console.error('Error checking context connection:', error);
        setContextErrors(prev => ({
          ...prev,
          [contextNameStr]: error.message || 'Unable to connect to the Kubernetes cluster.'
        }));
      });
    } catch (error) {
      console.error('Error switching context:', error);
    }
  };

  const tryNextWorkingContext = (failedContext) => {
    const contextNames = contexts.map(ctx => typeof ctx === 'string' ? ctx : ctx?.name || ctx);
    const workingCtxList = JSON.parse(localStorage.getItem('workingContexts') || '[]');
    
    const availableContexts = contextNames.filter(ctx => ctx !== failedContext && workingCtxList.includes(ctx));
    
    if (availableContexts.length > 0) {
      setTimeout(() => {
        handleContextChange(availableContexts[0]);
      }, 500);
    }
  };

  const handleLogin = async (credentials) => {
    const result = await authService.login(credentials);
    setUser(result.user);
    return result;
  };

  const handleRegister = async (data) => {
    const result = await authService.register(data);
    setUser(result.user);
    return result;
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  const handleColorModeChange = (mode) => {
    setColorMode(mode);
    localStorage.setItem('colorMode', mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    const bgColor = colors.background[colorMode].html;
    
    if (colorMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    document.documentElement.style.backgroundColor = bgColor;
    document.body.style.backgroundColor = bgColor;
  }, [colorMode]);

  const handleSaveSearch = (searchQuery) => {
    const updated = [...savedSearches, { ...searchQuery, id: Date.now() }];
    setSavedSearches(updated);
    localStorage.setItem('savedSearches', JSON.stringify(updated));
  };

  const handleLoadSearch = (searchQuery) => {
  };

  const handleDeleteSearch = (searchId) => {
    const updated = savedSearches.filter(s => s.id !== searchId);
    setSavedSearches(updated);
    localStorage.setItem('savedSearches', JSON.stringify(updated));
  };

  const value = useMemo(() => {
    const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name || selectedContext;
    const selectedContextError = contextName ? contextErrors[contextName] : null;
    
    return {
    kubernetesRepository,
    getDashboardDataUseCase,
    getKubernetesContextsUseCase,
    authService,
    userService,
    selectedContext,
    contexts,
    authMode,
    setSelectedContext: handleContextChange,
    user,
    authChecked,
    serverError,
      contextErrors,
      selectedContextError,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    colorMode,
    setColorMode: handleColorModeChange,
    savedSearches,
    saveSearch: handleSaveSearch,
    loadSearch: handleLoadSearch,
    deleteSearch: handleDeleteSearch,
    isInClusterMode,
    };
  }, [kubernetesRepository, getDashboardDataUseCase, getKubernetesContextsUseCase, authService, userService, selectedContext, contexts, user, authChecked, serverError, contextErrors, colorMode, savedSearches, isInClusterMode,authMode]);

  return (
    <ChakraProvider value={defaultSystem}>
      <BrowserRouter>
        <AppContext.Provider value={value}>
          {children}
        </AppContext.Provider>
      </BrowserRouter>
    </ChakraProvider>
  );
};

