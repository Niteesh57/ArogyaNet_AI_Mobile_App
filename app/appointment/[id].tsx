import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentsApi } from "../../lib/api";
import { ArrowLeft, Calendar, User, Phone, Activity, Heart, Thermometer, Wind, Plus, X, Save } from "lucide-react-native";
import { useState } from "react";

export default function AppointmentDetails() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const queryClient = useQueryClient();

    // Load Vitals (which includes appointment details in our adapted API or we fetch separately)
    // For now, let's assume getForNurse returns full details, but if we need specific details we might need a new get endpoint.
    // We'll use getVitals which returns the history, and maybe we can pass the appointment object via params, but params are strings.
    // Better to fetch fresh.
    // Since we don't have a direct "getAppointment" for nurse (it was list), let's rely on the list cache or fetch vitals which might return appointment info if modified backend.
    // Actually, the web app `handleSelectAppt` fetches `getVitals`.

    const { data: vitalsHistory, isLoading: loadingVitals } = useQuery({
        queryKey: ["appointment-vitals", id],
        queryFn: () => appointmentsApi.getVitals(id as string).then(r => r.data)
    });

    // We also need the appointment details (patient name, etc). 
    // We can try to get it from the "nurse-schedule" cache if available.
    const schedule = queryClient.getQueryData(["nurse-schedule"]) as any[];
    const appointment = schedule?.find(a => a.id === id);

    const [modalVisible, setModalVisible] = useState(false);
    const [form, setForm] = useState({ bp: "", pulse: "", temp: "", resp: "", spo2: "", remarks: "" });

    const mutation = useMutation({
        mutationFn: (data: any) => appointmentsApi.addVitals(id as string, data),
        onSuccess: () => {
            setModalVisible(false);
            setForm({ bp: "", pulse: "", temp: "", resp: "", spo2: "", remarks: "" });
            queryClient.invalidateQueries({ queryKey: ["appointment-vitals", id] });
            alert("Vitals logged successfully!");
        },
        onError: () => alert("Failed to log vitals")
    });

    const handleSave = () => {
        mutation.mutate({
            bp: form.bp,
            pulse: parseInt(form.pulse) || 0,
            temp: parseFloat(form.temp) || 0,
            resp: parseInt(form.resp) || 0,
            spo2: parseInt(form.spo2) || 0,
            remarks: form.remarks
        });
    };

    if (!appointment) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
                <Text>Appointment not found or loading...</Text>
                <TouchableOpacity onPress={() => router.back()} className="mt-4"><Text className="text-blue-500">Go Back</Text></TouchableOpacity>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <View className="px-4 py-3 flex-row items-center gap-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <TouchableOpacity onPress={() => router.back()} className="p-2 rounded-full bg-gray-100 dark:bg-gray-700">
                    <ArrowLeft size={20} color="#374151" />
                </TouchableOpacity>
                <Text className="text-xl font-bold text-gray-900 dark:text-white flex-1">Patient Details</Text>
            </View>

            <ScrollView className="flex-1 p-4">
                {/* Patient Info Card */}
                <View className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm mb-6">
                    <View className="flex-row justify-between items-start mb-4">
                        <View>
                            <Text className="text-2xl font-bold text-gray-900 dark:text-white">{appointment.patient?.full_name}</Text>
                            <Text className="text-gray-500 text-sm mt-1">ID: #{appointment.id.slice(0, 6).toUpperCase()}</Text>
                        </View>
                        <View className={`px-2 py-1 rounded bg-blue-100`}>
                            <Text className="text-xs font-bold text-blue-700 uppercase">{appointment.severity || "Normal"}</Text>
                        </View>
                    </View>

                    <View className="flex-row gap-4 mb-4">
                        <View className="flex-row items-center gap-2 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg flex-1">
                            <User size={16} color="#6B7280" />
                            <Text className="text-gray-700 dark:text-gray-300 font-medium">{appointment.patient?.gender || "N/A"}</Text>
                        </View>
                        <View className="flex-row items-center gap-2 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg flex-1">
                            <Calendar size={16} color="#6B7280" />
                            <Text className="text-gray-700 dark:text-gray-300 font-medium">{appointment.patient?.dob || "N/A"}</Text>
                        </View>
                    </View>

                    {appointment.description && (
                        <View className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-800/30">
                            <Text className="text-amber-800 dark:text-amber-500 text-sm font-medium">Complaint: {appointment.description}</Text>
                        </View>
                    )}
                </View>

                {/* Vitals History */}
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-lg font-bold text-gray-900 dark:text-white">Vitals History</Text>
                    <TouchableOpacity
                        onPress={() => setModalVisible(true)}
                        className="bg-blue-600 px-3 py-2 rounded-full flex-row items-center gap-1 shadow-sm shadow-blue-200"
                    >
                        <Plus size={16} color="white" />
                        <Text className="text-white font-bold text-xs">Log Vitals</Text>
                    </TouchableOpacity>
                </View>

                {loadingVitals ? (
                    <ActivityIndicator color="#3B82F6" />
                ) : vitalsHistory?.length > 0 ? (
                    <View className="gap-3 pb-10">
                        {vitalsHistory.map((v: any, i: number) => (
                            <View key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <View className="flex-row justify-between mb-3 border-b border-gray-50 dark:border-gray-700 pb-2">
                                    <Text className="text-gray-400 text-xs">{new Date(v.created_at).toLocaleString()}</Text>
                                    <Text className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 rounded text-gray-500">
                                        {v.nurse_name || "Nurse"}
                                    </Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <VitalsItem label="BP" value={v.bp} icon={<Activity size={14} color="#EF4444" />} />
                                    <VitalsItem label="HR" value={v.pulse} unit="bpm" icon={<Heart size={14} color="#3B82F6" />} />
                                    <VitalsItem label="Temp" value={v.temp} unit="°F" icon={<Thermometer size={14} color="#F97316" />} />
                                    <VitalsItem label="SpO2" value={v.spo2} unit="%" icon={<Wind size={14} color="#06B6D4" />} />
                                </View>
                                {v.remarks && <Text className="text-xs text-gray-500 mt-2 italic">"{v.remarks}"</Text>}
                            </View>
                        ))}
                    </View>
                ) : (
                    <View className="p-8 items-center justify-center border-2 border-dashed border-gray-200 rounded-xl">
                        <Text className="text-gray-400">No vitals recorded yet.</Text>
                    </View>
                )}
            </ScrollView>

            {/* Log Vitals Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-end bg-black/50">
                    <View className="bg-white dark:bg-gray-900 rounded-t-3xl p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-xl font-bold text-gray-900 dark:text-white">Record Vitals</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X size={24} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row flex-wrap gap-4 mb-4">
                            <InputBox label="BP (mmHg)" placeholder="120/80" value={form.bp} onChangeText={t => setForm({ ...form, bp: t })} width="47%" />
                            <InputBox label="Pulse (bpm)" placeholder="72" value={form.pulse} onChangeText={t => setForm({ ...form, pulse: t })} width="47%" keyboardType="numeric" />
                            <InputBox label="Temp (°F)" placeholder="98.6" value={form.temp} onChangeText={t => setForm({ ...form, temp: t })} width="47%" keyboardType="numeric" />
                            <InputBox label="SpO2 (%)" placeholder="98" value={form.spo2} onChangeText={t => setForm({ ...form, spo2: t })} width="47%" keyboardType="numeric" />
                            <InputBox label="Resp (bpm)" placeholder="16" value={form.resp} onChangeText={t => setForm({ ...form, resp: t })} width="47%" keyboardType="numeric" />
                        </View>
                        <InputBox label="Remarks" placeholder="Patient condition..." value={form.remarks} onChangeText={t => setForm({ ...form, remarks: t })} width="100%" />

                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={mutation.isPending}
                            className="bg-blue-600 p-4 rounded-xl items-center mt-4 flex-row justify-center gap-2"
                        >
                            {mutation.isPending ? <ActivityIndicator color="white" /> : (
                                <>
                                    <Save size={20} color="white" />
                                    <Text className="text-white font-bold text-lg">Save Record</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <View className="h-8" />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </SafeAreaView>
    );
}

const VitalsItem = ({ label, value, unit, icon }: any) => (
    <View className="items-center">
        <View className="flex-row items-center gap-1 mb-1">
            {icon}
            <Text className="text-xs text-gray-400">{label}</Text>
        </View>
        <Text className="font-bold text-gray-900 dark:text-white">
            {value || "--"} <Text className="text-[10px] font-normal text-gray-400">{unit}</Text>
        </Text>
    </View>
);

const InputBox = ({ label, placeholder, value, onChangeText, width, keyboardType }: any) => (
    <View style={{ width }}>
        <Text className="text-xs text-gray-500 mb-1 ml-1">{label}</Text>
        <TextInput
            className="bg-gray-100 dark:bg-gray-800 p-3 rounded-xl text-gray-900 dark:text-white"
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
        />
    </View>
);
