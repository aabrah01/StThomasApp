import 'react-native-gesture-handler';
import React from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataReadyProvider } from './src/context/DataReadyContext';
import { AuthProvider } from './src/context/AuthContext';
import { EventsProvider } from './src/context/EventsContext';
import AppNavigator from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    // Required for the stack's swipe-back gesture, particularly on Android
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DataReadyProvider>
          <AuthProvider>
            <EventsProvider>
              <AppNavigator />
            </EventsProvider>
          </AuthProvider>
        </DataReadyProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
