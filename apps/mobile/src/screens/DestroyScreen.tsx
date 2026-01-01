/**
 * Phantom Messenger - Destroy Screen (Mobile)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { destroyIdentity } from '@phantom/crypto';
import { useIdentityStore, useConversationsStore, useMessagesStore } from '../store';
import { secureStorage } from '../services/secureStorage';
import type { RootStackParamList } from '../types';

type DestroyScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Destroy'>;
};

const CONFIRMATION_TEXT = 'DESTROY';

export function DestroyScreen({ navigation }: DestroyScreenProps) {
  const [confirmText, setConfirmText] = useState('');
  const [destroying, setDestroying] = useState(false);
  const [destroyed, setDestroyed] = useState(false);
  
  const identity = useIdentityStore((state) => state.identity);
  const clearIdentity = useIdentityStore((state) => state.clearIdentity);
  const clearConversations = useConversationsStore((state) => state.clearAll);
  const clearMessages = useMessagesStore((state) => state.clearAll);

  const canDestroy = confirmText === CONFIRMATION_TEXT;

  const handleDestroy = async () => {
    if (!canDestroy || !identity) return;

    setDestroying(true);

    try {
      // Destroy cryptographic material
      destroyIdentity(identity);

      // Clear all stored data
      await secureStorage.clearAll();

      // Clear stores
      clearIdentity();
      clearConversations();
      clearMessages();

      setDestroyed(true);

      // Navigate to setup after delay
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Setup' }],
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to destroy identity:', error);
    } finally {
      setDestroying(false);
    }
  };

  if (destroyed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.destroyedContainer}>
          <Text style={styles.destroyedIcon}>🔥</Text>
          <Text style={styles.destroyedTitle}>Identity Destroyed</Text>
          <Text style={styles.destroyedDescription}>
            All data has been permanently erased.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Destroy Identity</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Warning Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⚠️</Text>
        </View>

        <Text style={styles.title}>This is irreversible</Text>
        <Text style={styles.description}>
          You are about to permanently destroy your identity and all associated data.
          This action cannot be undone.
        </Text>

        {/* What will be destroyed */}
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>The following will be destroyed:</Text>
          <View style={styles.warningList}>
            <Text style={styles.warningItem}>• Your Phantom identity</Text>
            <Text style={styles.warningItem}>• All cryptographic keys</Text>
            <Text style={styles.warningItem}>• All conversations</Text>
            <Text style={styles.warningItem}>• All messages</Text>
            <Text style={styles.warningItem}>• All stored preferences</Text>
          </View>
        </View>

        {/* Confirmation Input */}
        <View style={styles.confirmSection}>
          <Text style={styles.confirmLabel}>
            Type <Text style={styles.confirmCode}>{CONFIRMATION_TEXT}</Text> to confirm
          </Text>
          <TextInput
            style={styles.confirmInput}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={CONFIRMATION_TEXT}
            placeholderTextColor="#444"
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        {/* Destroy Button */}
        <TouchableOpacity
          style={[
            styles.destroyButton,
            !canDestroy && styles.destroyButtonDisabled,
          ]}
          onPress={handleDestroy}
          disabled={!canDestroy || destroying}
        >
          {destroying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.destroyButtonText}>🔥 Destroy Forever</Text>
          )}
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
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
    paddingHorizontal: 16,
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
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#7f1d1d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  warningBox: {
    backgroundColor: '#7f1d1d',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fca5a5',
    marginBottom: 12,
  },
  warningList: {
    gap: 8,
  },
  warningItem: {
    fontSize: 14,
    color: '#fca5a5',
  },
  confirmSection: {
    width: '100%',
    marginBottom: 24,
  },
  confirmLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmCode: {
    color: '#ef4444',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  confirmInput: {
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
  },
  destroyButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  destroyButtonDisabled: {
    backgroundColor: '#333',
  },
  destroyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
  },
  destroyedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  destroyedIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  destroyedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 12,
  },
  destroyedDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
