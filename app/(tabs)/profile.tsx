import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { usersApi } from "../../lib/api";
import { useState } from "react";
import { User, Phone, Mail, Lock, LogOut, Camera, Save, Shield, DownloadCloud, Pause, Play, Trash2 } from "lucide-react-native";
import { router } from "expo-router";
import { useModelManager } from "../../lib/modelManager";

export default function ProfileScreen() {
    const { user, logout, refreshUser } = useAuth();

    const [fullName, setFullName] = useState(user?.full_name || "");
    const [phone, setPhone] = useState(user?.phone_number || "");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [saving, setSaving] = useState(false);
    const [modelUrl, setModelUrl] = useState("https://huggingface.co/nagireddy5/medgemma_Q3_K_M_Edge/resolve/main/medgemma-Q3_K_M.gguf");

    const {
        downloadProgress,
        isDownloading,
        isPaused,
        modelExists,
        error: modelError,
        startDownload,
        pauseDownload,
        resumeDownload,
        deleteModel
    } = useModelManager();

    const handleSave = async () => {
        setSaving(true);
        try {
            const updateData: any = {};
            if (fullName !== user?.full_name) updateData.full_name = fullName;
            if (phone !== user?.phone_number) updateData.phone_number = phone;
            if (newPassword && currentPassword) {
                updateData.password = newPassword;
            }

            if (Object.keys(updateData).length === 0) {
                if (Platform.OS === 'web') window.alert("Nothing to update.");
                else Alert.alert("No Changes", "Nothing to update.");
                setSaving(false);
                return;
            }

            await usersApi.updateMe(updateData);
            await refreshUser();

            if (Platform.OS === 'web') window.alert("Profile updated successfully ✓");
            else Alert.alert("Success", "Profile updated successfully ✓");

            setCurrentPassword("");
            setNewPassword("");
        } catch (err: any) {
            const msg = err?.response?.data?.detail || "Failed to update profile";
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert("Error", msg);
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        if (Platform.OS === 'web') {
            const confirmed = window.confirm("Are you sure you want to sign out?");
            if (confirmed) {
                logout().then(() => {
                    router.replace("/");
                });
            }
        } else {
            Alert.alert("Logout", "Are you sure you want to sign out?", [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sign Out", style: "destructive", onPress: async () => {
                        await logout();
                        router.replace("/");
                    }
                },
            ]);
        }
    };

    const roleBadge: Record<string, { bg: string; text: string }> = {
        doctor: { bg: "#DBEAFE", text: "#2563EB" },
        nurse: { bg: "#DCFCE7", text: "#16A34A" },
        patient: { bg: "#F3E8FF", text: "#9333EA" },
        super_admin: { bg: "#FEE2E2", text: "#DC2626" },
        hospital_admin: { bg: "#FFEDD5", text: "#EA580C" },
    };
    const badge = roleBadge[user?.role || ""] || { bg: "#F3F4F6", text: "#6B7280" };

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Header */}
                <View className="items-center pt-8 pb-6 bg-white border-b border-gray-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
                    <View className="relative mb-4">
                        <View className="w-24 h-24 rounded-full items-center justify-center" style={{ backgroundColor: '#F0FDFA', borderWidth: 2, borderColor: '#CCFBF1' }}>
                            {user?.image ? (
                                <Image source={{ uri: user.image }} className="w-24 h-24 rounded-full" />
                            ) : (
                                <User size={40} color="#0D9488" />
                            )}
                        </View>
                        <TouchableOpacity className="absolute bottom-0 right-0 w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: '#0D9488', borderWidth: 2, borderColor: '#FFFFFF' }}>
                            <Camera size={14} color="white" />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-gray-900 text-xl font-bold">{user?.full_name || "User"}</Text>
                    <Text className="text-gray-400 text-sm">{user?.email}</Text>
                    <View className="mt-2 px-3 py-1 rounded-full" style={{ backgroundColor: badge.bg }}>
                        <Text className="text-xs font-bold uppercase" style={{ color: badge.text }}>
                            {user?.role?.replace(/_/g, ' ') || "user"}
                        </Text>
                    </View>
                </View>

                {/* Personal Info */}
                <View className="px-6 mt-6 mb-6">
                    <View className="flex-row items-center gap-2 mb-4">
                        <User size={16} color="#0D9488" />
                        <Text className="text-gray-900 font-semibold text-base">Personal Information</Text>
                    </View>

                    <View className="gap-4">
                        <View>
                            <Text className="text-gray-400 text-xs font-medium mb-1.5 ml-1">Full Name</Text>
                            <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 }}>
                                <User size={16} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 text-gray-900 py-3.5 px-3 text-base"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    placeholder="Your full name"
                                    placeholderTextColor="#9CA3AF"
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-gray-400 text-xs font-medium mb-1.5 ml-1">Email</Text>
                            <View className="bg-gray-50 border border-gray-200 rounded-xl flex-row items-center px-4 opacity-60">
                                <Mail size={16} color="#9CA3AF" />
                                <Text className="flex-1 text-gray-500 py-3.5 px-3 text-base">{user?.email}</Text>
                            </View>
                        </View>

                        <View>
                            <Text className="text-gray-400 text-xs font-medium mb-1.5 ml-1">Phone Number</Text>
                            <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 }}>
                                <Phone size={16} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 text-gray-900 py-3.5 px-3 text-base"
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="+91 98765 43210"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="phone-pad"
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Security */}
                <View className="px-6 mb-6">
                    <View className="flex-row items-center gap-2 mb-4">
                        <Shield size={16} color="#0D9488" />
                        <Text className="text-gray-900 font-semibold text-base">Security</Text>
                    </View>

                    <View className="gap-4">
                        <View>
                            <Text className="text-gray-400 text-xs font-medium mb-1.5 ml-1">Current Password</Text>
                            <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 }}>
                                <Lock size={16} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 text-gray-900 py-3.5 px-3 text-base"
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    placeholder="Enter current password"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-gray-400 text-xs font-medium mb-1.5 ml-1">New Password</Text>
                            <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 }}>
                                <Lock size={16} color="#9CA3AF" />
                                <TextInput
                                    className="flex-1 text-gray-900 py-3.5 px-3 text-base"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    placeholder="Enter new password"
                                    placeholderTextColor="#9CA3AF"
                                    secureTextEntry
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Local AI Model Section */}
                <View className="px-6 mb-6">
                    <View className="flex-row items-center gap-2 mb-4">
                        <DownloadCloud size={16} color="#0D9488" />
                        <Text className="text-gray-900 font-semibold text-base">Local AI Model (Offline Mode)</Text>
                    </View>

                    <View className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-4">
                        <Text className="text-gray-500 text-xs mb-3">Download the medical model to your device to use AI features offline.</Text>

                        {!modelExists ? (
                            <>
                                <Text className="text-gray-400 text-xs font-medium mb-1.5 ml-1">Model URL (GGUF Source)</Text>
                                <View className="bg-gray-50 border border-gray-200 rounded-xl flex-row items-center px-3 mb-4">
                                    <TextInput
                                        className="flex-1 text-gray-900 py-3 text-sm"
                                        value={modelUrl}
                                        onChangeText={setModelUrl}
                                        placeholder="Enter .gguf link (e.g., from HuggingFace)"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        editable={!isDownloading}
                                    />
                                </View>

                                {modelError && (
                                    <Text className="text-red-500 text-xs mb-3">{modelError}</Text>
                                )}

                                {(isDownloading || isPaused) && (
                                    <View className="mb-4">
                                        <View className="flex-row justify-between mb-1">
                                            <Text className="text-xs text-gray-500">{isPaused ? "Paused" : "Downloading..."}</Text>
                                            <Text className="text-xs font-medium text-teal-700">{Math.round(downloadProgress * 100)}%</Text>
                                        </View>
                                        <View className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                                            <View
                                                className="h-full bg-teal-600 rounded-full"
                                                style={{ width: `${downloadProgress * 100}%` }}
                                            />
                                        </View>
                                    </View>
                                )}

                                <View className="flex-row gap-2">
                                    {(!isDownloading && !isPaused) ? (
                                        <TouchableOpacity
                                            onPress={() => startDownload(modelUrl)}
                                            className="flex-1 bg-teal-600 py-3 rounded-xl flex-row justify-center items-center"
                                        >
                                            <DownloadCloud size={16} color="white" />
                                            <Text className="text-white font-medium ml-2">Download Model</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <>
                                            {isDownloading ? (
                                                <TouchableOpacity
                                                    onPress={pauseDownload}
                                                    className="flex-1 bg-amber-500 py-3 rounded-xl flex-row justify-center items-center"
                                                >
                                                    <Pause size={16} color="white" />
                                                    <Text className="text-white font-medium ml-2">Pause</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <TouchableOpacity
                                                    onPress={resumeDownload}
                                                    className="flex-1 bg-teal-600 py-3 rounded-xl flex-row justify-center items-center"
                                                >
                                                    <Play size={16} color="white" />
                                                    <Text className="text-white font-medium ml-2">Resume</Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity
                                                onPress={deleteModel}
                                                className="flex-none bg-red-100 px-4 rounded-xl flex-row justify-center items-center"
                                            >
                                                <Trash2 size={16} color="#DC2626" />
                                            </TouchableOpacity>
                                        </>
                                    )}
                                </View>
                            </>
                        ) : (
                            <View className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex-row items-center justify-between">
                                <View className="flex-row items-center flex-1">
                                    <View className="w-8 h-8 rounded-full bg-teal-100 items-center justify-center mr-3">
                                        <Shield size={16} color="#0D9488" />
                                    </View>
                                    <View>
                                        <Text className="text-teal-900 font-medium">Model is Ready</Text>
                                        <Text className="text-teal-700 text-xs">Offline features are active</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={deleteModel}
                                    className="p-2"
                                >
                                    <Trash2 size={20} color="#DC2626" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* Actions */}
                <View className="px-6 gap-3">
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        className="rounded-xl py-4 flex-row items-center justify-center"
                        style={{ backgroundColor: saving ? '#5EEAD4' : '#0D9488', shadowColor: '#0D9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
                    >
                        {saving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Save size={18} color="white" />
                                <Text className="text-white font-bold text-base ml-2">Save Changes</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleLogout}
                        className="rounded-xl py-4 flex-row items-center justify-center"
                        style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' }}
                    >
                        <LogOut size={18} color="#DC2626" />
                        <Text className="font-bold text-base ml-2" style={{ color: '#DC2626' }}>Sign Out</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
