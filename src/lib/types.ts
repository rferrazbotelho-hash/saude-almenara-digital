export type UserRole = "cidadao" | "recepcao" | "gestao";

export type UbsZone = "Urbana" | "Rural";

export interface UbsUnit {
  id: string;
  name: string;
  zone: UbsZone;
  address: string;
  phone: string;
  hours: string;
}

export type Specialty =
  | "Clínico Geral"
  | "Odontologia"
  | "Enfermagem (Preventivo/Pré-natal)"
  | "Pediatria";

export const SPECIALTIES: Specialty[] = [
  "Clínico Geral",
  "Odontologia",
  "Enfermagem (Preventivo/Pré-natal)",
  "Pediatria",
];

export type AppointmentStatus =
  | "Confirmado"
  | "Aguardando"
  | "Realizado"
  | "Faltou"
  | "Cancelado";

export interface Patient {
  id: string;
  name: string;
  cpf_masked: string;
  cns: string;
  birth_date: string;
  ubs_id: string;
  address?: string;
  whatsapp?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  cns_synced_at?: string;
}

export interface VaccineRecord {
  id: string;
  patient_id: string;
  vaccine_name: string;
  dose: string;
  batch: string;
  manufacturer: string;
  date_applied: string;
  ubs_name: string;
  professional: string;
  status: "Aplicada" | "Pendente";
}

export interface AuthUser {
  id: string;
  name: string;
  cpf_masked: string;
  role: UserRole;
  cns: string;
  ubs_id: string;
  patient_id?: string;
  address?: string;
  whatsapp?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_cns: string;
  patient_cpf_masked: string;
  ubs_id: string;
  ubs_name?: string;
  ubs_zone?: UbsZone;
  specialty: Specialty;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: AppointmentStatus;
  is_walkin: number;
  created_at: string;
}

export type MedicationStatus = "Disponível" | "Estoque Baixo" | "Em Reposição";

export interface Medication {
  id: string;
  name: string;
  active_ingredient: string;
  dosage: string;
  ubs_id: string;
  ubs_name?: string;
  status: MedicationStatus;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_name: string;
  user_role: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface BiStats {
  kpis: {
    totalMonth: number;
    attendanceRate: number;
    absenteeismRate: number;
    repressedDemand: number;
    realizedCount: number;
    missedCount: number;
  };
  byUbs: Array<{
    ubsId: string;
    name: string;
    shortName: string;
    zone: UbsZone;
    realizados: number;
    faltas: number;
    confirmados: number;
    aguardando: number;
    total: number;
    attendanceRate: number;
  }>;
  bySpecialty: Array<{
    name: string;
    value: number;
  }>;
  auditLogs: AuditLog[];
}

export const TIME_SLOTS = [
  "07:30",
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
];
