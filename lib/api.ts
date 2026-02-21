import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { saveOfflineAction } from "./sync";

// Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator
// Replace with your PC's local IP for physical devices
const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://192.168.29.67:8000/api/v1";

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem("lh_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (res) => res,
    async (error) => {
        if (error.response?.status === 401) {
            await AsyncStorage.removeItem("lh_token");
        }
        return Promise.reject(error);
    }
);

export default api;

// ─── Auth ───
export const authApi = {
    login: (username: string, password: string) => {
        const form = new URLSearchParams();
        form.append("username", username);
        form.append("password", password);
        return api.post("/auth/login/access-token", form.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
    },
    register: (data: { user_in: any; hospital_in?: any }) =>
        api.post("/auth/register", data),
    me: () => api.get("/auth/me"),
};

// ─── Users ───
export const usersApi = {
    me: () => api.get("/users/me"),
    list: (skip = 0, limit = 100) => api.get(`/users/?skip=${skip}&limit=${limit}`),
    updateMe: (data: any) => api.put("/users/me", data),
    uploadImage: (formData: FormData) =>
        api.post("/users/upload-image", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    searchNurses: (q: string) => api.get(`/users/search/nurses?q=${q}`),
};

// ─── Nurses ───
export const nursesApi = {
    list: (skip = 0, limit = 100) => api.get(`/nurses/?skip=${skip}&limit=${limit}`),
    search: (q: string) => api.get(`/nurses/search?q=${q}`),
    searchPotential: (q: string) => api.get(`/nurses/search-potential?q=${q}`),
    update: (id: string, data: any) => api.put(`/nurses/${id}`, data),
    delete: (id: string) => api.delete(`/nurses/${id}`),
};

// ─── Admin ───
export const adminApi = {
    dashboardStats: () => api.get("/admin/dashboard/stats"),
    createDoctor: (data: any) => api.post("/admin/doctors/create", data),
    createNurse: (data: any) => api.post("/admin/nurses/create", data),
    createPatient: (data: any) => api.post("/admin/patients/create", data),
    createMedicine: (data: any) => api.post("/admin/medicines/create", data),
    createLabTest: (data: any) => api.post("/admin/lab-tests/create", data),
    createFloor: (data: any) => api.post("/admin/floors/create", data),
    createAvailability: (data: any) => api.post("/admin/availability/create", data),
    createHospital: (data: any) => api.post("/admin/hospitals/create", data),
    registerDoctor: (data: any) => api.post("/admin/doctors/register", data),
    registerNurse: (data: any) => api.post("/admin/nurses/register", data),
    updateRole: (userId: string, role: string) => api.put(`/admin/users/${userId}/role`, null, { params: { role } }),
    createLabAssistant: (data: any) => api.post("/admin/lab-assistants/create", data),
    removeLabAssistant: (userId: string) => api.delete(`/admin/lab-assistants/${userId}`),
    listLabAssistants: (skip = 0, limit = 100) => api.get(`/admin/lab-assistants?skip=${skip}&limit=${limit}`),
};

// ─── Doctors ───
export const doctorsApi = {
    list: (skip = 0, limit = 100) => api.get(`/doctors/?skip=${skip}&limit=${limit}`),
    search: (q: string) => api.get(`/doctors/search?q=${q}`),
    getSlots: (id: string, date: string) => api.get(`/doctors/${id}/slots?date=${date}`),
    getMyPatients: (skip = 0, limit = 100) => api.get(`/doctors/me/patients?skip=${skip}&limit=${limit}`),
    getFollowupsToday: () => api.get("/doctors/me/followups/today"),
};

// ─── Patients ───
export const patientsApi = {
    list: () => api.get("/patients/"),
    get: (id: string) => api.get(`/patients/${id}`),
    create: (data: any) => api.post("/patients/", data),
    update: (id: string, data: any) => api.put(`/patients/${id}`, data),
    delete: (id: string) => api.delete(`/patients/${id}`),
    search: (q: string) => api.get(`/patients/search?q=${q}`),
    createWithAppointment: (data: any) => api.post("/patients/with-appointment", data),
    assignNurse: (id: string, nurseId: string) => api.put(`/patients/${id}/assign-nurse?nurse_id=${nurseId}`),
};

// ─── Appointments & Vitals ───
export const appointmentsApi = {
    create: (data: any) => api.post("/appointments/", data),
    list: (skip = 0, limit = 100) => api.get(`/appointments/?skip=${skip}&limit=${limit}`),
    get: (id: string) => api.get(`/appointments/${id}`),
    getMyAppointments: () => api.get("/appointments/my-appointments"),
    getForPatient: (patientId: string) => api.get(`/appointments/patient/${patientId}`),
    getForNurse: () => api.get("/appointments/nurse/assigned"),
    update: (id: string, data: any) => api.put(`/appointments/${id}`, data),
    delete: (id: string) => api.delete(`/appointments/${id}`),
    consultation: (id: string, remarks: any, severity?: string, nextFollowup?: string, status?: string) =>
        api.post(`/appointments/${id}/consultation`, remarks, { params: { severity, next_followup: nextFollowup, status } }),
    addVitals: async (appointmentId: string, data: any) => {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
            return api.post(`/appointments/${appointmentId}/vitals`, data);
        } else {
            await saveOfflineAction(`/appointments/${appointmentId}/vitals`, "POST", data);
            return Promise.resolve({ data: { ...data, created_at: new Date().toISOString(), isOffline: true } });
        }
    },
    getVitals: (id: string) => api.get(`/appointments/${id}/vitals`),
    assignNurse: (id: string, nurseId: string) => api.put(`/appointments/${id}/assign-nurse?nurse_id=${nurseId}`),
    search: (patientId: string, doctorId: string) => api.get(`/appointments/search?patient_id=${patientId}&doctor_id=${doctorId}`),
};

// ─── Events ───
export const eventsApi = {
    list: (skip = 0, limit = 100) => api.get(`/events/?skip=${skip}&limit=${limit}`),
    create: async (data: { event_name?: string; keys?: string[] }) => {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
            return api.post("/events/", data);
        } else {
            await saveOfflineAction("/events/", "POST", data);
            return Promise.resolve({ data: { ...data, _id: "temp_" + Date.now(), isOffline: true } });
        }
    },
    get: (id: string) => api.get(`/events/${id}`),
    append: async (id: string, data: any) => {
        const state = await NetInfo.fetch();
        if (state.isConnected) {
            return api.patch(`/events/${id}/append`, { data });
        } else {
            await saveOfflineAction(`/events/${id}/append`, "PATCH", { data });
            return Promise.resolve({ data: { success: true, isOffline: true } });
        }
    },
    update: (id: string, data: any) => api.put(`/events/${id}`, data),
};

