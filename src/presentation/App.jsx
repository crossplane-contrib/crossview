import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Login } from './pages/Login.jsx';
import { Settings } from './pages/Settings.jsx';
import { Providers } from './pages/Providers.jsx';
import { Functions } from './pages/Functions.jsx';
import { Compositions } from './pages/Compositions.jsx';
import { CompositeResourceDefinitions } from './pages/CompositeResourceDefinitions.jsx';
import { ManagedResourceDefinitions } from './pages/ManagedResourceDefinitions.jsx';
import { ManagedResourceActivationPolicies } from './pages/ManagedResourceActivationPolicies.jsx';
import { CompositeResources } from './pages/CompositeResources.jsx';
import { Claims } from './pages/Claims.jsx';
import { Resources } from './pages/Resources.jsx';
import { ResourceKind } from './pages/ResourceKind.jsx';
import { CompositeResourceKind } from './pages/CompositeResourceKind.jsx';
import { Search } from './pages/Search.jsx';
import { Policies } from './pages/Policies.jsx';
import { Analytics } from './pages/Analytics.jsx';
import { useAppContext } from './providers/AppProvider.jsx';
import { OnWatchResourcesProvider } from './providers/OnWatchResourcesProvider.jsx';
import { Box, Text, VStack, Icon, Button } from '@chakra-ui/react';
import { FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

const ProtectedRoute = ({ children }) => {
  const { user, authChecked, serverError } = useAppContext();

  if (!authChecked) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh">
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (serverError) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="gray.50" _dark={{ bg: 'gray.900' }}>
        <VStack spacing={4} maxW="500px" p={8} bg="white" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }} borderRadius="lg" boxShadow="lg" border="1px solid" borderColor="gray.200">
          <Icon as={FiAlertCircle} boxSize={12} color="red.500" />
          <Text fontSize="xl" fontWeight="bold" textAlign="center">
            Server Connection Error
          </Text>
          <Text fontSize="md" color="gray.600" _dark={{ color: 'gray.400' }} textAlign="center">
            {serverError}
          </Text>
          <Button
            leftIcon={<FiRefreshCw />}
            colorScheme="blue"
            onClick={() => window.location.reload()}
            mt={2}
          >
            Retry Connection
          </Button>
        </VStack>
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, authChecked, serverError } = useAppContext();

  if (!authChecked) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh">
        <Text>Loading...</Text>
      </Box>
    );
  }

  if (serverError) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minH="100vh" bg="gray.50" _dark={{ bg: 'gray.900' }}>
        <VStack spacing={4} maxW="500px" p={8} bg="white" _dark={{ bg: 'gray.800', borderColor: 'gray.700' }} borderRadius="lg" boxShadow="lg" border="1px solid" borderColor="gray.200">
          <Icon as={FiAlertCircle} boxSize={12} color="red.500" />
          <Text fontSize="xl" fontWeight="bold" textAlign="center">
            Server Connection Error
          </Text>
          <Text fontSize="md" color="gray.600" _dark={{ color: 'gray.400' }} textAlign="center">
            {serverError}
          </Text>
          <Button
            leftIcon={<FiRefreshCw />}
            colorScheme="blue"
            onClick={() => window.location.reload()}
            mt={2}
          >
            Retry Connection
          </Button>
        </VStack>
      </Box>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <OnWatchResourcesProvider>
            <Layout>
              <Routes>
                <Route index element={<Dashboard />} />
                <Route path="providers" element={<Providers />} />
                <Route path="functions" element={<Functions />} />
                <Route path="compositions" element={<Compositions />} />
                <Route path="xrds" element={<CompositeResourceDefinitions />} />
                <Route path="mrds" element={<ManagedResourceDefinitions />} />
                <Route path="mraps" element={<ManagedResourceActivationPolicies />} />
                <Route path="composite-resources" element={<CompositeResources />} />
                <Route path="composite-resources/:kind" element={<CompositeResourceKind />} />
                <Route path="claims" element={<Claims />} />
                <Route path="managed-resources" element={<Resources />} />
                <Route path="policies" element={<Policies />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="resources" element={<Navigate to="/managed-resources" replace />} />
                <Route path="resources/:kind" element={<ResourceKind />} />
                <Route path="search" element={<Search />} />
                <Route path="settings/*" element={<Settings />} />
              </Routes>
            </Layout>
            </OnWatchResourcesProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
