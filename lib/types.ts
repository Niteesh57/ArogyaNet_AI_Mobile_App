export interface Event {
    id: string;
    event_name: string;
    keys: string[];
    json_data?: any[];
    description?: string;
    created_at?: string;
    updated_at?: string;
}


export interface User {
    id: string;
    email: string;
    full_name?: string;
    role: "super_admin" | "hospital_admin" | "doctor" | "nurse" | "patient" | "lab_assistant" | "base" | "user";
    phone_number?: string;
    image?: string;
    hospital_id?: string;
    lang?: string;
}

export interface Appointment {
    id: string;
    patient_id: string;
    doctor_id: string;
    nurse_id?: string;
    description?: string;
    date: string;
    slot: string;
    status?: string;
    severity: "low" | "medium" | "high" | "critical";
    remarks?: { text?: string; lab?: any[]; medicine?: any[] };
    next_followup?: string;
    doctor_name?: string;
    doctor_specialization?: string;
    hospital_name?: string;
    patient?: { full_name?: string; phone?: string; dob?: string; gender?: string };
    doctor?: { full_name?: string };
    created_at?: string;
    updated_at?: string;
}

export interface VitalsLog {
    created_at: string;
    bp: string;
    pulse: number;
    temp: number;
    resp: number;
    spo2: number;
    nurse_name?: string;
    remarks?: string;
}

export interface Patient {
    id: string;
    full_name: string;
    email?: string;
    phone?: string;
    age?: number;
    gender?: string;
    dob?: string;
    address?: string;
}

export interface Doctor {
    id: string;
    user_id: string;
    full_name?: string;
    specialization?: string;
    hospital_id?: string;
}

export interface Stats {
    total_doctors?: number;
    total_nurses?: number;
    total_patients?: number;
    total_medicines?: number;
    low_stock_alerts?: number;
    total_lab_tests?: number;
}

export interface LabReport {
    id: string;
    patient_id: string;
    test_name: string;
    result?: string;
    status?: string;
    created_at?: string;
}

export interface Document {
    id: string;
    title: string;
    file_url: string;
    appointment_id?: string;
    created_at?: string;
}
