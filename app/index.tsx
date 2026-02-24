import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert, Image, Linking } from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../lib/api";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight } from "lucide-react-native";
import api from "../lib/api";
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

export default function LoginScreen() {
    const { login, googleLogin, user, isLoading } = useAuth();
    const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");

    // Sign In
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Sign Up
    const [signupForm, setSignupForm] = useState({ full_name: "", email: "", password: "", confirmPassword: "" });
    const [signupLoading, setSignupLoading] = useState(false);

    useEffect(() => {
        GoogleSignin.configure({
            webClientId: '270216039919-k8uaga67r4ohvvvvgtj8b0l9kekojfa8.apps.googleusercontent.com',
            offlineAccess: true,
        });
    }, []);

    useEffect(() => {
        if (user && !isLoading) {
            router.replace("/(tabs)/dashboard");
        }
    }, [user, isLoading]);

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#0D9488" />
                <Text className="text-gray-400 mt-4 text-sm">Loading...</Text>
            </View>
        );
    }

    const handleSignIn = async () => {
        if (!email.trim() || !password.trim()) {
            setError("Please enter email and password");
            return;
        }
        setError("");
        setLoading(true);
        try {
            await login(email, password);
            router.replace("/(tabs)/dashboard");
        } catch (err: any) {
            const msg = err?.response?.data?.detail || "Invalid credentials. Please try again.";
            setError(typeof msg === "string" ? msg : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        try {
            await GoogleSignin.hasPlayServices();
            const userInfo = await GoogleSignin.signIn();
            const idToken = userInfo?.data?.idToken || userInfo?.idToken;

            if (idToken) {
                setLoading(true);
                await googleLogin(idToken);
                router.replace("/(tabs)/dashboard");
            } else {
                Alert.alert("Error", "Missing ID token from Google Sign-In");
            }
        } catch (error: any) {
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                // user cancelled the login flow
            } else if (error.code === statusCodes.IN_PROGRESS) {
                // operation (e.g. sign in) is in progress already
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                // play services not available or outdated
                Alert.alert("Error", "Google Play Services are not available");
            } else {
                // some other error happened
                Alert.alert("Google Login Error", error.message || "An unknown error occurred.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async () => {
        if (!signupForm.full_name.trim() || !signupForm.email.trim() || !signupForm.password.trim()) {
            Alert.alert("Error", "Please fill all fields");
            return;
        }
        if (signupForm.password !== signupForm.confirmPassword) {
            Alert.alert("Error", "Passwords do not match");
            return;
        }
        if (signupForm.password.length < 8) {
            Alert.alert("Error", "Password must be at least 8 characters");
            return;
        }
        setSignupLoading(true);
        try {
            await authApi.register({
                user_in: { email: signupForm.email, password: signupForm.password, full_name: signupForm.full_name }
            });
            Alert.alert("Success", "Account created! Please sign in.", [
                { text: "OK", onPress: () => setActiveTab("signin") }
            ]);
            setSignupForm({ full_name: "", email: "", password: "", confirmPassword: "" });
        } catch (err: any) {
            Alert.alert("Registration Failed", err?.response?.data?.detail || "Please try again");
        } finally {
            setSignupLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-slate-50">
            <StatusBar style="dark" />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                    {/* Header / Branding */}
                    <View className="pt-16 pb-8 px-8 items-center">
                        <Image
                            source={require("../assets/icon.png")}
                            style={{ width: 72, height: 72, borderRadius: 20 }}
                            resizeMode="contain"
                        />
                        <Text className="text-3xl font-bold text-gray-900 tracking-tight mt-4">ArogyaNet AI</Text>
                        <Text className="text-gray-500 text-sm mt-1">Federated Clinical Intelligence</Text>
                    </View>

                    {/* Tab Switcher */}
                    <View className="mx-8 mb-6">
                        <View className="flex-row bg-gray-100 rounded-xl p-1">
                            <TouchableOpacity
                                onPress={() => setActiveTab("signin")}
                                className={`flex-1 py-2.5 rounded-lg items-center ${activeTab === "signin" ? "bg-teal-600" : ""}`}
                            >
                                <Text className={`font-semibold text-sm ${activeTab === "signin" ? "text-white" : "text-gray-500"}`}>
                                    Sign In
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setActiveTab("signup")}
                                className={`flex-1 py-2.5 rounded-lg items-center ${activeTab === "signup" ? "bg-teal-600" : ""}`}
                            >
                                <Text className={`font-semibold text-sm ${activeTab === "signup" ? "text-white" : "text-gray-500"}`}>
                                    Sign Up
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Forms */}
                    <View className="px-8 flex-1">
                        {activeTab === "signin" ? (
                            <View className="gap-4">
                                <Text className="text-xl font-bold text-gray-900 mb-1">Welcome back</Text>
                                <Text className="text-gray-500 text-sm -mt-3 mb-2">Enter your credentials to continue</Text>

                                {error ? (
                                    <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                        <Text className="text-red-600 text-sm">{error}</Text>
                                    </View>
                                ) : null}

                                {/* Email */}
                                <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                                    <Mail size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 text-gray-900 py-4 px-3 text-base"
                                        placeholder="Email address"
                                        placeholderTextColor="#9CA3AF"
                                        value={email}
                                        onChangeText={(v) => { setEmail(v); setError(""); }}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                </View>

                                {/* Password */}
                                <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                                    <Lock size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 text-gray-900 py-4 px-3 text-base"
                                        placeholder="Password"
                                        placeholderTextColor="#9CA3AF"
                                        value={password}
                                        onChangeText={(v) => { setPassword(v); setError(""); }}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
                                    </TouchableOpacity>
                                </View>

                                {/* Sign In Button */}
                                <TouchableOpacity
                                    onPress={handleSignIn}
                                    disabled={loading}
                                    className={`rounded-xl py-4 flex-row items-center justify-center mt-2 ${loading ? "bg-teal-400" : "bg-teal-600"}`}
                                    style={{ shadowColor: '#0D9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-bold text-base mr-2">Sign In</Text>
                                            <ArrowRight size={18} color="white" />
                                        </>
                                    )}
                                </TouchableOpacity>

                                {/* Divider */}
                                <View className="flex-row items-center my-2">
                                    <View className="flex-1 h-px bg-gray-200" />
                                    <Text className="mx-4 text-gray-400 text-xs font-medium">OR CONTINUE WITH</Text>
                                    <View className="flex-1 h-px bg-gray-200" />
                                </View>

                                {/* Google Auth Button */}
                                <TouchableOpacity
                                    disabled={true}
                                    className="bg-gray-100 border border-gray-200 rounded-xl py-3.5 flex-row items-center justify-center opacity-60"
                                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
                                >
                                    <Text className="text-lg mr-2">G</Text>
                                    <Text className="text-gray-400 font-semibold text-sm">Google</Text>
                                    <View className="bg-teal-100 rounded-full px-2 py-0.5 ml-2">
                                        <Text className="text-teal-700 text-xs font-medium">Coming Soon</Text>
                                    </View>
                                </TouchableOpacity>

                            </View>
                        ) : (
                            /* Sign Up Form */
                            <View className="gap-4">
                                <Text className="text-xl font-bold text-gray-900 mb-1">Create account</Text>
                                <Text className="text-gray-500 text-sm -mt-3 mb-2">Enter your details to get started</Text>

                                <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                                    <User size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 text-gray-900 py-4 px-3 text-base"
                                        placeholder="Full Name"
                                        placeholderTextColor="#9CA3AF"
                                        value={signupForm.full_name}
                                        onChangeText={(v) => setSignupForm(p => ({ ...p, full_name: v }))}
                                    />
                                </View>

                                <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                                    <Mail size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 text-gray-900 py-4 px-3 text-base"
                                        placeholder="Email address"
                                        placeholderTextColor="#9CA3AF"
                                        value={signupForm.email}
                                        onChangeText={(v) => setSignupForm(p => ({ ...p, email: v }))}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                                    <Lock size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 text-gray-900 py-4 px-3 text-base"
                                        placeholder="Password (min 8 chars)"
                                        placeholderTextColor="#9CA3AF"
                                        value={signupForm.password}
                                        onChangeText={(v) => setSignupForm(p => ({ ...p, password: v }))}
                                        secureTextEntry
                                    />
                                </View>

                                <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                                    <Lock size={18} color="#9CA3AF" />
                                    <TextInput
                                        className="flex-1 text-gray-900 py-4 px-3 text-base"
                                        placeholder="Confirm password"
                                        placeholderTextColor="#9CA3AF"
                                        value={signupForm.confirmPassword}
                                        onChangeText={(v) => setSignupForm(p => ({ ...p, confirmPassword: v }))}
                                        secureTextEntry
                                    />
                                </View>

                                <TouchableOpacity
                                    onPress={handleSignUp}
                                    disabled={signupLoading}
                                    className={`rounded-xl py-4 flex-row items-center justify-center mt-2 ${signupLoading ? "bg-teal-400" : "bg-teal-600"}`}
                                    style={{ shadowColor: '#0D9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }}
                                >
                                    {signupLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Text className="text-white font-bold text-base mr-2">Create Account</Text>
                                            <ArrowRight size={18} color="white" />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Footer */}
                    <View className="py-6 px-8 items-center">
                        <Text className="text-gray-400 text-xs">© 2026 ArogyaNet AI Systems. Secured by Life Health.</Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
