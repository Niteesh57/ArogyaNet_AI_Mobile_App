import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi, usersApi } from "../lib/api";

interface User {
    id: string;
    email: string;
    full_name?: string;
    role: string;
    phone_number?: string;
    image?: string;
    hospital_id?: string;
    lang?: string;
}

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAdmin: boolean;
    login: (email: string, password: string) => Promise<void>;
    googleLogin: (token: string) => Promise<void>;
    logout: () => Promise<void>;
    updateProfile: (data: Partial<User>) => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    isAdmin: false,
    login: async () => { },
    googleLogin: async () => { },
    logout: async () => { },
    updateProfile: async () => { },
    refreshUser: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isAdmin = user?.role === "super_admin" || user?.role === "hospital_admin";

    // Fetch current user from API
    const fetchUser = useCallback(async () => {
        try {
            const token = await AsyncStorage.getItem("lh_token");
            if (!token) {
                setUser(null);
                return;
            }
            const res = await authApi.me();
            setUser(res.data);
        } catch (err) {
            console.error("Failed to fetch user:", err);
            setUser(null);
            await AsyncStorage.removeItem("lh_token");
        }
    }, []);

    useEffect(() => {
        fetchUser().finally(() => setIsLoading(false));
    }, [fetchUser]);

    const login = async (email: string, password: string) => {
        const res = await authApi.login(email, password);
        const token = res.data.access_token;
        await AsyncStorage.setItem("lh_token", token);
        await fetchUser();
    };

    const googleLogin = async (token: string) => {
        const res = await authApi.googleLogin(token);
        const jwtToken = res.data.access_token;
        await AsyncStorage.setItem("lh_token", jwtToken);
        await fetchUser();
    };

    const logout = async () => {
        await AsyncStorage.removeItem("lh_token");
        setUser(null);
    };

    const updateProfile = async (data: Partial<User>) => {
        try {
            await usersApi.updateMe(data);
            // Refresh user data
            await fetchUser();
        } catch (err) {
            console.error("Failed to update profile:", err);
            throw err;
        }
    };

    const refreshUser = async () => {
        await fetchUser();
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, isAdmin, login, googleLogin, logout, updateProfile, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
};
