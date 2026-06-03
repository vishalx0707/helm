import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from './src/theme';
import { RelayProvider, useRelay } from './src/lib/connection';
import { loadPairing } from './src/lib/storage';

import LoginScreen from './src/screens/LoginScreen';
import ScanScreen from './src/screens/ScanScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import TaskScreen from './src/screens/TaskScreen';

/**
 * HELM Mobile root. Wraps the app in the relay connection provider, then boots:
 * if a pairing is already stored (expo-secure-store), we point the live
 * connection at it and start on the dashboard; otherwise we start at Login.
 * The whole app is the phone-side of Project -> Agent -> Task -> Progress ->
 * Result; the laptop does all the real work.
 */

const Stack = createNativeStackNavigator();

// Dark navigation theme so there's never a white flash between screens.
const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.inkHi,
    border: colors.hairline,
    primary: colors.fill,
  },
};

function Root() {
  const { conn } = useRelay();
  const [booting, setBooting] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const pairing = await loadPairing();
      if (mounted && pairing) {
        conn.configure(pairing);
        conn.start();
        setInitialRoute('Dashboard');
      }
      if (mounted) setBooting(false);
    })();
    return () => {
      mounted = false;
    };
  }, [conn]);

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.inkHi} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Scan" component={ScanScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Task" component={TaskScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RelayProvider>
        <Root />
      </RelayProvider>
    </SafeAreaProvider>
  );
}
