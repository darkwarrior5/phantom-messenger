/**
 * Phantom Messenger - Zustand Store
 * 
 * Client-side state management with secure storage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  User, 
  Message, 
  Conversation, 
  Invitation,
  SecurityStatus,
  UserPreferences,
  DEFAULT_USER_PREFERENCES
} from '@phantom/shared';
import type { DisposableIdentity, SessionKeys } from '@phantom/crypto';

// ============ Identity Store ============

interface IdentityState {
  identity: DisposableIdentity | null;
  isInitialized: boolean;
  setIdentity: (identity: DisposableIdentity) => void;
  clearIdentity: () => void;
}

export const useIdentityStore = create<IdentityState>()((set) => ({
  identity: null,
  isInitialized: false,
  setIdentity: (identity) => set({ identity, isInitialized: true }),
  clearIdentity: () => set({ identity: null, isInitialized: false }),
}));

// ============ Connection Store ============

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated';

interface ConnectionState {
  status: ConnectionStatus;
  socket: WebSocket | null;
  setStatus: (status: ConnectionStatus) => void;
  setSocket: (socket: WebSocket | null) => void;
}

export const useConnectionStore = create<ConnectionState>()((set) => ({
  status: 'disconnected',
  socket: null,
  setStatus: (status) => set({ status }),
  setSocket: (socket) => set({ socket }),
}));

// ============ Conversations Store ============

interface ConversationsState {
  conversations: Map<string, Conversation>;
  activeConversationId: string | null;
  sessionKeys: Map<string, SessionKeys>;
  
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setSessionKeys: (conversationId: string, keys: SessionKeys) => void;
  clearAll: () => void;
  clear: () => void; // alias
}

export const useConversationsStore = create<ConversationsState>()((set) => ({
  conversations: new Map(),
  activeConversationId: null,
  sessionKeys: new Map(),
  
  addConversation: (conversation) => 
    set((state) => {
      const newConversations = new Map(state.conversations);
      newConversations.set(conversation.id, conversation);
      return { conversations: newConversations };
    }),
  
  updateConversation: (id, updates) =>
    set((state) => {
      const conversation = state.conversations.get(id);
      if (!conversation) return state;
      
      const newConversations = new Map(state.conversations);
      newConversations.set(id, { ...conversation, ...updates });
      return { conversations: newConversations };
    }),
  
  removeConversation: (id) =>
    set((state) => {
      const newConversations = new Map(state.conversations);
      newConversations.delete(id);
      const newSessionKeys = new Map(state.sessionKeys);
      newSessionKeys.delete(id);
      return { 
        conversations: newConversations,
        sessionKeys: newSessionKeys,
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId
      };
    }),
  
  setActiveConversation: (id) => set({ activeConversationId: id }),
  
  setSessionKeys: (conversationId, keys) =>
    set((state) => {
      const newSessionKeys = new Map(state.sessionKeys);
      newSessionKeys.set(conversationId, keys);
      return { sessionKeys: newSessionKeys };
    }),
  
  clearAll: () => set({ 
    conversations: new Map(), 
    activeConversationId: null,
    sessionKeys: new Map()
  }),
  
  clear: () => set({ 
    conversations: new Map(), 
    activeConversationId: null,
    sessionKeys: new Map()
  }),
}));

// ============ Messages Store ============

interface MessagesState {
  messages: Map<string, Message[]>; // conversationId -> messages
  pendingMessages: Map<string, Message[]>;
  
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  burnMessage: (conversationId: string, messageId: string) => void;
  clearConversationMessages: (conversationId: string) => void;
  clearAll: () => void;
  clear: () => void; // alias
}

export const useMessagesStore = create<MessagesState>()((set) => ({
  messages: new Map(),
  pendingMessages: new Map(),
  
  addMessage: (conversationId, message) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const conversationMessages = newMessages.get(conversationId) ?? [];
      newMessages.set(conversationId, [...conversationMessages, message]);
      return { messages: newMessages };
    }),
  
  updateMessage: (conversationId, messageId, updates) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const conversationMessages = newMessages.get(conversationId);
      if (!conversationMessages) return state;
      
      const updatedMessages = conversationMessages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      );
      newMessages.set(conversationId, updatedMessages);
      return { messages: newMessages };
    }),
  
  deleteMessage: (conversationId, messageId) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const conversationMessages = newMessages.get(conversationId);
      if (!conversationMessages) return state;
      
      newMessages.set(conversationId, conversationMessages.filter(msg => msg.id !== messageId));
      return { messages: newMessages };
    }),
  
  burnMessage: (conversationId, messageId) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const conversationMessages = newMessages.get(conversationId);
      if (!conversationMessages) return state;
      
      const updatedMessages = conversationMessages.map(msg =>
        msg.id === messageId ? { ...msg, status: 'burned' as const, content: '[Message burned]' } : msg
      );
      newMessages.set(conversationId, updatedMessages);
      return { messages: newMessages };
    }),
  
  clearConversationMessages: (conversationId) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.delete(conversationId);
      return { messages: newMessages };
    }),
  
  clearAll: () => set({ messages: new Map(), pendingMessages: new Map() }),
  
  clear: () => set({ messages: new Map(), pendingMessages: new Map() }),
}));

// ============ UI Store ============

type View = 'setup' | 'chat' | 'invite' | 'settings' | 'destroy';

interface UIState {
  currentView: View;
  showSecurityInfo: boolean;
  isLoading: boolean;
  error: string | null;
  
  setView: (view: View) => void;
  setShowSecurityInfo: (show: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  currentView: 'setup',
  showSecurityInfo: false,
  isLoading: false,
  error: null,
  
  setView: (view) => set({ currentView: view }),
  setShowSecurityInfo: (show) => set({ showSecurityInfo: show }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));

// ============ Preferences Store (Persisted) ============

interface PreferencesState {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetPreferences: () => void;
}

const defaultPreferences: UserPreferences = {
  autoDeleteMessages: false,
  autoDeleteTimeout: 30,
  showReadReceipts: false,
  showTypingIndicator: false,
  enableNotifications: true,
  theme: 'dark'
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      preferences: defaultPreferences,
      updatePreferences: (updates) =>
        set((state) => ({
          preferences: { ...state.preferences, ...updates }
        })),
      resetPreferences: () => set({ preferences: defaultPreferences }),
    }),
    {
      name: 'phantom-preferences',
    }
  )
);
