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
  useConnectionStore,
  useConversationsStore,
  useMessagesStore
} from './store';
import { identityService } from './services/identity';
import { wsClient, SyncedMessage } from './services/websocket';
import { bytesToBase64 } from '@phantom/crypto';
import type { Message, Conversation } from '@phantom/shared';

function App() {
  const currentView = useUIStore((state) => state.currentView);
  const setView = useUIStore((state) => state.setView);
  const identity = useIdentityStore((state) => state.identity);
  const setIdentity = useIdentityStore((state) => state.setIdentity);
  const connectionStatus = useConnectionStore((state) => state.status);
  const setConnectionStatus = useConnectionStore((state) => state.setStatus);
  const addConversation = useConversationsStore((state) => state.addConversation);
  const addMessage = useMessagesStore((state) => state.addMessage);

  // Initialize on mount
  useEffect(() => {
    initializeApp();
    setupSyncHandler();

    return () => {
      // Cleanup handlers on unmount
    };
  }, []);

  // Set up handler for synced messages
  const setupSyncHandler = () => {
    wsClient.on('sync-response', (message) => {
      const payload = message.payload as { messages: SyncedMessage[]; isAutoSync?: boolean };
      if (!payload.messages || !identity) return;

      const currentUserKey = bytesToBase64(identity.identityKeyPair.publicKey);

      console.log(`[App] Processing ${payload.messages.length} synced messages`);

      payload.messages.forEach((syncedMsg) => {
        // Determine the other participant
        const otherParty = syncedMsg.senderKey === currentUserKey
          ? syncedMsg.recipientKey
          : syncedMsg.senderKey;

        // Create conversation ID (sorted keys for consistency)
        const conversationId = [currentUserKey, otherParty].sort().join(':');

        // Ensure conversation exists
        const existingConv = useConversationsStore.getState().conversations.get(conversationId);
        if (!existingConv) {
          const newConversation: Conversation = {
            id: conversationId,
            participants: [currentUserKey, otherParty],
            type: 'direct',
            createdAt: syncedMsg.timestamp,
            unreadCount: syncedMsg.senderKey !== currentUserKey ? 1 : 0,
            state: 'active',
            keyExchangeComplete: true,
            lastMessageAt: syncedMsg.timestamp
          };
          addConversation(newConversation);
        }

        // Add message to store
        const msg: Message = {
          id: syncedMsg.id,
          conversationId,
          senderId: syncedMsg.senderKey,
          content: '[Encrypted message - decryption required]', // Will be decrypted by ChatView
          timestamp: syncedMsg.timestamp,
          type: 'text',
          status: syncedMsg.delivered ? 'delivered' : 'sent',
          burnAfterRead: false
        };

        // Check if message already exists to avoid duplicates
        const existingMessages = useMessagesStore.getState().messages.get(conversationId) || [];
        if (!existingMessages.find(m => m.id === syncedMsg.id)) {
          addMessage(conversationId, msg);
        }
      });
    });

    // Also handle real-time incoming messages
    wsClient.on('message', (message) => {
      const payload = message.payload as {
        messageId: string;
        senderKey: string;
        encryptedContent: unknown;
        timestamp: number;
      };

      if (!identity) return;

      const currentUserKey = bytesToBase64(identity.identityKeyPair.publicKey);
      const conversationId = [currentUserKey, payload.senderKey].sort().join(':');

      // Ensure conversation exists
      const existingConv = useConversationsStore.getState().conversations.get(conversationId);
      if (!existingConv) {
        const newConversation: Conversation = {
          id: conversationId,
          participants: [currentUserKey, payload.senderKey],
          type: 'direct',
          createdAt: payload.timestamp,
          unreadCount: 1,
          state: 'active',
          keyExchangeComplete: true,
          lastMessageAt: payload.timestamp
        };
        addConversation(newConversation);
      }

      // Add message
      const msg: Message = {
        id: payload.messageId,
        conversationId,
        senderId: payload.senderKey,
        content: '[Encrypted message]',
        timestamp: payload.timestamp,
        type: 'text',
        status: 'delivered',
        burnAfterRead: false
      };

      addMessage(conversationId, msg);

      // Update last sync timestamp
      localStorage.setItem('phantom_last_sync', Date.now().toString());
    });
  };

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

