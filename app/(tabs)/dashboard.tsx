import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, Calendar, Clock, ChevronRight, ChevronLeft, Activity, Heart, Thermometer, Wind, Stethoscope, Users, UserCheck, Plus, Search, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { appointmentsApi, doctorsApi, namesApi } from "../../lib/api";
import { useState, useMemo, useEffect } from "react";
import type { Appointment, VitalsLog } from "../../lib/types";

/* ─── Shared Components ─── */
const SeverityBadge = ({ severity }: { severity: string }) => {
    const colors: Record<string, { bg: string; text: string }> = {
        critical: { bg: "#FEE2E2", text: "#DC2626" },
        high: { bg: "#FFEDD5", text: "#EA580C" },
        medium: { bg: "#FEF9C3", text: "#CA8A04" },
        low: { bg: "#DCFCE7", text: "#16A34A" },
    };
    const c = colors[severity] || colors.low;
    return (
        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: c.bg }}>
            <Text className="text-[10px] font-bold uppercase" style={{ color: c.text }}>{severity}</Text>
        </View>
    );
};

const StatCard = ({ label, value, color, bgColor }: { label: string; value: number; color: string; bgColor: string }) => (
    <View className="bg-white border border-gray-100 rounded-2xl p-5 flex-1" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
        <Text className="text-gray-400 text-xs font-medium uppercase tracking-wide">{label}</Text>
        <Text className="text-3xl font-bold mt-1" style={{ color }}>{value}</Text>
    </View>
);

/* ════════════════════════════════════════════════════════
   VITALS HISTORY Sub-component
   ════════════════════════════════════════════════════════ */
const VitalsHistory = ({ appointmentId }: { appointmentId?: string }) => {
    const { data: vitals, isLoading } = useQuery({
        queryKey: ["vitals", appointmentId],
        queryFn: () => appointmentsApi.getVitals(appointmentId!).then(r => r.data),
        enabled: !!appointmentId,
    });

    if (isLoading) return <ActivityIndicator size="small" color="#0D9488" style={{ marginVertical: 12 }} />;

    const list: any[] = Array.isArray(vitals) ? vitals : [];

    return (
        <View>
            <View className="flex-row items-center gap-2 mb-3">
                <Activity size={15} color="#0D9488" />
                <Text className="text-gray-900 font-semibold">Vitals History</Text>
                <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F0FDFA' }}>
                    <Text className="text-[10px] font-bold" style={{ color: '#0D9488' }}>{list.length}</Text>
                </View>
            </View>
            {list.length > 0 ? (
                <View className="gap-3">
                    {list.slice(-5).reverse().map((v: any, i: number) => (
                        <View key={i} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <View className="flex-row items-center gap-1 mb-2">
                                <Clock size={11} color="#9CA3AF" />
                                <Text className="text-gray-400 text-xs">
                                    {v.created_at ? new Date(v.created_at).toLocaleString() : `Entry ${i + 1}`}
                                </Text>
                            </View>
                            <View className="flex-row flex-wrap gap-x-5 gap-y-1.5">
                                {v.bp && (
                                    <View className="flex-row items-center gap-1">
                                        <Heart size={12} color="#EF4444" />
                                        <Text className="text-gray-400 text-[10px]">BP</Text>
                                        <Text className="text-gray-900 font-semibold text-sm">{v.bp}</Text>
                                    </View>
                                )}
                                {v.pulse && (
                                    <View className="flex-row items-center gap-1">
                                        <Activity size={12} color="#3B82F6" />
                                        <Text className="text-gray-400 text-[10px]">HR</Text>
                                        <Text className="text-gray-900 font-semibold text-sm">{v.pulse}</Text>
                                    </View>
                                )}
                                {v.temp && (
                                    <View className="flex-row items-center gap-1">
                                        <Thermometer size={12} color="#F97316" />
                                        <Text className="text-gray-400 text-[10px]">Temp</Text>
                                        <Text className="text-gray-900 font-semibold text-sm">{v.temp}°F</Text>
                                    </View>
                                )}
                                {v.spo2 && (
                                    <View className="flex-row items-center gap-1">
                                        <Wind size={12} color="#06B6D4" />
                                        <Text className="text-gray-400 text-[10px]">SpO2</Text>
                                        <Text className="text-gray-900 font-semibold text-sm">{v.spo2}%</Text>
                                    </View>
                                )}
                            </View>
                            {v.remarks ? <Text className="text-gray-400 text-xs italic mt-1.5">"{v.remarks}"</Text> : null}
                        </View>
                    ))}
                </View>
            ) : (
                <View className="bg-gray-50 rounded-xl p-4 items-center border border-dashed border-gray-200">
                    <Text className="text-gray-400 text-sm">No vitals recorded yet</Text>
                </View>
            )}
        </View>
    );
};