// ─── Name Lookups ───
export const namesApi = {
    getPatientName: (id: string) => api.get(`/patients/${id}/name`),
    getDoctorName: (id: string) => api.get(`/doctors/${id}/name`),
};

// ─── Documents ───
export const documentsApi = {
    upload: (formData: FormData) =>
        api.post("/documents/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        }),
    getForAppointment: (appointmentId: string) => api.get(`/documents/appointment/${appointmentId}`),
    getMyDocuments: () => api.get("/documents/my-documents"),
};

// ─── AI Agent ───
export const agentApi = {
    ask: (data: { question: string }) => api.post("/agent/analyze", data),
    suggestAppointment: (data: { description: string; appointment_date?: string; patient_id?: string; hospital_id?: string }) =>
        api.post("/agent/suggest-appointment", data),
    analyze: (data: { document_url: string; question: string; appointment_id?: string }) =>
        api.post("/agent/analyze", data),
    getChatHistory: (appointmentId: string) => api.get(`/agent/appointments/${appointmentId}/chat`),
    expertCheck: (data: { check_text: string; category: string; hospital_id?: string; medication?: string[]; lab_test?: string[] }) =>
        api.post("/agent/expert-check", data),
    populateEventData: (data: { image_url: string; keys: string[] }) =>
        api.post("/agent/populate-event-data", data),
    summarizeMedicalReport: (data: { image_url: string }) =>
        api.post("/agent/summarize-medical-report", data),
};

// ─── Lab Reports ───
export const labReportsApi = {
    create: (data: any) => api.post("/lab-reports/", data),
    list: (skip = 0, limit = 100) => api.get(`/lab-reports/?skip=${skip}&limit=${limit}`),
    get: (id: string) => api.get(`/lab-reports/${id}`),
    getForPatient: (patientId: string) => api.get(`/lab-reports/patient/${patientId}`),
    getMyReports: (skip = 0, limit = 100) => api.get(`/lab-reports/my-reports?skip=${skip}&limit=${limit}`),
    update: (id: string, data: any) => api.put(`/lab-reports/${id}`, data),
    delete: (id: string) => api.delete(`/lab-reports/${id}`),
};

// ─── Hospitals ───
export const hospitalsApi = {
    list: () => api.get(`/hospitals/search?q=a`),
    register: (data: any) => api.post("/hospitals/register", data),
    search: (name: string) => api.get(`/hospitals/search?q=${name}`),
    get: (id: string) => api.get(`/hospitals/${id}`),
    searchDoctors: (hospitalId: string, query: string) => api.get(`/hospital/${hospitalId}/search?q=${query}`),
    searchDoctorsInHospital: (hospitalId: string, query: string) => api.get(`/hospitals/${hospitalId}/doctors/search?q=${query}`),
};

// ─── Availability ───
export const availabilityApi = {
    list: (skip = 0, limit = 100) => api.get(`/availability/?skip=${skip}&limit=${limit}`),
    update: (id: string, data: any) => api.put(`/availability/${id}`, data),
    delete: (id: string) => api.delete(`/availability/${id}`),
};

// ─── Inventory (Medicines) ───
export const inventoryApi = {
    list: (skip = 0, limit = 100) => api.get(`/inventory/?skip=${skip}&limit=${limit}`),
    create: (data: any) => api.post("/inventory/", data),
    update: (id: string, data: any) => api.put(`/inventory/${id}`, data),
    delete: (id: string) => api.delete(`/inventory/${id}`),
    addStock: (id: string, quantity: number) => api.patch(`/inventory/${id}/add-stock?quantity=${quantity}`),
    removeStock: (id: string, quantity: number) => api.patch(`/inventory/${id}/remove-stock?quantity=${quantity}`),
    search: (q: string) => api.get(`/inventory/search?q=${q}`),
};

// ─── Lab Tests ───
export const labTestsApi = {
    list: (skip = 0, limit = 100) => api.get(`/lab-tests/?skip=${skip}&limit=${limit}`),
    update: (id: string, data: any) => api.put(`/lab-tests/${id}`, data),
    delete: (id: string) => api.delete(`/lab-tests/${id}`),
    search: (q: string) => api.get(`/lab-tests/search?q=${q}`),
};

// ─── Floors ───
export const floorsApi = {
    list: (skip = 0, limit = 100) => api.get(`/floors/?skip=${skip}&limit=${limit}`),
};

// ─── Voice ───
export const voiceApi = {
    transcribe: (formData: FormData) => api.post("/voice/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    }),
    triggerCall: (phoneNumber: string, appointmentId?: string) =>
        api.post("/voice/trigger-call", { phone_number: phoneNumber, appointment_id: appointmentId }),
};

// ─── Search ───
export const searchApi = {
    resources: (q: string) => api.get(`/search/resources?q=${q}`),
    staffSearch: (q: string, roleFilter?: 'doctor' | 'nurse') => {
        const params = new URLSearchParams({ q });
        if (roleFilter) params.append('role_filter', roleFilter);
        return api.get(`/admin/staff/search?${params.toString()}`);
    },
    usersForStaff: (q: string) => api.get(`/search/users-for-staff?q=${q}`),
    searchPatients: (q: string) => api.get(`/search/patients?q=${q}`),
    patientSearch: (q: string) => api.get(`/patients/search?q=${q}`),
    doctorSearch: (q: string) => api.get(`/doctors/search?q=${q}`),
};
