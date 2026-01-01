/**
 * Phantom Messenger - Main App Component
 * 
 * Root component that routes between views
 */

import { useEffect } from 'react';
import { 
  SetupView, 
  ChatView, 
  InviteView, 
  SettingsView, 
  DestroyView 
} from './components';
import { 
  useUIStore, 
  useIdentityStore, 
  useConnectionStore 
} from './store';
import { identityService } from './services/identity';
import { wsClient } from './services/websocket';

function App() {
  const currentView = useUIStore((state) => state.currentView);
  const setView = useUIStore((state) => state.setView);
  const identity = useIdentityStore((state) => state.identity);
  const setIdentity = useIdentityStore((state) => state.setIdentity);
  const connectionStatus = useConnectionStore((state) => state.status);
  const setConnectionStatus = useConnectionStore((state) => state.setStatus);

  // Initialize on mount
  useEffect(() => {
    initializeApp();
  }, []);

  // Handle connection state changes
  useEffect(() => {
    // If we have identity and connection is ready, go to chat
    if (identity && connectionStatus === 'authenticated' && currentView === 'setup') {
      setView('chat');
    }
  }, [identity, connectionStatus, currentView, setView]);

  const initializeApp = async () => {
    // Try to restore existing identity
    const existingIdentity = identityService.loadIdentity();
    
    if (existingIdentity) {
      setIdentity(existingIdentity);
      
      // Connect to server
      setConnectionStatus('connecting');
      
      try {
        await wsClient.connect();
        setConnectionStatus('connected');
        
        // Authenticate with server
        const authenticated = await wsClient.authenticate();
        if (authenticated) {
          setConnectionStatus('authenticated');
        }
      } catch (error) {
        console.error('Connection error:', error);
        setConnectionStatus('disconnected');
      }
    } else {
      // No identity, show setup
      setView('setup');
    }
  };

  // Render current view
  const renderView = () => {
    switch (currentView) {
      case 'setup':
        return <SetupView />;
      case 'chat':
        return <ChatView />;
      case 'invite':
        return <InviteView />;
      case 'settings':
        return <SettingsView />;
      case 'destroy':
        return <DestroyView />;
      default:
        return <SetupView />;
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-dark-100">
      {renderView()}
    </div>
  );
}

export default App;