/* ════════════════════════════════════════════════════════
   NURSE DASHBOARD
   ════════════════════════════════════════════════════════ */
const NurseDashboard = () => {
    const router = useRouter();
    const { user } = useAuth();
    const { data: appointments, isLoading, refetch } = useQuery({
        queryKey: ["nurse-schedule"],
        queryFn: () => appointmentsApi.getForNurse().then(r => r.data)
    });
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Vitals Modal
    const [vitalsModal, setVitalsModal] = useState(false);
    const [selectedAppt, setSelectedAppt] = useState<any>(null);
    const [vitalsForm, setVitalsForm] = useState({ bp: "", pulse: "", temp: "", resp: "", spo2: "", remarks: "" });
    const [vitalsLoading, setVitalsLoading] = useState(false);

    const onRefresh = async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    };

    const filtered = (appointments || []).filter((a: any) =>
        a.patient?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddVitals = async () => {
        if (!selectedAppt) return;
        setVitalsLoading(true);
        try {
            await appointmentsApi.addVitals(selectedAppt.id, {
                bp: vitalsForm.bp,
                pulse: parseInt(vitalsForm.pulse) || 0,
                temp: parseFloat(vitalsForm.temp) || 0,
                resp: parseInt(vitalsForm.resp) || 0,
                spo2: parseInt(vitalsForm.spo2) || 0,
                remarks: vitalsForm.remarks
            });
            Alert.alert("Success", "Vitals logged successfully ✓");
            setVitalsModal(false);
            setVitalsForm({ bp: "", pulse: "", temp: "", resp: "", spo2: "", remarks: "" });
            refetch();
        } catch {
            Alert.alert("Error", "Failed to log vitals");
        } finally {
            setVitalsLoading(false);
        }
    };

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <>
            <ScrollView
                contentContainerStyle={{ paddingBottom: 30 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D9488" />}
            >
                {/* Header */}
                <View className="px-6 pt-6 pb-5 bg-white border-b border-gray-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
                    <View className="flex-row justify-between items-center mb-3">
                        <View>
                            <Text className="text-gray-400 text-sm">Nurse Station</Text>
                            <Text className="text-2xl font-bold text-gray-900">
                                {user?.full_name?.split(" ")[0] || "Nurse"}
                            </Text>
                        </View>
                        <View className="flex-row items-center gap-2">
                            <View className="px-3 py-1 rounded-full flex-row items-center gap-1" style={{ backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCFBF1' }}>
                                <Clock size={12} color="#0D9488" />
                                <Text className="text-[10px] font-medium" style={{ color: '#0D9488' }}>Day Shift</Text>
                            </View>
                            <TouchableOpacity className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center">
                                <Bell size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View className="flex-row items-center gap-2 bg-gray-50 self-start px-3 py-1 rounded-full">
                        <Calendar size={12} color="#0D9488" />
                        <Text className="text-xs" style={{ color: '#0D9488' }}>{today}</Text>
                    </View>
                </View>

                {/* Search */}
                <View className="px-6 mt-4">
                    <View className="bg-white border border-gray-200 rounded-xl flex-row items-center px-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 }}>
                        <Search size={16} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 text-gray-900 py-3 px-3 text-sm"
                            placeholder="Search patients..."
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {/* Schedule */}
                <View className="px-6 mt-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-lg font-bold text-gray-900">My Schedule</Text>
                        <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: '#F0FDFA' }}>
                            <Text className="text-xs font-bold" style={{ color: '#0D9488' }}>{filtered.length}</Text>
                        </View>
                    </View>

                    {isLoading ? (
                        <View className="py-10 items-center"><ActivityIndicator size="large" color="#0D9488" /></View>
                    ) : filtered.length > 0 ? (
                        <View className="gap-3">
                            {filtered.map((appt: any) => (
                                <TouchableOpacity
                                    key={appt.id}
                                    onPress={() => { setSelectedAppt(appt); setVitalsModal(true); }}
                                    className="bg-white border border-gray-100 p-4 rounded-2xl flex-row gap-4"
                                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                                >
                                    <View className="items-center justify-center">
                                        <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
                                            <Text className="font-bold text-lg" style={{ color: '#0D9488' }}>
                                                {appt.slot?.split(':')[0]}
                                            </Text>
                                        </View>
                                        <Text className="text-[10px] text-gray-400 mt-1">{appt.slot?.split(':')[1] || "00"}</Text>
                                    </View>

                                    <View className="flex-1 justify-center">
                                        <View className="flex-row items-center gap-2 mb-1">
                                            <Text className="text-base font-bold text-gray-900">
                                                {appt.patient?.full_name || "Unknown Patient"}
                                            </Text>
                                            <SeverityBadge severity={appt.severity || "low"} />
                                        </View>
                                        <View className="flex-row gap-3 items-center">
                                            <View className="flex-row items-center gap-1">
                                                <Clock size={11} color="#9CA3AF" />
                                                <Text className="text-xs text-gray-400">{appt.slot}</Text>
                                            </View>
                                            {appt.status === 'finished' && (
                                                <View className="px-1.5 rounded" style={{ backgroundColor: '#DCFCE7' }}>
                                                    <Text className="text-[10px] font-bold" style={{ color: '#16A34A' }}>DONE</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    <View className="justify-center">
                                        <View className="w-8 h-8 bg-gray-50 rounded-full items-center justify-center" style={{ borderWidth: 1, borderColor: '#E5E7EB' }}>
                                            <Plus size={16} color="#0D9488" />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <View className="py-10 items-center justify-center bg-white rounded-2xl border-dashed border border-gray-200">
                            <Text className="text-gray-400">No appointments assigned today.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Patient Detail + Vitals Modal */}
            <Modal visible={vitalsModal} animationType="slide" transparent>
                <View className="flex-1 bg-black/40 justify-end">
                    <View className="bg-white rounded-t-3xl" style={{ maxHeight: '92%' }}>
                        {/* Header */}
                        <View className="flex-row justify-between items-center px-6 pt-5 pb-4 border-b border-gray-100">
                            <View className="flex-1 mr-4">
                                <Text className="text-xs text-gray-400 uppercase tracking-wide">Appointment Details</Text>
                                <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
                                    {selectedAppt?.patient?.full_name || "Patient"}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setVitalsModal(false)} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                <X size={18} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                            {/* Patient Info Card */}
                            {selectedAppt && (
                                <View className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
                                    <View className="flex-row flex-wrap gap-x-8 gap-y-2">
                                        <View>
                                            <Text className="text-gray-400 text-[10px] font-semibold uppercase">Date / Slot</Text>
                                            <Text className="text-gray-900 font-medium text-sm">{selectedAppt.date} @ {selectedAppt.slot}</Text>
                                        </View>
                                        <View>
                                            <Text className="text-gray-400 text-[10px] font-semibold uppercase">Status</Text>
                                            <Text className="text-gray-900 font-medium text-sm capitalize">{selectedAppt.status || "N/A"}</Text>
                                        </View>
                                        {selectedAppt.patient?.phone && (
                                            <View>
                                                <Text className="text-gray-400 text-[10px] font-semibold uppercase">Phone</Text>
                                                <Text className="text-gray-900 font-medium text-sm">{selectedAppt.patient.phone}</Text>
                                            </View>
                                        )}
                                    </View>
                                    {selectedAppt.description && (
                                        <View className="mt-3 pt-3 border-t border-gray-200">
                                            <Text className="text-gray-400 text-[10px] font-semibold uppercase mb-1">Complaint</Text>
                                            <View className="bg-yellow-50 border-l-4 border-yellow-400 px-3 py-2 rounded-r-lg">
                                                <Text className="text-gray-700 text-sm italic">"{selectedAppt.description}"</Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Vitals History from /appointments/{id}/vitals */}
                            <VitalsHistory appointmentId={selectedAppt?.id} />

                            {/* Record Vitals Form */}
                            <View className="mt-5 border-t border-gray-100 pt-5">
                                <Text className="text-gray-900 font-semibold mb-4">+ Record New Vitals</Text>
                                {[
                                    { label: "Blood Pressure (mmHg)", placeholder: "120/80", key: "bp", icon: Heart, color: "#EF4444" },
                                    { label: "Heart Rate (bpm)", placeholder: "72", key: "pulse", icon: Activity, color: "#3B82F6" },
                                    { label: "Temperature (°F)", placeholder: "98.6", key: "temp", icon: Thermometer, color: "#F97316" },
                                    { label: "SpO2 (%)", placeholder: "98", key: "spo2", icon: Wind, color: "#06B6D4" },
                                    { label: "Respiration (bpm)", placeholder: "16", key: "resp", icon: Activity, color: "#8B5CF6" },
                                ].map(field => (
                                    <View key={field.key} className="mb-3">
                                        <View className="flex-row items-center gap-2 mb-1">
                                            <field.icon size={14} color={field.color} />
                                            <Text className="text-gray-500 text-xs font-medium">{field.label}</Text>
                                        </View>
                                        <TextInput
                                            className="bg-gray-50 border border-gray-200 rounded-xl text-gray-900 px-4 py-3"
                                            placeholder={field.placeholder}
                                            placeholderTextColor="#9CA3AF"
                                            value={(vitalsForm as any)[field.key]}
                                            onChangeText={(v) => setVitalsForm(p => ({ ...p, [field.key]: v }))}
                                            keyboardType={field.key === "bp" ? "default" : "numeric"}
                                        />
                                    </View>
                                ))}
                                <View className="mb-3">
                                    <Text className="text-gray-500 text-xs font-medium mb-1">Remarks</Text>
                                    <TextInput
                                        className="bg-gray-50 border border-gray-200 rounded-xl text-gray-900 px-4 py-3"
                                        placeholder="Patient resting comfortably..."
                                        placeholderTextColor="#9CA3AF"
                                        value={vitalsForm.remarks}
                                        onChangeText={(v) => setVitalsForm(p => ({ ...p, remarks: v }))}
                                        multiline
                                        style={{ minHeight: 70, textAlignVertical: 'top' }}
                                    />
                                </View>
                            </View>

                            <View className="flex-row gap-3">
                                <TouchableOpacity onPress={() => setVitalsModal(false)} className="flex-1 bg-gray-100 rounded-xl py-3.5 items-center">
                                    <Text className="text-gray-500 font-medium">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleAddVitals} disabled={vitalsLoading} className="flex-1 rounded-xl py-3.5 items-center" style={{ backgroundColor: '#0D9488' }}>
                                    {vitalsLoading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Record Vitals</Text>}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
};

/* ════════════════════════════════════════════════════════
   DOCTOR DASHBOARD
   ════════════════════════════════════════════════════════ */
const DoctorDashboard = () => {
    const { user } = useAuth();
    const router = useRouter();

    const { data: allAppointments, isLoading, refetch } = useQuery({
        queryKey: ["doctor-appointments"],
        queryFn: async () => {
            const docRes = await doctorsApi.list();
            const myDoc = docRes.data.find((d: any) => d.user_id === user?.id);
            if (!myDoc) return [];
            const apptRes = await appointmentsApi.list();
            return apptRes.data.filter((a: any) => a.doctor_id === myDoc.id);
        }
    });
    const { data: myPatients } = useQuery({
        queryKey: ["doctor-patients"],
        queryFn: () => doctorsApi.getMyPatients().then(r => r.data).catch(() => [])
    });
    const { data: followups } = useQuery({
        queryKey: ["doctor-followups"],
        queryFn: () => doctorsApi.getFollowupsToday().then(r => r.data).catch(() => [])
    });

    const [nameCache, setNameCache] = useState<Record<string, string>>({});
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeTab, setActiveTab] = useState<"calendar" | "patients">("calendar");

    const appointments = allAppointments || [];
    const todayStr = new Date().toISOString().split("T")[0];

    useEffect(() => {
        const ids = [...new Set(appointments.map((a: any) => a.patient_id))] as string[];
        ids.forEach(async (pid) => {
            if (nameCache[pid]) return;
            try {
                const res = await namesApi.getPatientName(pid);
                setNameCache(prev => ({ ...prev, [pid]: res.data.full_name }));
            } catch { }
        });
    }, [appointments]);

    const apptsByDate = useMemo(() => {
        const map: Record<string, any[]> = {};
        appointments.forEach((a: any) => {
            if (!map[a.date]) map[a.date] = [];
            map[a.date].push(a);
        });
        return map;
    }, [appointments]);

    const todayAppts = apptsByDate[todayStr] || [];
    const selectedAppts = apptsByDate[selectedDate] || [];
    const upcomingCount = appointments.filter((a: any) => a.date >= todayStr).length;

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const monthStr = currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

    return (
        <ScrollView
            contentContainerStyle={{ paddingBottom: 30 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D9488" />}
        >
            {/* Header */}
            <View className="px-6 pt-6 pb-5 bg-white border-b border-gray-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
                <Text className="text-gray-400 text-sm">Dashboard</Text>
                <Text className="text-2xl font-bold text-gray-900">Dr. {user?.full_name?.split(" ")[0] || "Doctor"}</Text>
                <View className="flex-row items-center gap-2 mt-2 bg-gray-50 self-start px-3 py-1 rounded-full">
                    <Calendar size={12} color="#0D9488" />
                    <Text className="text-xs" style={{ color: '#0D9488' }}>
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                </View>
            </View>

            {/* Stats */}
            <View className="px-6 mt-5">
                <View className="flex-row gap-3">
                    <StatCard label="Today" value={todayAppts.length} color="#0D9488" bgColor="#F0FDFA" />
                    <StatCard label="Upcoming" value={upcomingCount} color="#10B981" bgColor="#ECFDF5" />
                </View>
                <View className="flex-row gap-3 mt-3">
                    <StatCard label="Patients" value={new Set(todayAppts.map((a: any) => a.patient_id)).size} color="#8B5CF6" bgColor="#F5F3FF" />
                    <StatCard label="Follow-ups" value={(followups || []).length} color="#F97316" bgColor="#FFF7ED" />
                </View>
            </View>

            {/* Tab Switcher */}
            <View className="px-6 mt-5">
                <View className="flex-row bg-gray-100 rounded-xl p-1">
                    <TouchableOpacity
                        onPress={() => setActiveTab("calendar")}
                        className={`flex-1 py-2 rounded-lg items-center flex-row justify-center gap-2`}
                        style={activeTab === "calendar" ? { backgroundColor: '#0D9488' } : undefined}
                    >
                        <Calendar size={14} color={activeTab === "calendar" ? "white" : "#9CA3AF"} />
                        <Text className={`text-sm font-medium ${activeTab === "calendar" ? "text-white" : "text-gray-400"}`}>Calendar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab("patients")}
                        className={`flex-1 py-2 rounded-lg items-center flex-row justify-center gap-2`}
                        style={activeTab === "patients" ? { backgroundColor: '#0D9488' } : undefined}
                    >
                        <Users size={14} color={activeTab === "patients" ? "white" : "#9CA3AF"} />
                        <Text className={`text-sm font-medium ${activeTab === "patients" ? "text-white" : "text-gray-400"}`}>Patients</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {isLoading ? (
                <View className="py-10 items-center"><ActivityIndicator size="large" color="#0D9488" /></View>
            ) : activeTab === "calendar" ? (
                <View className="px-6 mt-4">
                    {/* Calendar */}
                    <View className="bg-white border border-gray-100 rounded-2xl overflow-hidden" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
                        <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
                            <TouchableOpacity onPress={() => setCurrentDate(new Date(year, month - 1, 1))}>
                                <ChevronLeft size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                            <Text className="text-gray-900 font-semibold">{monthStr}</Text>
                            <TouchableOpacity onPress={() => setCurrentDate(new Date(year, month + 1, 1))}>
                                <ChevronRight size={20} color="#9CA3AF" />
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row">
                            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                <View key={i} className="flex-1 py-2 items-center">
                                    <Text className="text-gray-400 text-xs font-medium">{d}</Text>
                                </View>
                            ))}
                        </View>

                        <View className="flex-row flex-wrap">
                            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                                <View key={`e-${i}`} className="w-[14.28%] h-12" />
                            ))}
                            {Array.from({ length: daysInMonth }).map((_, i) => {
                                const day = i + 1;
                                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                                const dayAppts = apptsByDate[dateStr] || [];
                                const isToday = dateStr === todayStr;
                                const isSelected = dateStr === selectedDate;
                                return (
                                    <TouchableOpacity
                                        key={day}
                                        onPress={() => setSelectedDate(dateStr)}
                                        className={`w-[14.28%] h-12 items-center justify-center`}
                                        style={isSelected ? { backgroundColor: '#F0FDFA' } : undefined}
                                    >
                                        <Text className={`text-sm ${isToday ? "font-bold" : isSelected ? "font-semibold text-gray-900" : "text-gray-600"}`}
                                            style={isToday ? { color: '#0D9488' } : undefined}
                                        >
                                            {day}
                                        </Text>
                                        {dayAppts.length > 0 && (
                                            <View className="flex-row gap-0.5 mt-0.5">
                                                {dayAppts.slice(0, 3).map((_: any, j: number) => (
                                                    <View key={j} className="w-1 h-1 rounded-full" style={{ backgroundColor: '#0D9488' }} />
                                                ))}
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Selected Day Details */}
                    <View className="mt-4">
                        <Text className="text-gray-900 font-semibold text-base mb-3">
                            {selectedDate === todayStr
                                ? "Today's Schedule"
                                : new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                            {" "}({selectedAppts.length})
                        </Text>
                        {selectedAppts.length > 0 ? (
                            <View className="gap-3">
                                {selectedAppts.sort((a: any, b: any) => a.slot.localeCompare(b.slot)).map((apt: any) => (
                                    <View key={apt.id} className="bg-white border border-gray-100 rounded-2xl p-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                                        <View className="flex-row items-center justify-between mb-2">
                                            <View className="flex-row items-center gap-2">
                                                <Clock size={14} color="#0D9488" />
                                                <Text className="text-gray-900 font-semibold text-sm">{apt.slot}</Text>
                                            </View>
                                            <SeverityBadge severity={apt.severity} />
                                        </View>
                                        <Text className="text-gray-700 font-medium ml-6">
                                            {nameCache[apt.patient_id] || "Loading..."}
                                        </Text>
                                        {apt.description && (
                                            <Text className="text-gray-400 text-xs ml-6 mt-1" numberOfLines={2}>{apt.description}</Text>
                                        )}
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View className="bg-white rounded-2xl p-8 items-center border border-dashed border-gray-200">
                                <Calendar size={24} color="#D1D5DB" />
                                <Text className="text-gray-400 text-sm mt-2">No appointments</Text>
                            </View>
                        )}
                    </View>
                </View>
            ) : (
                /* Patients Tab */
                <View className="px-6 mt-4">
                    <Text className="text-gray-900 font-semibold text-base mb-3">
                        My Patients ({(myPatients || []).length})
                    </Text>
                    {(myPatients || []).length > 0 ? (
                        <View className="gap-3">
                            {(myPatients || []).map((p: any) => (
                                <View key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex-row items-center gap-3" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}>
                                    <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#F5F3FF' }}>
                                        <Users size={18} color="#8B5CF6" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-medium">{p.full_name}</Text>
                                        <Text className="text-gray-400 text-xs">
                                            {p.age ? `Age: ${p.age}` : ""}{p.gender ? ` · ${p.gender}` : ""}{p.phone ? ` · ${p.phone}` : ""}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View className="bg-white rounded-2xl p-8 items-center border border-dashed border-gray-200">
                            <Users size={24} color="#D1D5DB" />
                            <Text className="text-gray-400 text-sm mt-2">No patients yet</Text>
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

/* ════════════════════════════════════════════════════════
   PATIENT DASHBOARD
   ════════════════════════════════════════════════════════ */
const PatientDashboard = () => {
    const { user } = useAuth();
    const router = useRouter();

    const { data: myAppointments, isLoading, refetch } = useQuery({
        queryKey: ["patient-appointments"],
        queryFn: () => appointmentsApi.getMyAppointments().then(r => r.data).catch(() => [])
    });
    const [refreshing, setRefreshing] = useState(false);

    const appointments = myAppointments || [];
    const upcoming = appointments.filter((a: any) => new Date(a.date) >= new Date(new Date().toDateString()));
    const doctorsSeen = new Set(appointments.map((a: any) => a.doctor_id)).size;

    const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

    const handleDelete = async (id: string) => {
        Alert.alert("Cancel Appointment", "Are you sure?", [
            { text: "No", style: "cancel" },
            {
                text: "Yes", style: "destructive", onPress: async () => {
                    try {
                        await appointmentsApi.delete(id);
                        refetch();
                    } catch {
                        Alert.alert("Error", "Failed to cancel appointment");
                    }
                }
            }
        ]);
    };

    return (
        <ScrollView
            contentContainerStyle={{ paddingBottom: 30 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D9488" />}
        >
            {/* Header */}
            <View className="px-6 pt-6 pb-5 bg-white border-b border-gray-100" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
                <Text className="text-gray-400 text-sm">Dashboard</Text>
                <Text className="text-2xl font-bold text-gray-900">
                    Welcome, {user?.full_name?.split(" ")[0] || "Patient"}
                </Text>
                <View className="flex-row items-center gap-2 mt-2 bg-gray-50 self-start px-3 py-1 rounded-full">
                    <Calendar size={12} color="#0D9488" />
                    <Text className="text-xs" style={{ color: '#0D9488' }}>
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    </Text>
                </View>
            </View>

            {/* Stats */}
            <View className="px-6 mt-5">
                <View className="flex-row gap-3">
                    <StatCard label="Upcoming" value={upcoming.length} color="#0D9488" bgColor="#F0FDFA" />
                    <StatCard label="Total Visits" value={appointments.length} color="#10B981" bgColor="#ECFDF5" />
                </View>
                <View className="flex-row gap-3 mt-3">
                    <StatCard label="Doctors Seen" value={doctorsSeen} color="#8B5CF6" bgColor="#F5F3FF" />
                    <View className="flex-1" />
                </View>
            </View>

            {/* My Appointments */}
            <View className="px-6 mt-6">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-lg font-bold text-gray-900">My Appointments</Text>
                </View>

                {isLoading ? (
                    <View className="py-10 items-center"><ActivityIndicator size="large" color="#0D9488" /></View>
                ) : appointments.length > 0 ? (
                    <View className="gap-3">
                        {appointments.map((apt: any) => {
                            const isPast = new Date(apt.date) < new Date(new Date().toDateString());
                            return (
                                <View
                                    key={apt.id}
                                    className={`bg-white border border-gray-100 rounded-2xl p-4 ${isPast ? "opacity-50" : ""}`}
                                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 }}
                                >
                                    <View className="flex-row items-start gap-3">
                                        <View className="p-3 rounded-2xl" style={{
                                            backgroundColor: apt.severity === "critical" ? "#FEE2E2" :
                                                apt.severity === "high" ? "#FFEDD5" : "#F0FDFA"
                                        }}>
                                            <Calendar size={20} color={apt.severity === "critical" ? "#EF4444" :
                                                apt.severity === "high" ? "#F97316" : "#0D9488"} />
                                        </View>
                                        <View className="flex-1">
                                            <View className="flex-row items-center gap-2 flex-wrap">
                                                <Text className="text-gray-900 font-semibold">{apt.doctor_name || "Doctor"}</Text>
                                                {apt.doctor_specialization && (
                                                    <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                                                        <Text className="text-gray-500 text-[10px]">{apt.doctor_specialization}</Text>
                                                    </View>
                                                )}
                                                <SeverityBadge severity={apt.severity} />
                                            </View>
                                            <View className="flex-row items-center gap-1 mt-1">
                                                <Clock size={12} color="#9CA3AF" />
                                                <Text className="text-gray-400 text-xs">
                                                    {new Date(apt.date).toLocaleDateString()} at {apt.slot}
                                                </Text>
                                            </View>
                                            {apt.description && (
                                                <Text className="text-gray-400 text-xs mt-1" numberOfLines={2}>{apt.description}</Text>
                                            )}
                                        </View>
                                    </View>

                                    {!isPast && (
                                        <View className="flex-row gap-2 mt-3 ml-14">
                                            <TouchableOpacity
                                                onPress={() => handleDelete(apt.id)}
                                                className="px-3 py-1.5 rounded-lg"
                                                style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA' }}
                                            >
                                                <Text className="text-xs font-medium" style={{ color: '#DC2626' }}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                ) : (
                    <View className="bg-white rounded-2xl p-10 items-center border border-dashed border-gray-200">
                        <Calendar size={32} color="#D1D5DB" />
                        <Text className="text-gray-700 font-medium text-base mt-3">No Appointments</Text>
                        <Text className="text-gray-400 text-sm mt-1 text-center">You don't have any appointments scheduled.</Text>
                    </View>
                )}
            </View>
        </ScrollView>
    );
};

/* ════════════════════════════════════════════════════════
   MAIN DASHBOARD — Role Router
   ════════════════════════════════════════════════════════ */
export default function Dashboard() {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-slate-50 items-center justify-center">
                <ActivityIndicator size="large" color="#0D9488" />
            </SafeAreaView>
        );
    }

    const role = user?.role;

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {role === "nurse" ? <NurseDashboard /> :
                role === "doctor" ? <DoctorDashboard /> :
                    role === "patient" ? <PatientDashboard /> :
                        <PatientDashboard />}
        </SafeAreaView>
    );
}
