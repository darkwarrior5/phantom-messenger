/**
 * Phantom Messenger - Invite Screen (Mobile)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { generateInvitation } from '@phantom/crypto';
import { useIdentityStore } from '../store';
import type { RootStackParamList } from '../types';

type InviteScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Invite'>;
};

export function InviteScreen({ navigation }: InviteScreenProps) {
  const identity = useIdentityStore((state) => state.identity);
  const [invitation, setInvitation] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateInvitation = async () => {
    if (!identity) {
      setError('No identity found');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const result = await generateInvitation(identity);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to generate invitation');
      }

      setInvitation(result.data.invitationCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invitation');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!invitation) return;

    try {
      // Use Share API for copying (works cross-platform)
      await Share.share({ message: invitation });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const handleShare = async () => {
    if (!invitation) return;

    try {
      await Share.share({
        message: `Join me on Phantom Messenger!\n\nInvitation code:\n${invitation}`,
      });
    } catch (err) {
      // User cancelled
    }
  };

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
        <Text style={styles.headerTitle}>Create Invitation</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>✉️</Text>
        </View>

        <Text style={styles.title}>Invite Someone</Text>
        <Text style={styles.description}>
          Generate a secure invitation code to share with someone you want to message.
          Each code can only be used once.
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!invitation ? (
          <TouchableOpacity
            style={[styles.generateButton, generating && styles.buttonDisabled]}
            onPress={handleGenerateInvitation}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.generateButtonText}>Generate Invitation</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.invitationContainer}>
            {/* Security Info */}
            <View style={styles.securityBadge}>
              <Text style={styles.securityIcon}>🔐</Text>
              <Text style={styles.securityText}>End-to-end encrypted</Text>
            </View>

            {/* Invitation Code */}
            <View style={styles.codeContainer}>
              <Text style={styles.codeLabel}>Your Invitation Code</Text>
              <Text style={styles.code} numberOfLines={3} ellipsizeMode="middle">
                {invitation}
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, copied && styles.actionButtonSuccess]}
                onPress={handleCopy}
              >
                <Text style={styles.actionButtonText}>
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleShare}
              >
                <Text style={styles.actionButtonText}>📤 Share</Text>
              </TouchableOpacity>
            </View>

            {/* Warnings */}
            <View style={styles.warningContainer}>
              <Text style={styles.warningTitle}>⚠️ Important</Text>
              <Text style={styles.warningText}>
                • This invitation expires in 24 hours{'\n'}
                • Can only be used once{'\n'}
                • Share only with trusted contacts{'\n'}
                • Delete after sharing
              </Text>
            </View>

            {/* Generate New */}
            <TouchableOpacity
              style={styles.newButton}
              onPress={() => setInvitation(null)}
            >
              <Text style={styles.newButtonText}>Generate New Code</Text>
            </TouchableOpacity>
          </View>
        )}
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
    color: '#fff',
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
    backgroundColor: '#7c3aed20',
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
    color: '#fff',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  errorContainer: {
    backgroundColor: '#7f1d1d',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
  },
  generateButton: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  invitationContainer: {
    width: '100%',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#052e16',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 24,
  },
  securityIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#22c55e',
  },
  codeContainer: {
    backgroundColor: '#1a1a24',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  code: {
    fontSize: 12,
    color: '#a855f7',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1a24',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonSuccess: {
    backgroundColor: '#052e16',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  warningContainer: {
    backgroundColor: '#422006',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fbbf24',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#fcd34d',
    lineHeight: 20,
  },
  newButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  newButtonText: {
    fontSize: 14,
    color: '#a855f7',
  },
});
