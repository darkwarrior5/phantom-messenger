/**
 * Phantom Messenger - Conversation Screen (Mobile)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { useMessagesStore, useConversationsStore, useIdentityStore } from '../store';
import type { RootStackParamList } from '../types';
import type { Message } from '@phantom/shared';

type ConversationScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Conversation'>;
  route: RouteProp<RootStackParamList, 'Conversation'>;
};

export function ConversationScreen({ navigation, route }: ConversationScreenProps) {
  const { conversationId } = route.params;
  const [messageText, setMessageText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  
  const identity = useIdentityStore((state) => state.identity);
  const conversation = useConversationsStore((state) => 
    state.conversations.get(conversationId)
  );
  const messages = useMessagesStore((state) => 
    state.messages.get(conversationId) ?? []
  );
  const addMessage = useMessagesStore((state) => state.addMessage);

  const currentUserId = identity?.id 
    ? new TextDecoder().decode(identity.id)
    : '';

  const participantName = conversation?.participants[0]?.slice(0, 8) + '...' || 'Unknown';

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages.length]);

  const handleSend = () => {
    if (!messageText.trim() || !identity) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      conversationId,
      senderId: currentUserId,
      content: messageText.trim(),
      timestamp: Date.now(),
      type: 'text',
      status: 'sent',
      burnAfterRead: false,
    };

    addMessage(conversationId, newMessage);
    setMessageText('');

    // TODO: Actually send via WebSocket
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === currentUserId;
    
    return (
      <View style={[styles.messageContainer, isOwn && styles.messageContainerOwn]}>
        <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          <Text style={styles.encryptedIcon}>🔒</Text>
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {item.content}
          </Text>
          <Text style={styles.messageTime}>
            {new Date(item.timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text>👤</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{participantName}</Text>
            <View style={styles.encryptedBadge}>
              <Text style={styles.encryptedBadgeIcon}>🔐</Text>
              <Text style={styles.encryptedBadgeText}>End-to-end encrypted</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuButtonText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        inverted={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Start the conversation</Text>
            <Text style={styles.emptyDescription}>
              Messages are end-to-end encrypted
            </Text>
          </View>
        }
      />

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#666"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={2000}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!messageText.trim()}
          >
            <Text style={styles.sendButtonText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a24',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#a855f7',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a24',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  encryptedBadgeIcon: {
    fontSize: 10,
    marginRight: 4,
  },
  encryptedBadgeText: {
    fontSize: 11,
    color: '#22c55e',
  },
  menuButton: {
    padding: 8,
  },
  menuButtonText: {
    fontSize: 20,
    color: '#666',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#444',
  },
  messageContainer: {
    marginVertical: 4,
    alignItems: 'flex-start',
  },
  messageContainerOwn: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  ownBubble: {
    backgroundColor: '#7c3aed',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#1a1a24',
    borderBottomLeftRadius: 4,
  },
  encryptedIcon: {
    fontSize: 10,
    position: 'absolute',
    top: 4,
    right: 8,
    opacity: 0.6,
  },
  messageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a24',
    backgroundColor: '#0a0a0f',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#1a1a24',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  input: {
    fontSize: 15,
    color: '#fff',
    minHeight: 24,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#333',
  },
  sendButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
  },
});
