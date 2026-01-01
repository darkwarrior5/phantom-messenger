/**
 * Phantom Messenger - Mobile Zustand Store
 */

import { create } from 'zustand';
import type { DisposableIdentity } from '@phantom/crypto';
import type { Conversation, Message, UserPreferences } from '@phantom/shared';

// Identity Store
interface IdentityState {
  identity: DisposableIdentity | null;
  isLoading: boolean;
  setIdentity: (identity: DisposableIdentity | null) => void;
  setLoading: (loading: boolean) => void;
  clearIdentity: () => void;
}

export const useIdentityStore = create<IdentityState>((set) => ({
  identity: null,
  isLoading: true,
  setIdentity: (identity) => set({ identity }),
  setLoading: (isLoading) => set({ isLoading }),
  clearIdentity: () => set({ identity: null }),
}));

// Connection Store
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'error';

interface ConnectionState {
  status: ConnectionStatus;
  error: string | null;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  error: null,
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
}));

// Conversations Store
interface ConversationsState {
  conversations: Map<string, Conversation>;
  activeConversationId: string | null;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  clear: () => void;
  clearAll: () => void;
}

export const useConversationsStore = create<ConversationsState>((set) => ({
  conversations: new Map(),
  activeConversationId: null,
  addConversation: (conversation) =>
    set((state) => ({
      conversations: new Map(state.conversations).set(conversation.id, conversation),
    })),
  updateConversation: (id, updates) =>
    set((state) => {
      const conversations = new Map(state.conversations);
      const existing = conversations.get(id);
      if (existing) {
        conversations.set(id, { ...existing, ...updates });
      }
      return { conversations };
    }),
  removeConversation: (id) =>
    set((state) => {
      const conversations = new Map(state.conversations);
      conversations.delete(id);
      return { conversations };
    }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  clear: () => set({ conversations: new Map(), activeConversationId: null }),
  clearAll: () => set({ conversations: new Map(), activeConversationId: null }),
}));

// Messages Store
interface MessagesState {
  messages: Map<string, Message[]>;
  addMessage: (conversationId: string, message: Message) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  clear: () => void;
  clearAll: () => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  messages: new Map(),
  addMessage: (conversationId, message) =>
    set((state) => {
      const messages = new Map(state.messages);
      const existing = messages.get(conversationId) ?? [];
      messages.set(conversationId, [...existing, message]);
      return { messages };
    }),
  setMessages: (conversationId, newMessages) =>
    set((state) => ({
      messages: new Map(state.messages).set(conversationId, newMessages),
    })),
  deleteMessage: (conversationId, messageId) =>
    set((state) => {
      const messages = new Map(state.messages);
      const existing = messages.get(conversationId) ?? [];
      messages.set(conversationId, existing.filter((m) => m.id !== messageId));
      return { messages };
    }),
  clear: () => set({ messages: new Map() }),
  clearAll: () => set({ messages: new Map() }),
}));

// Preferences Store
interface PreferencesState {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
}

const defaultPreferences: UserPreferences = {
  autoDeleteMessages: true,
  autoDeleteTimeout: 86400, // 24 hours in seconds
  showReadReceipts: false,
  showTypingIndicator: false,
  enableNotifications: false,
  theme: 'dark',
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  preferences: defaultPreferences,
  updatePreferences: (updates) =>
    set((state) => ({
      preferences: { ...state.preferences, ...updates },
    })),
}));
