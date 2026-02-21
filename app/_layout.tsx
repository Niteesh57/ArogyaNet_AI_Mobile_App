import "../global.css";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../contexts/AuthContext";
import { initDB } from "../lib/db";
import { syncOfflineActions } from "../lib/sync";
import NetInfo from "@react-native-community/netinfo";

const queryClient = new QueryClient();

export default function RootLayout() {
    useEffect(() => {
        initDB();

        // Sync on app start if connected
        syncOfflineActions();

        // Listen for connection changes
        const unsubscribe = NetInfo.addEventListener(state => {
            if (state.isConnected) {
                syncOfflineActions();
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthProvider>
            <QueryClientProvider client={queryClient}>
                <Stack>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
            </QueryClientProvider>
        </AuthProvider>
    );
}
