import { View, Text, ScrollView, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { appointmentsApi } from "../../lib/api";
import { Calendar, Clock, User, Search, ChevronDown, Activity } from "lucide-react-native";

type StatusTab = "started" | "in_progress" | "finished" | "admitted";

interface Appointment {
    id: string;
    date: string;
    slot: string;
    status: string;
    severity?: string;
    description?: string;
    patient?: { full_name?: string; phone?: string };
    doctor?: { full_name?: string };
    nurse?: { full_name?: string };
}

const STATUS_TABS: { key: StatusTab; label: string; color: string }[] = [
    { key: "started", label: "Started", color: "#F59E0B" },
    { key: "in_progress", label: "In Progress", color: "#3B82F6" },
    { key: "finished", label: "Finished", color: "#10B981" },
    { key: "admitted", label: "Admitted", color: "#8B5CF6" },
];

const SEVERITY_COLORS: Record<string, string> = {
    critical: "#EF4444",
    high: "#F97316",
    medium: "#EAB308",
    low: "#22C55E",
};

export default function AppointmentsScreen() {
    const { user } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<StatusTab>("started");
    const [dateFilter, setDateFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const loadAppointments = useCallback(async () => {
        try {
            setLoading(true);
            let res;
            if (user?.role === "nurse") {
                res = await appointmentsApi.getForNurse();
            } else if (user?.role === "patient") {
                res = await appointmentsApi.getMyAppointments();
            } else {
                res = await appointmentsApi.list(0, 200);
            }
            setAppointments(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error("Failed to load appointments:", e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadAppointments();
    }, [loadAppointments]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadAppointments();
        setRefreshing(false);
    }, [loadAppointments]);

    const handleStatusChange = async (apptId: string, newStatus: string) => {
        try {
            setUpdatingId(apptId);
            await appointmentsApi.update(apptId, { status: newStatus });
            setAppointments(prev => prev.map(a =>
                a.id === apptId ? { ...a, status: newStatus } : a
            ));
        } catch (e) {
            Alert.alert("Error", "Failed to update status");
        } finally {
            setUpdatingId(null);
        }
    };

    const showStatusPicker = (apptId: string, currentStatus: string) => {
        const statuses = ["started", "in_progress", "finished", "admitted"];
        const options = statuses.filter(s => s !== currentStatus);
        Alert.alert(
            "Change Status",
            `Current: ${currentStatus.replace("_", " ")}`,
            [
                ...options.map(s => ({
                    text: s.replace("_", " ").replace(/^\w/, (c: string) => c.toUpperCase()),
                    onPress: () => handleStatusChange(apptId, s),
                })),
                { text: "Cancel", style: "cancel" as const },
            ]
        );
    };

    const filtered = appointments.filter(a => {
        const matchesStatus = a.status === activeTab;
        const matchesDate = !dateFilter || a.date === dateFilter;
        const matchesSearch = !searchQuery ||
            a.patient?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.doctor?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesDate && matchesSearch;
    });

    const statusCounts = STATUS_TABS.map(tab => ({
        ...tab,
        count: appointments.filter(a => a.status === tab.key).length,
    }));

    const SeverityBadge = ({ severity }: { severity?: string }) => {
        if (!severity) return null;
        const color = SEVERITY_COLORS[severity] || "#6B7280";
        return (
            <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: color + "15" }}>
                <Text className="font-bold uppercase" style={{ color, fontSize: 10 }}>{severity}</Text>
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
            {/* Header */}
            <View className="px-5 py-3 border-b border-gray-200 bg-white" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
                <View className="flex-row items-center justify-between mb-3">
                    <View>
                        <Text className="text-gray-900 font-bold text-2xl">Appointments</Text>
                        <Text className="text-gray-400 text-xs mt-0.5">Manage patient appointments</Text>
                    </View>
                    <View className="px-3 py-1.5 rounded-full flex-row items-center gap-1.5" style={{ backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCFBF1' }}>
                        <Activity size={12} color="#0D9488" />
                        <Text className="text-xs font-medium" style={{ color: '#0D9488' }}>{appointments.length} Total</Text>
                    </View>
                </View>

                {/* Status Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                    {statusCounts.map(tab => (
                        <TouchableOpacity
                            key={tab.key}
                            onPress={() => setActiveTab(tab.key)}
                            className="mr-2 px-4 py-2 rounded-xl flex-row items-center gap-2"
                            style={activeTab === tab.key
                                ? { backgroundColor: tab.color + "15", borderWidth: 1, borderColor: tab.color + "30" }
                                : { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' }
                            }
                        >
                            <Text className="text-xs font-semibold" style={{ color: activeTab === tab.key ? tab.color : "#9CA3AF" }}>
                                {tab.label}
                            </Text>
                            <View className="rounded-full px-1.5 py-0.5 min-w-[20px] items-center" style={{ backgroundColor: activeTab === tab.key ? tab.color + "20" : '#F3F4F6' }}>
                                <Text className="font-bold" style={{ fontSize: 10, color: activeTab === tab.key ? tab.color : '#9CA3AF' }}>{tab.count}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Search + Date Filter */}
                <View className="flex-row gap-2">
                    <View className="flex-1 flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-3">
                        <Search size={14} color="#9CA3AF" />
                        <TextInput
                            className="flex-1 text-gray-900 text-sm py-2.5 px-2"
                            placeholder="Search patients, doctors..."
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                    <TouchableOpacity
                        onPress={() => {
                            if (dateFilter) {
                                setDateFilter("");
                            } else {
                                const today = new Date().toISOString().split("T")[0];
                                setDateFilter(today);
                            }
                        }}
                        className="flex-row items-center gap-1.5 px-3 rounded-xl border"
                        style={dateFilter
                            ? { backgroundColor: '#0D9488', borderColor: '#0D9488' }
                            : { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }
                        }
                    >
                        <Calendar size={14} color={dateFilter ? "white" : "#9CA3AF"} />
                        <Text className="text-xs font-medium" style={{ color: dateFilter ? '#FFFFFF' : '#9CA3AF' }}>
                            {dateFilter ? "Today" : "Date"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Appointments List */}
            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#0D9488" />
                </View>
            ) : (
                <ScrollView
                    className="flex-1 px-4 pt-4"
                    contentContainerStyle={{ paddingBottom: 20 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0D9488" />}
                >
                    {filtered.length === 0 ? (
                        <View className="items-center justify-center py-20">
                            <Calendar size={48} color="#D1D5DB" />
                            <Text className="text-gray-400 text-sm mt-4">No {activeTab.replace("_", " ")} appointments</Text>
                            <Text className="text-gray-300 text-xs mt-1">Pull down to refresh</Text>
                        </View>
                    ) : (
                        filtered.map(appt => (
                            <View
                                key={appt.id}
                                className="mb-3 bg-white border border-gray-100 rounded-2xl p-4"
                                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                            >
                                {/* Row 1: Patient + Severity */}
                                <View className="flex-row items-center justify-between mb-2">
                                    <View className="flex-row items-center gap-2 flex-1">
                                        <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: '#F0FDFA' }}>
                                            <User size={18} color="#0D9488" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>
                                                {appt.patient?.full_name || "Unknown Patient"}
                                            </Text>
                                            <Text className="text-gray-400 text-[11px]">
                                                Dr. {appt.doctor?.full_name || "Unassigned"}
                                            </Text>
                                        </View>
                                    </View>
                                    <SeverityBadge severity={appt.severity} />
                                </View>

                                {/* Row 2: Description */}
                                {appt.description && (
                                    <View className="rounded-lg px-3 py-2 mb-2" style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FEF3C7' }}>
                                        <Text className="text-xs" numberOfLines={2} style={{ color: '#92400E' }}>
                                            "{appt.description}"
                                        </Text>
                                    </View>
                                )}

                                {/* Row 3: Date/Time + Actions */}
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-row items-center gap-3">
                                        <View className="flex-row items-center gap-1">
                                            <Calendar size={12} color="#9CA3AF" />
                                            <Text className="text-gray-500 text-xs">{appt.date}</Text>
                                        </View>
                                        <View className="flex-row items-center gap-1">
                                            <Clock size={12} color="#9CA3AF" />
                                            <Text className="text-gray-500 text-xs">{appt.slot}</Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => showStatusPicker(appt.id, appt.status)}
                                        disabled={updatingId === appt.id}
                                        className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200"
                                    >
                                        {updatingId === appt.id ? (
                                            <ActivityIndicator size="small" color="#0D9488" />
                                        ) : (
                                            <>
                                                <View className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: STATUS_TABS.find(t => t.key === appt.status)?.color || "#9CA3AF" }}
                                                />
                                                <Text className="capitalize" style={{ fontSize: 11, color: '#6B7280' }}>
                                                    {appt.status?.replace("_", " ") || "started"}
                                                </Text>
                                                <ChevronDown size={10} color="#9CA3AF" />
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </ScrollView>
            )}
        </SafeAreaView>
    );
}
