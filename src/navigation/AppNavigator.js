import React, { useEffect } from 'react';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

import LoginScreen from '../screens/auth/LoginScreen';
import PinVerifyScreen from '../screens/auth/PinVerifyScreen';
import DirectoryListScreen from '../screens/directory/DirectoryListScreen';
import FamilyDetailScreen from '../screens/directory/FamilyDetailScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import EventDetailScreen from '../screens/calendar/EventDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ name, focused }) => {
  const theme = useTheme();
  return (
    <Ionicons
      name={focused ? name : `${name}-outline`}
      size={24}
      color={focused ? theme.colors.accent : theme.colors.textLight}
    />
  );
};

// All three tabs share this Tab Navigator — no nested stacks, so headers are identical
const MainTabs = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56 + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        lazy: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textLight,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingBottom: insets.bottom || 8,
          paddingTop: 8,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: theme.fonts.sizes.lg,
        },
        headerTitleAlign: 'center',
        headerRight: () => (
          <Image
            source={require('../../assets/icon_transparent.png')}
            style={{ width: 40, height: 40, marginRight: 12, transform: [{ translateY: -10 }] }}
            resizeMode="contain"
          />
        ),
      }}
    >
      <Tab.Screen
        name="Directory"
        component={DirectoryListScreen}
        options={{
          title: 'Parish Directory',
          tabBarLabel: 'Directory',
          tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          title: 'Parish Events',
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="person" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
};

// Root stack wraps the tabs so FamilyDetail can slide in over them without
// any nested navigator affecting the tab header heights
const AppStack = () => {
  const theme = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="FamilyDetail" component={FamilyDetailScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
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

  useEffect(() => {
    // For the unauthenticated path (login screen) dismiss the splash immediately.
    // For authenticated users, DataReadyContext dismisses it once all 3 screens have data.
    if (!loading && !user) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loading, user]);

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer
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
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;
