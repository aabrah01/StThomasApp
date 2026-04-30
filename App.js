import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataReadyProvider } from './src/context/DataReadyContext';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    <SafeAreaProvider>
      <DataReadyProvider>
        <AuthProvider>
          <StatusBar style="auto" />
          <AppNavigator />
        </AuthProvider>
      </DataReadyProvider>
    </SafeAreaProvider>
  );
}
