import React, { useState, useRef } from "react";
import {
    View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
    Alert, Platform, Image, StyleSheet
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, Sparkles, X, FileText, Upload, RefreshCcw } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { documentsApi } from "../../lib/api";
import { fetchStream } from "../../lib/streaming";
import { askAI, isLocalModelAvailable } from "../../lib/ai";
import NetInfo from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Markdown from "react-native-markdown-display";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.29.67:8000/api/v1";

export default function AnalyzerScreen() {
    const [image, setImage] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [summary, setSummary] = useState("");
    const [status, setStatus] = useState("");
    const [isOffline, setIsOffline] = useState(false);
    const [modelAvailable, setModelAvailable] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    React.useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!state.isConnected);
        });
        checkModel();
        return () => unsubscribe();
    }, []);

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

        setAnalyzing(true);
        setSummary("");
        setStatus(isOffline ? "Analyzing locally..." : "Uploading report...");

        if (isOffline) {
            try {
                // Since local model is text-only (usually), we inform the user to ask questions instead
                // or if we had OCR we'd use it. For now, we use a custom prompt.
                setStatus("Preparing local AI model...");
                const prompt = "I have a medical report image here. I am offline, so please provide a general guide on how to read common medical reports while I wait for internet to do a full scan.";
                const response = await askAI(prompt);
                setSummary(response);
                setStatus("Complete (Local Mode)");
            } catch (err: any) {
                Alert.alert("Local AI Error", err.message);
            } finally {
                setAnalyzing(false);
            }
            return;
        }

        try {
            // 1. Upload image
            const formData = new FormData();
            formData.append("title", "report_analyzer_" + Date.now());

            if (Platform.OS === 'web') {
                const response = await fetch(image);
                const blob = await response.blob();
                formData.append("file", blob, "report.jpg");
            } else {
                formData.append("file", {
                    uri: image,
                    name: "report.jpg",
                    type: "image/jpeg",
                } as any);
            }

            const uploadRes = await documentsApi.upload(formData);
            const imageUrl = uploadRes.data.file_url;

            // 2. Start SSE Streaming
            setStatus("Analyzing with AI...");
            const token = await AsyncStorage.getItem("lh_token");

            // Using fetch for SSE as axios doesn't support streaming well in RN
            let accumulated = "";

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
                                    accumulated += data.content;
                                    setSummary(accumulated);
                                    // Auto-scroll to bottom
                                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
                                } else if (data.type === "done") {
                                    setStatus("Complete");
                                } else if (data.type === "error") {
                                    Alert.alert("AI Error", data.message);
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
        } catch (e: any) {
            Alert.alert("Analysis Failed", e?.message || "Something went wrong");
        } finally {
            setAnalyzing(false);
            if (status !== "Complete") setStatus("");
        }
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
                        <Text className="text-gray-400 text-xs text-uppercase">
                            {isOffline ? (modelAvailable ? "Local MedGemma" : "Offline") : "Powered by Gemini 1.5"}
                        </Text>
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
                                <StepItem number="2" text="AI analyzes handwriting and complex terminology." />
                                <StepItem number="3" text="Get a structured summary and recommendations." />
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
                                        <Sparkles size={18} color="white" />
                                        <Text className="text-white font-bold">Analyze Report</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>

                        {/* Analysis Content */}
                        {(analyzing || summary !== "") && (
                            <View className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                                <View className="flex-row items-center justify-between mb-6">
                                    <Text className="text-gray-900 font-bold text-lg">AI Analysis</Text>
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
                                        {status === "Complete" && (
                                            <View className="mt-6 pt-6 border-t border-gray-50 items-center">
                                                <View className="bg-blue-50 px-4 py-2 rounded-lg flex-row items-center gap-2">
                                                    <FileText size={14} color="#3B82F6" />
                                                    <Text className="text-blue-600 text-[10px] font-bold uppercase">One-time Analysis · Not Saved</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}
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
