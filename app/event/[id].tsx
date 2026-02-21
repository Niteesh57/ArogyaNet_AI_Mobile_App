import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, Stack, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "../../lib/api";
import { Event } from "../../lib/types";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Save, Clock, Trash2, Edit2 } from "lucide-react-native";

export default function EventDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<Record<string, string>>({});

    const { data: event, isLoading, error } = useQuery({
        queryKey: ["event", id],
        queryFn: async () => {
            const res = await eventsApi.get(id as string);
            return res.data as Event;
        },
        enabled: !!id,
    });

    const appendMutation = useMutation({
        mutationFn: async (data: any) => {
            return await eventsApi.append(id as string, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["event", id] });
            setFormData({});
            Alert.alert("Success", "Entry added successfully!");
        },
        onError: (err) => {
            Alert.alert("Error", "Failed to add entry. " + err.message);
        }
    });

    const handleInputChange = (key: string, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        if (!event?.keys || event.keys.length === 0) return;

        // Simple validation: Ensure at least one field is filled? Or all?
        // For now, let's send whatever is in formData.
        appendMutation.mutate(formData);
    };

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                <Stack.Screen options={{ title: "Loading..." }} />
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    if (error || !event) {
        return (
            <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-900">
                <Stack.Screen options={{ title: "Error" }} />
                <Text className="text-red-500">Failed to load event details.</Text>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
            <Stack.Screen options={{ title: event.event_name, headerBackTitle: "Events" }} />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1 px-6 pt-4"
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Header Info */}
                    <View className="mb-6">
                        <Text className="text-2xl font-bold text-gray-900 dark:text-white">{event.event_name}</Text>
                        <Text className="text-gray-500 text-sm">Event ID: {event._id}</Text>
                    </View>

                    {/* Dynamic Data Entry Form */}
                    <View className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm mb-6 border border-gray-100 dark:border-gray-700">
                        <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Add Entry</Text>

                        {event.keys?.map((key) => (
                            <View key={key} className="mb-4">
                                <Text className="text-gray-600 dark:text-gray-300 mb-1 capitalize">{key.replace(/_/g, " ")}</Text>
                                <TextInput
                                    className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-gray-900 dark:text-white"
                                    placeholder={`Enter ${key}`}
                                    placeholderTextColor="#9CA3AF"
                                    value={formData[key] || ""}
                                    onChangeText={(text) => handleInputChange(key, text)}
                                />
                            </View>
                        ))}

                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={appendMutation.isPending}
                            className={`flex-row items-center justify-center p-4 rounded-xl mt-2 ${appendMutation.isPending ? 'bg-blue-400' : 'bg-blue-600'}`}
                        >
                            {appendMutation.isPending ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Save size={20} color="white" className="mr-2" />
                                    <Text className="text-white font-semibold text-lg">Save Entry</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* History / Logs */}
                    <Text className="text-lg font-semibold text-gray-800 dark:text-white mb-3">History</Text>
                    {event.json_data && event.json_data.length > 0 ? (
                        <View className="pb-10">
                            {[...event.json_data].reverse().map((entry, index) => (
                                <View key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl mb-3 shadow-sm border border-gray-100 dark:border-gray-700">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <View className="flex-row items-center">
                                            <Clock size={14} color="#6B7280" />
                                            <Text className="text-gray-500 text-xs ml-1">
                                                {entry._appended_at ? new Date(entry._appended_at).toLocaleString() : "Unknown Date"}
                                            </Text>
                                        </View>
                                        {/* Future: Add Edit/Delete buttons here */}
                                    </View>

                                    <View className="flex-row flex-wrap">
                                        {Object.entries(entry).map(([key, value]) => {
                                            if (key.startsWith("_")) return null; // Skip metadata
                                            return (
                                                <View key={key} className="mr-4 mb-2">
                                                    <Text className="text-gray-400 text-xs uppercase">{key}</Text>
                                                    <Text className="text-gray-900 dark:text-white font-medium">{String(value)}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text className="text-gray-500 text-center py-4">No entries yet.</Text>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
