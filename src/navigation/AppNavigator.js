import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';

import LoginScreen from '../screens/auth/LoginScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import DirectoryListScreen from '../screens/directory/DirectoryListScreen';
import FamilyDetailScreen from '../screens/directory/FamilyDetailScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import EventDetailScreen from '../screens/calendar/EventDetailScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

import theme from '../styles/theme';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = ({ name, focused }) => (
  <Ionicons
    name={focused ? name : `${name}-outline`}
    size={24}
    color={focused ? theme.colors.primary : theme.colors.textLight}
  />
);

const HEADER_STYLE = {
  backgroundColor: theme.colors.primary,
  shadowColor: 'transparent',
  elevation: 0,
};

const HEADER_TITLE_STYLE = {
  fontWeight: '700',
  fontSize: theme.fonts.sizes.lg,
};

// All three tabs share this Tab Navigator — no nested stacks, so headers are identical
const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textLight,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingBottom: 24,
          paddingTop: 8,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        headerStyle: HEADER_STYLE,
        headerTintColor: '#FFFFFF',
        headerTitleStyle: HEADER_TITLE_STYLE,
      }}
    >
      <Tab.Screen
        name="Directory"
        component={DirectoryListScreen}
        options={{
          title: 'Church Directory',
          tabBarLabel: 'Directory',
          tabBarIcon: ({ focused }) => <TabIcon name="people" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          title: 'Church Events',
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
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: theme.colors.background } }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="FamilyDetail" component={FamilyDetailScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
    </Stack.Navigator>
  );
};

const AuthStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default AppNavigator;
