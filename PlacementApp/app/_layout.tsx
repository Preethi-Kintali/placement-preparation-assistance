import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { COLORS } from '../constants/colors';
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

function RootLayoutNav() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        if (loading) return;
        const inAuthGroup = segments[0] === '(auth)';

        if (!user && !inAuthGroup) {
            router.replace('/(auth)/');
        } else if (user && inAuthGroup) {
            router.replace('/(tabs)/dashboard');
        }
    }, [user, loading, segments]);

    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={COLORS.primary} size="large" />
            </View>
        );
    }

    return (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bg } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="exam" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="study-assistant" />
            <Stack.Screen name="profile-edit" />
        </Stack>
    );
}

// No font loading needed — using SVG icons via react-native-svg
export default function RootLayout() {
    return (
        <AuthProvider>
            <RootLayoutNav />
        </AuthProvider>
    );
}
