/**
 * Phantom Messenger - Settings Screen (Mobile)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIdentityStore } from '../store';
import { secureStorage } from '../services/secureStorage';
import type { RootStackParamList } from '../types';

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Settings'>;
};

export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const identity = useIdentityStore((state) => state.identity);
  const [autoDeleteMessages, setAutoDeleteMessages] = useState(true);
  const [autoDeleteTimeout, setAutoDeleteTimeout] = useState(24);
  const [showReadReceipts, setShowReadReceipts] = useState(false);
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);

  const displayId = identity?.id 
    ? new TextDecoder().decode(identity.id).slice(0, 16) + '...'
    : 'Unknown';

  const handleDestroyIdentity = () => {
    Alert.alert(
      'Destroy Identity',
      'This will permanently destroy your identity and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Destroy',
          style: 'destructive',
          onPress: () => navigation.navigate('Destroy'),
        },
      ]
    );
  };

  const timeoutOptions = [
    { label: '1 hour', value: 1 },
    { label: '6 hours', value: 6 },
    { label: '24 hours', value: 24 },
    { label: '7 days', value: 168 },
  ];

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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Identity Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IDENTITY</Text>
          <View style={styles.identityCard}>
            <View style={styles.identityAvatar}>
              <Text style={styles.avatarText}>👤</Text>
            </View>
            <View style={styles.identityInfo}>
              <Text style={styles.identityLabel}>Your Phantom ID</Text>
              <Text style={styles.identityId}>{displayId}</Text>
            </View>
          </View>
        </View>

        {/* Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIVACY</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto-delete Messages</Text>
              <Text style={styles.settingDescription}>
                Automatically delete messages after a period
              </Text>
            </View>
            <Switch
              value={autoDeleteMessages}
              onValueChange={setAutoDeleteMessages}
              trackColor={{ false: '#333', true: '#7c3aed' }}
              thumbColor={autoDeleteMessages ? '#a855f7' : '#666'}
            />
          </View>

          {autoDeleteMessages && (
            <View style={styles.timeoutSelector}>
              {timeoutOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.timeoutOption,
                    autoDeleteTimeout === option.value && styles.timeoutOptionActive,
                  ]}
                  onPress={() => setAutoDeleteTimeout(option.value)}
                >
                  <Text
                    style={[
                      styles.timeoutOptionText,
                      autoDeleteTimeout === option.value && styles.timeoutOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Read Receipts</Text>
              <Text style={styles.settingDescription}>
                Let others see when you've read their messages
              </Text>
            </View>
            <Switch
              value={showReadReceipts}
              onValueChange={setShowReadReceipts}
              trackColor={{ false: '#333', true: '#7c3aed' }}
              thumbColor={showReadReceipts ? '#a855f7' : '#666'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Typing Indicator</Text>
              <Text style={styles.settingDescription}>
                Show when you're typing a message
              </Text>
            </View>
            <Switch
              value={showTypingIndicator}
              onValueChange={setShowTypingIndicator}
              trackColor={{ false: '#333', true: '#7c3aed' }}
              thumbColor={showTypingIndicator ? '#a855f7' : '#666'}
            />
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SECURITY</Text>
          
          <View style={styles.securityInfo}>
            <View style={styles.securityItem}>
              <Text style={styles.securityIcon}>🔐</Text>
              <Text style={styles.securityText}>End-to-end encrypted</Text>
            </View>
            <View style={styles.securityItem}>
              <Text style={styles.securityIcon}>🔄</Text>
              <Text style={styles.securityText}>Perfect Forward Secrecy</Text>
            </View>
            <View style={styles.securityItem}>
              <Text style={styles.securityIcon}>💾</Text>
              <Text style={styles.securityText}>Zero server storage</Text>
            </View>
            <View style={styles.securityItem}>
              <Text style={styles.securityIcon}>👤</Text>
              <Text style={styles.securityText}>Disposable identity</Text>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>DANGER ZONE</Text>
          
          <TouchableOpacity
            style={styles.destroyButton}
            onPress={handleDestroyIdentity}
          >
            <Text style={styles.destroyButtonText}>🔥 Destroy Identity</Text>
          </TouchableOpacity>
          
          <Text style={styles.destroyWarning}>
            This will permanently delete your identity and all conversations.
            This action cannot be undone.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Phantom Messenger v1.0.0</Text>
          <Text style={styles.footerSubtext}>Security-first messaging</Text>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a24',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    letterSpacing: 1,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    padding: 16,
    borderRadius: 12,
  },
  identityAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
  },
  identityInfo: {
    flex: 1,
  },
  identityLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  identityId: {
    fontSize: 14,
    color: '#fff',
    fontFamily: 'monospace',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a24',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
  },
  timeoutSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 12,
  },
  timeoutOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a24',
  },
  timeoutOptionActive: {
    backgroundColor: '#7c3aed',
  },
  timeoutOptionText: {
    fontSize: 14,
    color: '#666',
  },
  timeoutOptionTextActive: {
    color: '#fff',
  },
  securityInfo: {
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    padding: 16,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  securityIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  securityText: {
    fontSize: 14,
    color: '#22c55e',
  },
  dangerTitle: {
    color: '#ef4444',
  },
  destroyButton: {
    backgroundColor: '#7f1d1d',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  destroyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fca5a5',
  },
  destroyWarning: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
  },
  footer: {
    padding: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#444',
    marginTop: 4,
  },
});
