/**
 * Phantom Messenger - Setup Screen (Mobile)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { generateDisposableIdentity } from '@phantom/crypto';
import { useIdentityStore } from '../store';
import { secureStorage } from '../services/secureStorage';
import type { RootStackParamList } from '../types';

type SetupScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Setup'>;
};

export function SetupScreen({ navigation }: SetupScreenProps) {
  const [step, setStep] = useState<'welcome' | 'create' | 'join'>('welcome');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setIdentity = useIdentityStore((state) => state.setIdentity);

  const handleCreateIdentity = async () => {
    setLoading(true);
    setError(null);

    try {
      const identity = generateDisposableIdentity();
      await secureStorage.saveIdentity(identity);
      setIdentity(identity);
      navigation.replace('Chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create identity');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWithInvite = async () => {
    if (!inviteCode.trim()) {
      setError('Please enter an invitation code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const identity = generateDisposableIdentity();
      await secureStorage.saveIdentity(identity);
      setIdentity(identity);
      // TODO: Process invitation code
      navigation.replace('Chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {step === 'welcome' && (
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>🔐</Text>
              </View>
              <Text style={styles.title}>Phantom Messenger</Text>
              <Text style={styles.subtitle}>
                Secure. Private. Ephemeral.
              </Text>
              <Text style={styles.description}>
                End-to-end encrypted messaging with disposable identities
                and zero server-side storage.
              </Text>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => setStep('create')}
                >
                  <Text style={styles.primaryButtonText}>Create New Identity</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => setStep('join')}
                >
                  <Text style={styles.secondaryButtonText}>Join with Invitation</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'create' && (
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>🛡️</Text>
              </View>
              <Text style={styles.title}>Create Identity</Text>
              <Text style={styles.description}>
                Generate a secure, disposable identity. Your keys are stored
                only on this device and protected by biometric authentication.
              </Text>

              <View style={styles.securityBadges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>🔒 AES-256 Encryption</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>🔑 Perfect Forward Secrecy</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>👤 Disposable Identity</Text>
                </View>
              </View>

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.disabledButton]}
                  onPress={handleCreateIdentity}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Generate Identity</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => setStep('welcome')}
                >
                  <Text style={styles.linkButtonText}>← Go Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'join' && (
            <View style={styles.content}>
              <View style={styles.iconContainer}>
                <Text style={styles.iconText}>📨</Text>
              </View>
              <Text style={styles.title}>Join with Invitation</Text>
              <Text style={styles.description}>
                Enter the invitation code shared with you to establish
                a secure connection.
              </Text>

              <TextInput
                style={styles.input}
                value={inviteCode}
                onChangeText={setInviteCode}
                placeholder="Paste invitation code"
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.disabledButton]}
                  onPress={handleJoinWithInvite}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Join</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.linkButton}
                  onPress={() => setStep('welcome')}
                >
                  <Text style={styles.linkButtonText}>← Go Back</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(147, 51, 234, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9333ea',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  securityBadges: {
    marginBottom: 24,
    gap: 8,
  },
  badge: {
    backgroundColor: 'rgba(147, 51, 234, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(147, 51, 234, 0.3)',
  },
  badgeText: {
    color: '#a855f7',
    fontSize: 13,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#9333ea',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#888',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.6,
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a24',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
  },
});
