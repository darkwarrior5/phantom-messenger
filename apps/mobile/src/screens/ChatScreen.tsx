/**
 * Phantom Messenger - Chat Screen (Mobile)
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useConversationsStore, useIdentityStore } from '../store';
import type { RootStackParamList } from '../types';
import type { Conversation } from '@phantom/shared';

type ChatScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Chat'>;
};

export function ChatScreen({ navigation }: ChatScreenProps) {
  const identity = useIdentityStore((state) => state.identity);
  const conversations = useConversationsStore((state) => state.conversations);

  const conversationsList = Array.from(conversations.values());
  const displayId = identity?.id 
    ? new TextDecoder().decode(identity.id).slice(0, 12) + '...'
    : 'Unknown';

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => navigation.navigate('Conversation', { conversationId: item.id })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>👤</Text>
      </View>
      <View style={styles.conversationInfo}>
        <Text style={styles.conversationName}>
          {item.participants[0]?.slice(0, 8)}...
        </Text>
        <View style={styles.conversationMeta}>
          <View style={styles.encryptedBadge}>
            <Text style={styles.encryptedBadgeText}>🔒</Text>
          </View>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>🔐 Phantom</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Invite')}
          >
            <Text style={styles.headerButtonText}>➕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.headerButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Identity Info */}
      <View style={styles.identityBar}>
        <View style={styles.identityAvatar}>
          <Text>👤</Text>
        </View>
        <View style={styles.identityInfo}>
          <Text style={styles.identityId}>{displayId}</Text>
          <View style={styles.statusIndicator}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Connected</Text>
          </View>
        </View>
      </View>

      {/* Conversations List */}
      {conversationsList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyDescription}>
            Create an invitation to start a secure conversation
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Invite')}
          >
            <Text style={styles.primaryButtonText}>Create Invitation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversationsList}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a24',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 18,
  },
  identityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#1a1a24',
    borderRadius: 12,
  },
  identityAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  identityInfo: {
    flex: 1,
  },
  identityId: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 13,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  statusText: {
    color: '#888',
    fontSize: 11,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2a2a3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  conversationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  encryptedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  encryptedBadgeText: {
    fontSize: 10,
  },
  unreadBadge: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#888',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  emptyDescription: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#9333ea',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
