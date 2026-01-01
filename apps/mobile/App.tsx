/**
 * Phantom Messenger - Mobile App Entry Point
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { 
  SetupScreen, 
  ChatScreen, 
  ConversationScreen, 
  InviteScreen, 
  SettingsScreen, 
  DestroyScreen 
} from './src/screens';
import { useIdentityStore } from './src/store';
import { secureStorage } from './src/services/secureStorage';
import type { RootStackParamList } from './src/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function App(): React.JSX.Element {
  const setIdentity = useIdentityStore((state) => state.setIdentity);
  const setLoading = useIdentityStore((state) => state.setLoading);
  const identity = useIdentityStore((state) => state.identity);
  const isLoading = useIdentityStore((state) => state.isLoading);

  useEffect(() => {
    loadIdentity();
  }, []);

  const loadIdentity = async () => {
    try {
      const storedIdentity = await secureStorage.loadIdentity();
      if (storedIdentity) {
        setIdentity(storedIdentity);
      }
    } catch (error) {
      console.error('Failed to load identity:', error);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: '#9333ea',
            background: '#0a0a0f',
            card: '#1a1a24',
            text: '#ffffff',
            border: '#333',
            notification: '#9333ea',
          },
        }}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
          initialRouteName={identity ? 'Chat' : 'Setup'}
        >
          <Stack.Screen name="Setup" component={SetupScreen} />
          <Stack.Screen name="Chat" component={ChatScreen} />
          <Stack.Screen name="Conversation" component={ConversationScreen} />
          <Stack.Screen name="Invite" component={InviteScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Destroy" component={DestroyScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
