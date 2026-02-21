import {
    View, Text, FlatList, TouchableOpacity, RefreshControl,
    ActivityIndicator, Modal, ScrollView, TextInput, Alert, Platform
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { eventsApi, agentApi, documentsApi } from "../../lib/api";
import { getOfflineActions, getCachedData, setCachedData } from "../../lib/sync";
import { askAI, isLocalModelAvailable } from "../../lib/ai";
import NetInfo from "@react-native-community/netinfo";
import { CalendarDays, ChevronRight, Plus, X, Database, Clock, Tag, Camera, Sparkles, WifiOff } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import * as ImagePicker from "expo-image-picker";

interface EventItem {
    id: string;
    event_name: string;
    json_data: any[];
    keys: string[];
    created_at: string;
    updated_at: string;
    isPending?: boolean;
}

export default function EventsScreen() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const isNurse = user?.role === "nurse" || user?.role === "super_admin" || user?.role === "hospital_admin";

    // Detail modal
    const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // Create modal
    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState("");
    const [newKeys, setNewKeys] = useState<string[]>([]);
    const [keyInput, setKeyInput] = useState("");
    const [creating, setCreating] = useState(false);

    // Append form
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [rawJson, setRawJson] = useState("");
    const [appending, setAppending] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState("");
    const [addEntryOpen, setAddEntryOpen] = useState(false);

    const [isOffline, setIsOffline] = useState(false);
    const [offlineActions, setOfflineActions] = useState<any[]>([]);
    const [modelAvailable, setModelAvailable] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!state.isConnected);
            if (state.isConnected) {
                refreshOfflineActions();
            }
        });
        refreshOfflineActions();
        checkModel();
        return () => unsubscribe();
    }, []);

    const checkModel = async () => {
        const available = await isLocalModelAvailable();
        setModelAvailable(available);
    };

    const refreshOfflineActions = async () => {
        const actions = await getOfflineActions("/events");
        setOfflineActions(actions);
    };

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["events"],
        queryFn: async () => {
            if (isOffline) {
                const cached = await getCachedData("events_list");
                if (cached) return cached;
                throw new Error("No offline data available. Please connect to internet once.");
            }
            try {
                const response = await eventsApi.list();
                const events = response.data as EventItem[];
                await setCachedData("events_list", events);
                return events;
            } catch (err) {
                const cached = await getCachedData("events_list");
                if (cached) return cached;
                throw err;
            }
        },
        // Don't show the full error screen if we have some data
        retry: isOffline ? 0 : 3,
    });

    const pendingCreateEvents = offlineActions.filter(a => a.method === 'POST' && a.endpoint === '/events/');
    const pendingAppendActions = (eventId: string) =>
        offlineActions.filter(a => a.method === 'PATCH' && a.endpoint.includes(`/events/${eventId}/append`));

    const combinedEvents = [
        ...pendingCreateEvents.map(a => {
            const body = JSON.parse(a.body);
            return {
                id: `pending_${a.id}`,
                event_name: body.event_name,
                keys: body.keys || [],
                json_data: [],
                isPending: true,
                created_at: a.created_at
            } as any;
        }),
        ...(data || [])
    ];

    const openDetail = async (event: EventItem) => {
        setSelectedEvent(event);
        // init form
        const init: Record<string, string> = {};
        (event.keys || []).forEach(k => init[k] = "");
        setFormData(init);
        setRawJson("");
        setDetailOpen(true);

        // Background update for detail data (caching inside data)
        if (!isOffline) {
            try {
                const res = await eventsApi.get(event.id);
                const fullEvent = res.data;
                setSelectedEvent(fullEvent);
                await setCachedData(`event_detail_${event.id}`, fullEvent);
            } catch (err) {
                console.warn("Failed to refresh event detail:", err);
            }
        } else {
            const cachedDetail = await getCachedData(`event_detail_${event.id}`);
            if (cachedDetail) {
                setSelectedEvent(cachedDetail);
            }
        }
    };

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            await eventsApi.create({ event_name: newName.trim(), keys: newKeys });
            setCreateOpen(false);
            setNewName("");
            setNewKeys([]);
            if (!isOffline) {
                queryClient.invalidateQueries({ queryKey: ["events"] });
            } else {
                refreshOfflineActions();
                Alert.alert("Offline", "Event saved locally and will sync when online.");
            }
        } catch {
            Alert.alert("Error", "Failed to create event");
        } finally {
            setCreating(false);
        }
    };

    const handleAppend = async () => {
        if (!selectedEvent) return;
        setAppending(true);
        try {
            let payload: any;
            if ((selectedEvent.keys || []).length > 0) {
                payload = formData;
            } else {
                try { payload = JSON.parse(rawJson); }
                catch { payload = { note: rawJson }; }
            }
            await eventsApi.append(selectedEvent.id, payload);

            if (isOffline) {
                refreshOfflineActions();
                Alert.alert("Offline", "Update saved locally and will sync when online.");
                // Reset form
                const init: Record<string, string> = {};
                (selectedEvent.keys || []).forEach(k => init[k] = "");
                setFormData(init);
                setRawJson("");
                return;
            }

            // Refresh the selected event
            const res = await eventsApi.get(selectedEvent.id);
            setSelectedEvent(res.data);
            // Reset form
            const init: Record<string, string> = {};
            (selectedEvent.keys || []).forEach(k => init[k] = "");
            setFormData(init);
            setRawJson("");
            queryClient.invalidateQueries({ queryKey: ["events"] });
        } catch {
            Alert.alert("Error", "Failed to append data");
        } finally {
            setAppending(false);
        }
    };

    const renderItem = ({ item }: { item: EventItem }) => (
        <TouchableOpacity
            className="bg-white p-4 mb-3 rounded-2xl border border-gray-100 flex-row items-center justify-between"
            style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            onPress={() => openDetail(item)}
        >
            <View className="flex-row items-center flex-1">
                <View className="p-3 rounded-xl mr-4" style={{ backgroundColor: item.isPending ? '#FEF2F2' : '#F0FDFA' }}>
                    <Database size={22} color={item.isPending ? '#EF4444' : '#0D9488'} />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                        <Text className="text-base font-semibold text-gray-900">{item.event_name || "Unnamed Event"}</Text>
                        {item.isPending && (
                            <View className="bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                                <Text className="text-[9px] font-bold text-red-600 uppercase">Pending Sync</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-gray-400 text-xs mt-0.5">
                        {item.json_data?.length || 0} entries · {(item.keys || []).length} fields
                    </Text>
                    {(item.keys || []).length > 0 && (
                        <View className="flex-row flex-wrap gap-1 mt-1.5">
                            {(item.keys || []).slice(0, 4).map(k => (
                                <View key={k} className="bg-gray-100 px-2 py-0.5 rounded-md">
                                    <Text className="text-gray-500 text-[10px]">{k}</Text>
                                </View>
                            ))}
                            {(item.keys || []).length > 4 && (
                                <Text className="text-gray-400 text-[10px] self-center">+{(item.keys || []).length - 4}</Text>
                            )}
                        </View>
                    )}
                </View>
            </View>
            <ChevronRight size={18} color="#9CA3AF" />
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center" edges={['top']}>
                <ActivityIndicator size="large" color="#0D9488" />
            </SafeAreaView>
        );
    }

    if (error) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center px-6" edges={['top']}>
                <Text className="text-red-500 text-lg mb-2">Error loading events</Text>
                <TouchableOpacity onPress={() => refetch()} className="bg-teal-600 px-6 py-2 rounded-lg">
                    <Text className="text-white font-medium">Retry</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* Header */}
            <View className="px-6 py-4 bg-white border-b border-gray-100 flex-row items-center justify-between"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
                <View>
                    <View className="flex-row items-center gap-2">
                        <Text className="text-gray-400 text-xs">Clinical</Text>
                        {isOffline && (
                            <View className="flex-row items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
                                <WifiOff size={10} color="#D97706" />
                                <Text className="text-[9px] font-bold text-amber-700 uppercase">Offline Mode</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-2xl font-bold text-gray-900">Events & Logs</Text>
                </View>
                {isNurse && (
                    <TouchableOpacity
                        onPress={() => setCreateOpen(true)}
                        className="flex-row items-center gap-2 px-4 py-2 rounded-xl"
                        style={{ backgroundColor: '#0D9488' }}
                    >
                        <Plus size={16} color="white" />
                        <Text className="text-white font-semibold text-sm">New</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={combinedEvents}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 20, paddingTop: 16 }}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#0D9488" />}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 mt-4">
                        <Database size={32} color="#D1D5DB" />
                        <Text className="text-gray-700 font-medium mt-3">No Events Found</Text>
                        <Text className="text-gray-400 text-sm mt-1 text-center">
                            {isNurse ? 'Tap "New" to create your first event.' : 'No events have been created yet.'}
                        </Text>
                    </View>
                }
            />

            {/* ── Detail Modal ── */}
            <Modal visible={detailOpen} animationType="slide" transparent>
                <View className="flex-1 bg-black/40 justify-end">
                    <View className="bg-white rounded-t-3xl" style={{ maxHeight: '92%' }}>
                        {/* Modal Header */}
                        <View className="flex-row justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100">
                            <View className="flex-1 mr-4">
                                <Text className="text-xs text-gray-400 uppercase tracking-wide">Event Details</Text>
                                <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
                                    {selectedEvent?.event_name}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setDetailOpen(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                <X size={18} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                            {/* Meta */}
                            <View className="flex-row gap-3 mb-5">
                                <View className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <Text className="text-gray-400 text-xs">Entries</Text>
                                    <Text className="text-gray-900 font-bold text-lg">{selectedEvent?.json_data?.length || 0}</Text>
                                </View>
                                <View className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <Text className="text-gray-400 text-xs">Fields</Text>
                                    <Text className="text-gray-900 font-bold text-lg">{selectedEvent?.keys?.length || 0}</Text>
                                </View>
                            </View>

                            {/* Fields */}
                            {(selectedEvent?.keys || []).length > 0 && (
                                <View className="mb-5">
                                    <Text className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-2">Schema Fields</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {(selectedEvent?.keys || []).map(k => (
                                            <View key={k} className="flex-row items-center gap-1 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCFBF1' }}>
                                                <Tag size={10} color="#0D9488" />
                                                <Text className="text-xs font-medium" style={{ color: '#0D9488' }}>{k}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* Entries */}
                            <Text className="text-gray-900 font-semibold text-base mb-3">
                                Data Entries ({(selectedEvent?.json_data?.length || 0) + (selectedEvent ? pendingAppendActions(selectedEvent.id).length : 0)})
                            </Text>

                            {/* Pending Entries */}
                            {selectedEvent && pendingAppendActions(selectedEvent.id).length > 0 && (
                                <View className="mb-4">
                                    <View className="flex-row items-center gap-2 mb-2">
                                        <Clock size={14} color="#EF4444" />
                                        <Text className="text-red-600 font-bold text-xs uppercase tracking-wider">Pending Synchronization</Text>
                                    </View>
                                    <View className="gap-3">
                                        {pendingAppendActions(selectedEvent.id).map((action, idx) => {
                                            const entry = JSON.parse(action.body);
                                            return (
                                                <View key={`pending-${idx}`} className="bg-red-50/50 rounded-xl p-4 border border-red-100 border-dashed">
                                                    <View className="flex-row items-center justify-between mb-3">
                                                        <Text className="text-red-400 text-[10px] font-medium uppercase">
                                                            Awaiting Internet · {new Date(action.created_at).toLocaleTimeString()}
                                                        </Text>
                                                        <View className="bg-red-100 px-2 py-0.5 rounded-md">
                                                            <Text className="text-red-700 text-[8px] font-bold">OFFLINE</Text>
                                                        </View>
                                                    </View>
                                                    <View className="gap-2">
                                                        {(selectedEvent?.keys || []).length > 0 ? (
                                                            <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                                                                {(selectedEvent?.keys || []).map(k => (
                                                                    <View key={k}>
                                                                        <Text className="text-red-300 text-[10px] uppercase font-bold">{k}</Text>
                                                                        <Text className="text-gray-900 font-semibold">{entry[k] ?? "—"}</Text>
                                                                    </View>
                                                                ))}
                                                            </View>
                                                        ) : (
                                                            <Text className="text-gray-700 text-xs font-mono">
                                                                {JSON.stringify(entry, null, 2)}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            {(selectedEvent?.json_data || []).length > 0 ? (
                                <View className="gap-3 mb-5">
                                    {(selectedEvent?.json_data || []).map((entry, idx) => {
                                        const metaKeys = ['_appended_by', '_appended_at', '_updated_at', '_updated_by'];
                                        const dataKeys = Object.keys(entry).filter(k => !metaKeys.includes(k));
                                        return (
                                            <View key={idx} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                <View className="flex-row items-center gap-1 mb-3">
                                                    <Clock size={11} color="#9CA3AF" />
                                                    <Text className="text-gray-400 text-xs">
                                                        {entry._appended_at
                                                            ? new Date(entry._appended_at).toLocaleString()
                                                            : `Entry ${idx + 1}`}
                                                    </Text>
                                                </View>
                                                <View className="gap-2">
                                                    {(selectedEvent?.keys || []).length > 0 ? (
                                                        <View className="flex-row flex-wrap gap-x-6 gap-y-2">
                                                            {(selectedEvent?.keys || []).map(k => (
                                                                <View key={k}>
                                                                    <Text className="text-gray-400 text-[10px] uppercase">{k}</Text>
                                                                    <Text className="text-gray-900 font-semibold">{entry[k] ?? "—"}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    ) : (
                                                        <Text className="text-gray-700 text-xs font-mono">
                                                            {JSON.stringify(Object.fromEntries(dataKeys.map(k => [k, entry[k]])), null, 2)}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : (
                                <View className="bg-gray-50 rounded-xl p-6 items-center border border-dashed border-gray-200 mb-5">
                                    <Text className="text-gray-400 text-sm">No entries yet</Text>
                                </View>
                            )}

                        </ScrollView>

                        {/* Sticky Action Bar */}
                        {isNurse && (
                            <View className="px-6 py-4 border-t border-gray-100 bg-white">
                                <TouchableOpacity
                                    onPress={() => setAddEntryOpen(true)}
                                    className="bg-teal-600 rounded-xl py-4 items-center flex-row justify-center gap-2"
                                >
                                    <Plus size={18} color="white" />
                                    <Text className="text-white font-bold text-base">Add Entry</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── Add Entry Modal ── */}
            <Modal visible={addEntryOpen} animationType="fade" transparent>
                <View className="flex-1 bg-black/50 justify-center items-center px-4">
                    <View className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
                        {/* Header */}
                        <View className="flex-row justify-between items-center px-6 py-5 border-b border-gray-100">
                            <View>
                                <Text className="text-lg font-bold text-gray-900">New Entry</Text>
                                <Text className="text-xs text-gray-400">Add data to {selectedEvent?.event_name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => !scanning && setAddEntryOpen(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                <X size={18} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 24 }}>
                            {/* AI Scan Section */}
                            {(selectedEvent?.keys || []).length > 0 && (
                                <View className="mb-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 border-dashed items-center">
                                    <View className="w-14 h-14 bg-blue-100 rounded-full items-center justify-center mb-3">
                                        <Sparkles size={28} color="#3B82F6" />
                                    </View>
                                    <Text className="text-gray-900 font-bold text-center mb-1">AI Smart Extract</Text>
                                    <Text className="text-gray-500 text-xs text-center mb-4 px-4">Take a photo of a form and let AI auto-fill all the fields for you instantly.</Text>

                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (!selectedEvent) return;
                                            setScanning(true);
                                            setScanStatus("Opening camera...");
                                            try {
                                                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                                                if (status !== "granted") {
                                                    Alert.alert("Permission Denied", "Camera access is required to use AI Scan.");
                                                    return;
                                                }
                                                const result = await ImagePicker.launchCameraAsync({
                                                    mediaTypes: ['images'],
                                                    quality: 0.8,
                                                });
                                                if (result.canceled || !result.assets?.[0]) {
                                                    setScanStatus("");
                                                    setScanning(false);
                                                    return;
                                                }

                                                setScanStatus("AI is uploading image...");
                                                const asset = result.assets[0];
                                                const formDataUpload = new FormData();
                                                formDataUpload.append("title", "ai_scan_" + Date.now());

                                                if (Platform.OS === 'web') {
                                                    const response = await fetch(asset.uri);
                                                    const blob = await response.blob();
                                                    formDataUpload.append("file", blob, "scan.jpg");
                                                } else {
                                                    formDataUpload.append("file", {
                                                        uri: asset.uri,
                                                        name: "scan.jpg",
                                                        type: "image/jpeg",
                                                    } as any);
                                                }

                                                const uploadRes = await documentsApi.upload(formDataUpload);
                                                const imageUrl = uploadRes.data.file_url;

                                                setScanStatus("Preparing MedGemma...");
                                                let extractedData: any;
                                                if (isOffline) {
                                                    const prompt = `Extract medical data for these fields: ${selectedEvent.keys.join(", ")}. Return ONLY a JSON object. Since I am offline, I cannot see the image, so please provide clear placeholder instructions for the user to manually enter ${selectedEvent.keys.join(", ")} while mentioning the model name MedGemma.`;
                                                    const response = await askAI(prompt);
                                                    try {
                                                        extractedData = JSON.parse(response);
                                                    } catch {
                                                        extractedData = {};
                                                        selectedEvent.keys.forEach(k => extractedData[k] = `[Manual ${k}]`);
                                                    }
                                                } else {
                                                    const aiRes = await agentApi.populateEventData({
                                                        image_url: imageUrl,
                                                        keys: selectedEvent.keys,
                                                    });
                                                    extractedData = aiRes.data;
                                                }

                                                if (extractedData && !extractedData.error) {
                                                    setFormData(prev => {
                                                        const updated = { ...prev };
                                                        for (const key of selectedEvent.keys) {
                                                            if (extractedData[key] != null) {
                                                                updated[key] = String(extractedData[key]);
                                                            }
                                                        }
                                                        return updated;
                                                    });
                                                    setScanStatus("Complete!");
                                                    setTimeout(() => setScanStatus(""), 2000);
                                                } else {
                                                    Alert.alert("Scan Failed", extractedData?.error || "Could not extract data.");
                                                    setScanStatus("");
                                                }
                                            } catch (e: any) {
                                                Alert.alert("Error", e?.message || "AI Scan failed.");
                                                setScanStatus("");
                                            } finally {
                                                setScanning(false);
                                            }
                                        }}
                                        disabled={scanning}
                                        className="bg-blue-600 px-8 py-3 rounded-xl flex-row items-center justify-center gap-2 w-full"
                                    >
                                        {scanning ? <ActivityIndicator size="small" color="white" /> : <Camera size={18} color="white" />}
                                        <Text className="text-white font-bold">{scanning ? scanStatus || "Processing..." : "Start AI Scan"}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Manual Form */}
                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-4">Manual Entry</Text>
                            {(selectedEvent?.keys || []).length > 0 ? (
                                <View className="gap-4">
                                    {(selectedEvent?.keys || []).map(k => (
                                        <View key={k}>
                                            <Text className="text-gray-500 text-xs font-semibold mb-1.5 ml-1">{k}</Text>
                                            <TextInput
                                                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-gray-900"
                                                placeholder={`Type ${k.toLowerCase()}...`}
                                                placeholderTextColor="#9CA3AF"
                                                value={formData[k] || ""}
                                                onChangeText={v => setFormData(p => ({ ...p, [k]: v }))}
                                            />
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <TextInput
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3.5 text-gray-900"
                                    placeholder='{"status": "stable", "notes": "..."}'
                                    placeholderTextColor="#9CA3AF"
                                    value={rawJson}
                                    onChangeText={setRawJson}
                                    multiline
                                    style={{ minHeight: 120, textAlignVertical: 'top' }}
                                />
                            )}
                        </ScrollView>

                        {/* Footer */}
                        <View className="p-6 bg-gray-50 border-t border-gray-100">
                            <TouchableOpacity
                                onPress={handleAppend}
                                disabled={appending || scanning}
                                className="w-full rounded-2xl py-4 items-center justify-center flex-row gap-2"
                                style={{ backgroundColor: '#0D9488' }}
                            >
                                {appending ? <ActivityIndicator size="small" color="white" /> : <Plus size={18} color="white" />}
                                <Text className="text-white font-bold text-base">
                                    {appending ? "Saving..." : "Save Entry"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Create Event Modal ── */}
            <Modal visible={createOpen} animationType="slide" transparent>
                <View className="flex-1 bg-black/40 justify-end">
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row justify-between items-center mb-5">
                            <Text className="text-xl font-bold text-gray-900">Create Event</Text>
                            <TouchableOpacity onPress={() => setCreateOpen(false)}>
                                <X size={22} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-gray-500 text-xs font-medium mb-1">Event Name</Text>
                        <TextInput
                            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4"
                            placeholder="e.g., Night Shift Vitals"
                            placeholderTextColor="#9CA3AF"
                            value={newName}
                            onChangeText={setNewName}
                        />

                        <Text className="text-gray-500 text-xs font-medium mb-1">Schema Fields (optional)</Text>
                        <View className="flex-row gap-2 mb-2">
                            <TextInput
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                                placeholder="Add field (e.g., BP, HR, Temp)"
                                placeholderTextColor="#9CA3AF"
                                value={keyInput}
                                onChangeText={setKeyInput}
                                onSubmitEditing={() => {
                                    if (keyInput.trim() && !newKeys.includes(keyInput.trim())) {
                                        setNewKeys([...newKeys, keyInput.trim()]);
                                        setKeyInput("");
                                    }
                                }}
                            />
                            <TouchableOpacity
                                onPress={() => {
                                    if (keyInput.trim() && !newKeys.includes(keyInput.trim())) {
                                        setNewKeys([...newKeys, keyInput.trim()]);
                                        setKeyInput("");
                                    }
                                }}
                                className="px-4 py-3 rounded-xl"
                                style={{ backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCFBF1' }}
                            >
                                <Text style={{ color: '#0D9488' }} className="font-semibold">Add</Text>
                            </TouchableOpacity>
                        </View>

                        {newKeys.length > 0 && (
                            <View className="flex-row flex-wrap gap-2 mb-4">
                                {newKeys.map(k => (
                                    <TouchableOpacity
                                        key={k}
                                        onPress={() => setNewKeys(newKeys.filter(nk => nk !== k))}
                                        className="flex-row items-center gap-1 px-3 py-1.5 rounded-full"
                                        style={{ backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCFBF1' }}
                                    >
                                        <Text className="text-xs font-medium" style={{ color: '#0D9488' }}>{k}</Text>
                                        <X size={10} color="#0D9488" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <View className="flex-row gap-3 mt-2">
                            <TouchableOpacity onPress={() => setCreateOpen(false)} className="flex-1 bg-gray-100 rounded-xl py-3.5 items-center">
                                <Text className="text-gray-500 font-medium">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleCreate}
                                disabled={creating || !newName.trim()}
                                className="flex-1 rounded-xl py-3.5 items-center"
                                style={{ backgroundColor: newName.trim() ? '#0D9488' : '#D1D5DB' }}
                            >
                                <Text className="text-white font-bold">{creating ? "Creating..." : "Create"}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
