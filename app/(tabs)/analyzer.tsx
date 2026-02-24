import React, { useState, useRef, useEffect } from "react";
import {
    View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
    Alert, Platform, Image, StyleSheet
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, Sparkles, X, FileText, Upload, RefreshCcw, WifiOff, Clock, Trash2 } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { documentsApi } from "../../lib/api";
import { fetchStream } from "../../lib/streaming";
import { isLocalModelAvailable } from "../../lib/ai";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Markdown from "react-native-markdown-display";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.29.67:8000/api/v1";
const QUEUE_KEY = "@analyzer_offline_queue";

interface QueuedItem {
    id: string;
    image: string;
    status: "queued" | "processing" | "completed" | "error";
    summary: string;
}

export default function AnalyzerScreen() {
    const [image, setImage] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [summary, setSummary] = useState("");
    const [status, setStatus] = useState("");
    const [isOffline, setIsOffline] = useState(false);
    const [modelAvailable, setModelAvailable] = useState(false);
    const [queue, setQueue] = useState<QueuedItem[]>([]);
    const scrollRef = useRef<ScrollView>(null);

    // Initial loads
    useEffect(() => {
        loadQueue();
        checkModel();

        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!state.isConnected);
        });
        return () => unsubscribe();
    }, []);

    // Sync queue when coming online
    useEffect(() => {
        if (!isOffline && queue.length > 0) {
            processQueue();
        }
    }, [isOffline]);

    const loadQueue = async () => {
        try {
            const stored = await AsyncStorage.getItem(QUEUE_KEY);
            if (stored) {
                setQueue(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to load queue", e);
        }
    };

    const saveQueue = async (newQueue: QueuedItem[]) => {
        try {
            await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
            setQueue(newQueue);
        } catch (e) {
            console.error("Failed to save queue", e);
        }
    };

    const checkModel = async () => {
        const available = await isLocalModelAvailable();
        setModelAvailable(available);
    };

    const pickImage = async (useCamera = false) => {
        try {
            const permissionResult = useCamera
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (permissionResult.status !== "granted") {
                Alert.alert("Permission Required", "Camera/Gallery access is needed.");
                return;
            }

            const result = useCamera
                ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
                : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

            if (!result.canceled && result.assets?.[0]) {
                setImage(result.assets[0].uri);
                setSummary("");
                setStatus("");
            }
        } catch (e) {
            Alert.alert("Error", "Failed to pick image");
        }
    };

    const startAnalysis = async () => {
        if (!image) return;

        if (isOffline) {
            // Check queue limit
            const pendingItems = queue.filter(q => q.status === "queued" || q.status === "processing" || q.status === "error");
            if (pendingItems.length >= 2) {
                Alert.alert("Queue Full", "You can only queue a maximum of 2 offline reports at a time.");
                return;
            }

            // Current offline model is text-only and cannot analyze images
            setSummary(
                "## ⚠️ Offline Image Analysis Not Available\n\n" +
                "The current on-device AI model is a **text-only** model and is **not capable of analyzing medical images** offline.\n\n" +
                "Your report has been **queued** and will be automatically analyzed by our cloud AI (MedGemma) as soon as internet connectivity is restored.\n\n" +
                "---\n\n" +
                "### 🔮 Coming Soon\n\n" +
                "We are working on integrating a **qualified multimodal medical model** that will support **full offline image analysis** directly on your device — no internet required.\n\n" +
                "Stay tuned for future updates!"
            );
            setStatus("Complete (Queued)");

            // Save to offline queue for actual processing later
            const newItem: QueuedItem = {
                id: Date.now().toString(),
                image: image,
                status: "queued",
                summary: ""
            };
            await saveQueue([...queue, newItem]);
            return;
        }

        // Online Flow
        setAnalyzing(true);
        setSummary("");
        setStatus("Uploading report...");

        try {
            await processSingleImage(image, (chunkStr) => {
                setSummary(prev => {
                    const next = prev + chunkStr;
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
                    return next;
                });
            }, setStatus);
        } catch (e: any) {
            Alert.alert("Analysis Failed", e?.message || "Something went wrong");
        } finally {
            setAnalyzing(false);
            if (status !== "Complete") setStatus("");
        }
    };

    // Shared upload & SSE fetch logic
    const processSingleImage = async (
        imgUri: string,
        onChunk: (text: string) => void,
        onStatus: (s: string) => void
    ) => {
        // 1. Upload image
        const formData = new FormData();
        formData.append("title", "report_analyzer_" + Date.now());

        if (Platform.OS === 'web') {
            const response = await fetch(imgUri);
            const blob = await response.blob();
            formData.append("file", blob, "report.jpg");
        } else {
            formData.append("file", {
                uri: imgUri,
                name: "report.jpg",
                type: "image/jpeg",
            } as any);
        }

        const uploadRes = await documentsApi.upload(formData);
        const imageUrl = uploadRes.data.file_url;

        // 2. Start SSE Streaming
        onStatus("Analyzing with AI...");
        const token = await AsyncStorage.getItem("lh_token");

        await fetchStream(`${API_URL}/agent/summarize-medical-report`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ image_url: imageUrl }),
            onChunk: (chunk) => {
                const lines = chunk.split("\n");
                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.substring(6));
                            if (data.type === "token") {
                                onChunk(data.content);
                            } else if (data.type === "done") {
                                onStatus("Complete");
                            } else if (data.type === "error") {
                                console.error("AI Error:", data.message);
                                onStatus("Error");
                            }
                        } catch (e) {
                            // Skip non-json segments
                        }
                    }
                }
            },
            onError: (err) => {
                throw err;
            }
        });
    };

    const processQueue = async () => {
        const currentQueue = [...queue]; // Use local copy to mutate
        let hasChanges = false;

        for (let i = 0; i < currentQueue.length; i++) {
            const item = currentQueue[i];
            if (item.status === "queued" || item.status === "error") {
                hasChanges = true;
                currentQueue[i] = { ...item, status: "processing", summary: "" };
                setQueue([...currentQueue]); // Update UI immediately

                try {
                    await processSingleImage(
                        item.image,
                        (chunkStr) => {
                            currentQueue[i].summary += chunkStr;
                            setQueue([...currentQueue]); // Re-render chunks
                        },
                        (newStatus) => {
                            if (newStatus === "Complete") {
                                currentQueue[i].status = "completed";
                            } else if (newStatus === "Error") {
                                currentQueue[i].status = "error";
                            }
                            setQueue([...currentQueue]);
                        }
                    );
                } catch (e) {
                    console.error("Failed queued item:", e);
                    currentQueue[i].status = "error";
                    setQueue([...currentQueue]);
                }
            }
        }

        if (hasChanges) {
            await saveQueue([...currentQueue]);
        }
    };

    const removeQueuedItem = async (id: string) => {
        const newQueue = queue.filter(q => q.id !== id);
        await saveQueue(newQueue);
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* Header */}
            <View className="px-6 py-4 bg-white border-b border-gray-100 flex-row items-center justify-between shadow-sm">
                <View className="flex-row items-center gap-3">
                    <View className="p-2 bg-teal-50 rounded-lg">
                        <Sparkles size={20} color="#0D9488" />
                    </View>
                    <View>
                        <Text className="text-gray-900 font-bold text-lg">AI Report Analyzer</Text>
                        <View className="flex-row items-center gap-1">
                            {isOffline ? (
                                <>
                                    <WifiOff size={10} color="#EF4444" />
                                    <Text className="text-red-500 text-xs text-uppercase font-medium">Offline Mode</Text>
                                </>
                            ) : (
                                <Text className="text-gray-400 text-xs text-uppercase">Powered by Gemini 1.5</Text>
                            )}
                        </View>
                    </View>
                </View>
                {image && !analyzing && (
                    <TouchableOpacity onPress={() => { setImage(null); setSummary(""); }} className="p-2 bg-gray-100 rounded-full">
                        <RefreshCcw size={16} color="#6B7280" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                ref={scrollRef}
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {!image ? (
                    <View className="mt-10">
                        <View className="bg-white rounded-3xl p-10 items-center border border-dashed border-gray-200 shadow-sm">
                            <View className="w-20 h-20 bg-teal-50 rounded-full items-center justify-center mb-6">
                                <FileText size={40} color="#0D9488" />
                            </View>
                            <Text className="text-xl font-bold text-gray-900 text-center mb-2">Analyze Your Report</Text>
                            <Text className="text-gray-500 text-center mb-10 px-4 leading-5">
                                Upload a photo of your prescription, test results, or doctor's notes for an instant AI summary.
                            </Text>

                            <View className="w-full gap-4">
                                <TouchableOpacity
                                    onPress={() => pickImage(true)}
                                    className="bg-teal-600 rounded-2xl py-4 flex-row items-center justify-center gap-3"
                                >
                                    <Camera size={20} color="white" />
                                    <Text className="text-white font-bold text-base">Take a Photo</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => pickImage(false)}
                                    className="bg-white border border-gray-200 rounded-2xl py-4 flex-row items-center justify-center gap-3"
                                >
                                    <Upload size={20} color="#374151" />
                                    <Text className="text-gray-700 font-bold text-base">Choose from Gallery</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View className="mt-8 px-4">
                            <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">How it works</Text>
                            <View className="gap-4">
                                <StepItem number="1" text="Upload a clear photo of the medical document." />
                                <StepItem number="2" text={isOffline ? "App saves it in queue (Max 2 offline syncs)." : "AI analyzes handwriting and complex terminology."} />
                                <StepItem number="3" text={isOffline ? "Provides generic offline tips until internet connects." : "Get a structured summary and recommendations."} />
                            </View>
                        </View>
                    </View>
                ) : (
                    <View>
                        {/* Image Preview */}
                        <View className="bg-white rounded-2xl p-2 mb-6 shadow-sm border border-gray-100">
                            <Image source={{ uri: image }} className="w-full h-64 rounded-xl" resizeMode="cover" />
                            {!analyzing && !summary && (
                                <View className="p-4 items-center">
                                    <TouchableOpacity
                                        onPress={startAnalysis}
                                        className="bg-teal-600 rounded-xl py-3 px-8 flex-row items-center gap-2"
                                    >
                                        {isOffline ? <Clock size={18} color="white" /> : <Sparkles size={18} color="white" />}
                                        <Text className="text-white font-bold">{isOffline ? "Queue Offline Analysis" : "Analyze Report"}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* Analysis Content */}
                        {(analyzing || summary !== "") && (
                            <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                                <View className="flex-row items-center justify-between mb-6">
                                    <Text className="text-gray-900 font-bold text-lg">
                                        {analyzing && isOffline ? "Local AI Note" : "AI Analysis"}
                                    </Text>
                                    {analyzing && (
                                        <View className="flex-row items-center gap-2 px-3 py-1 bg-teal-50 rounded-full">
                                            <ActivityIndicator size="small" color="#0D9488" />
                                            <Text className="text-teal-700 text-xs font-semibold">{status}</Text>
                                        </View>
                                    )}
                                </View>

                                {summary === "" && analyzing ? (
                                    <View className="py-20 items-center">
                                        <ActivityIndicator size="large" color="#0D9488" />
                                        <Text className="text-gray-400 mt-4 animate-pulse">Consulting medical AI...</Text>
                                    </View>
                                ) : (
                                    <View>
                                        <Markdown style={markdownStyles}>
                                            {summary}
                                        </Markdown>
                                        {status.includes("Complete") && (
                                            <View className="mt-6 pt-6 border-t border-gray-50 items-center">
                                                <View className="bg-blue-50 px-4 py-2 rounded-lg flex-row items-center gap-2">
                                                    <FileText size={14} color="#3B82F6" />
                                                    <Text className="text-blue-600 text-[10px] font-bold uppercase">
                                                        {isOffline ? "Analysis Queued for Online Sync" : "One-time Analysis · Not Saved"}
                                                    </Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                {/* Queued Items Section */}
                {queue.length > 0 && (
                    <View className="mt-8">
                        <View className="flex-row items-center gap-2 mb-4 px-2">
                            <Clock size={16} color="#6B7280" />
                            <Text className="text-gray-700 font-bold text-base uppercase tracking-wider">Queued Offline Reports</Text>
                            <View className="bg-gray-200 px-2 py-0.5 rounded-full ml-auto">
                                <Text className="text-xs font-bold text-gray-600">{queue.length} / 2</Text>
                            </View>
                        </View>

                        <View className="gap-4">
                            {queue.map((item) => (
                                <View key={item.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                    <View className="flex-row items-center justify-between bg-gray-50 p-3 border-b border-gray-100">
                                        <View className="flex-row items-center gap-2">
                                            {item.status === "queued" && <Clock size={14} color="#F59E0B" />}
                                            {item.status === "processing" && <ActivityIndicator size="small" color="#3B82F6" />}
                                            {item.status === "completed" && <Sparkles size={14} color="#10B981" />}
                                            {item.status === "error" && <X size={14} color="#EF4444" />}
                                            <Text className="text-xs font-bold uppercase text-gray-500">
                                                Status: <Text style={{
                                                    color: item.status === "queued" ? "#F59E0B"
                                                        : item.status === "processing" ? "#3B82F6"
                                                            : item.status === "completed" ? "#10B981"
                                                                : "#EF4444"
                                                }}>{item.status}</Text>
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={() => removeQueuedItem(item.id)} className="p-1">
                                            <Trash2 size={16} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>

                                    <View className="p-4 flex-row gap-4">
                                        <Image source={{ uri: item.image }} className="w-20 h-24 rounded-lg bg-gray-100" />
                                        <ScrollView className="flex-1 max-h-40" nestedScrollEnabled>
                                            {item.summary ? (
                                                <Markdown style={markdownStyles}>{item.summary}</Markdown>
                                            ) : (
                                                <Text className="text-gray-400 italic text-sm mt-2">
                                                    Waiting for network connection to process and summarize this image...
                                                </Text>
                                            )}
                                        </ScrollView>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function StepItem({ number, text }: { number: string, text: string }) {
    return (
        <View className="flex-row items-start gap-3">
            <View className="w-6 h-6 rounded-full bg-teal-100 items-center justify-center">
                <Text className="text-teal-700 font-bold text-xs">{number}</Text>
            </View>
            <Text className="text-gray-500 text-sm flex-1 leading-5">{text}</Text>
        </View>
    );
}

const markdownStyles = StyleSheet.create({
    body: { color: '#374151', fontSize: 15, lineHeight: 22 },
    heading1: { color: '#111827', fontWeight: 'bold', fontSize: 22, marginTop: 10, marginBottom: 10 },
    heading2: { color: '#111827', fontWeight: 'bold', fontSize: 18, marginTop: 15, marginBottom: 8 },
    heading3: { color: '#111827', fontWeight: 'semibold', fontSize: 16, marginTop: 12, marginBottom: 6 },
    hr: { backgroundColor: '#E5E7EB', marginVertical: 15 },
    blockquote: { backgroundColor: '#F9FAFB', borderLeftColor: '#0D9488', borderLeftWidth: 4, paddingHorizontal: 15, paddingVertical: 10 },
    list_item: { marginBottom: 5 },
    bullet_list: { marginBottom: 15 },
});
