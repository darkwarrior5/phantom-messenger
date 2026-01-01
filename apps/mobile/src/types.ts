/**
 * Phantom Messenger - Mobile App Types
 */

export type RootStackParamList = {
  Setup: undefined;
  Chat: undefined;
  Conversation: { conversationId: string };
  Invite: undefined;
  Settings: undefined;
  Destroy: undefined;
};

export interface SecureStorageKeys {
  IDENTITY: 'phantom_identity';
  PREFERENCES: 'phantom_preferences';
  SESSION: 'phantom_session';
}
