import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { useAppTheme } from '@/theme';
import { TopBar } from '@/components/navigation/top-bar';
import {
  FloatingSearchModal,
  SearchModalProvider,
} from '@/components/navigation/floating-search-modal';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors } = useAppTheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={DarkTheme}>
        <StatusBar style="light" />
        <SearchModalProvider>
          <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Global Persistent Top Bar */}
            <TopBar />

            {/* Application Stack Navigation */}
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: colors.background,
                },
              }}
            >
              <Stack.Screen
                name="index"
                options={{
                  title: 'FTC Pulse • Team Lookup',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="teams/[teamNumber]/index"
                options={{
                  title: 'BrickBot #15996',
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="teams/[teamNumber]/events/[eventCode]"
                options={{
                  title: 'Tournament Telemetry',
                  headerShown: false,
                }}
              />
            </Stack>

            {/* Root-Mounted Floating Blurred Search Modal */}
            <FloatingSearchModal />
          </View>
        </SearchModalProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});
