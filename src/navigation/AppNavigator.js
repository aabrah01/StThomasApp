import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import BottomBar from '../components/common/BottomBar';

import LoginScreen from '../screens/auth/LoginScreen';
import PinVerifyScreen from '../screens/auth/PinVerifyScreen';
import HomeScreen from '../screens/home/HomeScreen';
import GivingScreen from '../screens/giving/GivingScreen';
import DirectoryListScreen from '../screens/directory/DirectoryListScreen';
import FamilyDetailScreen from '../screens/directory/FamilyDetailScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import EventDetailScreen from '../screens/calendar/EventDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import SignupsScreen from '../screens/signups/SignupsScreen';
import MediaScreen from '../screens/media/MediaScreen';
import ContactScreen from '../screens/contact/ContactScreen';
import DocumentsScreen from '../screens/documents/DocumentsScreen';
import DocumentViewerScreen from '../screens/documents/DocumentViewerScreen';

const Stack = createStackNavigator();

// Every screen lives in one stack, so they all get the same interactive
// swipe-back. The bottom bar is a plain component rendered alongside the
// navigator rather than a tab navigator — a tab has nothing beneath it to pop to.
const AppStack = () => {
  const theme = useTheme();
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {/* Hub */}
      <Stack.Screen name="Home" component={HomeScreen} options={{ gestureEnabled: false }} />

      {/* Menu destinations */}
      <Stack.Screen name="Directory" component={DirectoryListScreen} />
      <Stack.Screen name="Events" component={CalendarScreen} />
      <Stack.Screen name="Giving" component={GivingScreen} />
      <Stack.Screen name="Signups" component={SignupsScreen} />
      <Stack.Screen name="Media" component={MediaScreen} />
      <Stack.Screen name="Contact" component={ContactScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />

      {/* Drill-downs */}
      <Stack.Screen name="FamilyDetail" component={FamilyDetailScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="DocumentViewer" component={DocumentViewerScreen} />
    </Stack.Navigator>
  );
};

const AuthStack = () => {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="PinVerify" component={PinVerifyScreen} />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { user, loading } = useAuth();
  const theme = useTheme();
  const navigationRef = useNavigationContainerRef();
  const [routeName, setRouteName] = useState('Home');

  const trackRoute = useCallback(() => {
    setRouteName(navigationRef.getCurrentRoute()?.name ?? 'Home');
  }, [navigationRef]);

  useEffect(() => {
    // For the unauthenticated path (login screen) dismiss the splash immediately.
    // For authenticated users, DataReadyContext dismisses it once Home has data.
    if (!loading && !user) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading, user]);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={trackRoute}
      onStateChange={trackRoute}
      theme={{
        dark: theme.dark,
        colors: {
          primary: theme.colors.accent,
          background: theme.colors.background,
          card: theme.colors.surface,
          text: theme.colors.text,
          border: theme.colors.border,
          notification: theme.colors.error,
        },
      }}
    >
      {/* Signed in, every screen has a burgundy header — light icons. The auth
          screens sit on cream, where light icons would be invisible. */}
      <StatusBar style={user ? 'light' : 'auto'} />
      <View style={styles.shell}>
        <View style={styles.content}>
          {user ? <AppStack /> : <AuthStack />}
        </View>
        {user && (
          <BottomBar
            current={routeName}
            // navigate (not push) returns to an existing screen instead of
            // stacking duplicates, so the history stays shallow
            onSelect={(name) => navigationRef.navigate(name)}
          />
        )}
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default AppNavigator;
