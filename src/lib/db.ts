import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "saude-almenara-data")
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "saude-almenara.db");

declare global {
  var __saudeAlmenaraDb: DatabaseSync | undefined;
  var __saudeAlmenaraSchemaVersion: number | undefined;
}

const CURRENT_SCHEMA_VERSION = 3;

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysIso(baseIso: string, deltaDays: number): string {
  const [y, m, d] = baseIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS ubs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      zone TEXT NOT NULL CHECK(zone IN ('Urbana', 'Rural')),
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      hours TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cpf_masked TEXT NOT NULL,
      cns TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      ubs_id TEXT NOT NULL REFERENCES ubs(id),
      address TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      emergency_contact_name TEXT DEFAULT '',
      emergency_contact_phone TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cpf_digits TEXT NOT NULL UNIQUE,
      cpf_masked TEXT NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('cidadao', 'recepcao', 'gestao')),
      cns TEXT NOT NULL,
      ubs_id TEXT NOT NULL REFERENCES ubs(id),
      patient_id TEXT,
      address TEXT DEFAULT '',
      latitude REAL,
      longitude REAL,
      whatsapp TEXT DEFAULT '',
      emergency_contact_name TEXT DEFAULT '',
      emergency_contact_phone TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS medications (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      active_ingredient TEXT NOT NULL,
      dosage TEXT NOT NULL,
      ubs_id TEXT NOT NULL REFERENCES ubs(id),
      status TEXT NOT NULL CHECK(status IN ('Disponível', 'Estoque Baixo', 'Em Reposição')),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      patient_cns TEXT NOT NULL,
      patient_cpf_masked TEXT NOT NULL,
      ubs_id TEXT NOT NULL REFERENCES ubs(id),
      specialty TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Confirmado', 'Aguardando', 'Realizado', 'Faltou', 'Cancelado')),
      is_walkin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vaccines (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      vaccine_name TEXT NOT NULL,
      dose TEXT NOT NULL,
      batch TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      date_applied TEXT NOT NULL,
      ubs_name TEXT NOT NULL,
      professional TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Aplicada', 'Pendente'))
    );
  `);

  // Migração segura para bancos existentes criados antes da tabela users / vaccines
  const extraPatientCols = [
    "address TEXT DEFAULT ''",
    "whatsapp TEXT DEFAULT ''",
    "emergency_contact_name TEXT DEFAULT ''",
    "emergency_contact_phone TEXT DEFAULT ''",
    "cns_synced_at TEXT DEFAULT ''",
  ];
  for (const colDef of extraPatientCols) {
    try {
      db.exec(`ALTER TABLE patients ADD COLUMN ${colDef}`);
    } catch {
      // Coluna já existe
    }
  }
}

function seedDatabase(db: DatabaseSync): void {
  const row = db.prepare("SELECT COUNT(*) as total FROM ubs").get() as { total: number };
  if (row.total > 0) return;

  const today = getTodayIso();
  const nowIso = new Date().toISOString();

  const ubsList = [
    {
      id: "ubs-centro",
      name: "UBS Centro",
      zone: "Urbana",
      address: "Rua Governador Valadares, 410 - Centro, Almenara/MG",
      phone: "(33) 3721-1420",
      hours: "07:00 às 17:00",
    },
    {
      id: "ubs-sao-pedro",
      name: "UBS São Pedro",
      zone: "Urbana",
      address: "Av. Olindo de Miranda, 882 - São Pedro, Almenara/MG",
      phone: "(33) 3721-2190",
      hours: "07:00 às 17:00",
    },
    {
      id: "ubs-cidade-nova",
      name: "UBS Cidade Nova",
      zone: "Urbana",
      address: "Rua das Acácias, 155 - Cidade Nova, Almenara/MG",
      phone: "(33) 3721-3044",
      hours: "07:00 às 17:00",
    },
    {
      id: "ubs-vila-nova",
      name: "UBS Vila Nova",
      zone: "Urbana",
      address: "Rua Projetada B, 74 - Vila Nova, Almenara/MG",
      phone: "(33) 3721-4115",
      hours: "07:00 às 17:00",
    },
    {
      id: "ubs-pedra-grande",
      name: "UBS Rural Pedra Grande",
      zone: "Rural",
      address: "Distrito de Pedra Grande, Km 18 - Zona Rural, Almenara/MG",
      phone: "(33) 3721-9012",
      hours: "07:00 às 15:30",
    },
  ];

  const insertUbs = db.prepare(
    "INSERT INTO ubs (id, name, zone, address, phone, hours) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const u of ubsList) {
    insertUbs.run(u.id, u.name, u.zone, u.address, u.phone, u.hours);
  }

  const patients = [
    {
      id: "pat-maria",
      name: "Maria Aparecida dos Santos",
      cpf_masked: "***.456.789-**",
      cns: "700 4512 8890 3312",
      birth_date: "1962-05-14",
      ubs_id: "ubs-centro",
    },
    {
      id: "pat-jose",
      name: "José Carlos Ferreira",
      cpf_masked: "***.312.640-**",
      cns: "700 8821 4401 9920",
      birth_date: "1958-11-02",
      ubs_id: "ubs-sao-pedro",
    },
    {
      id: "pat-ana",
      name: "Ana Paula Ribeiro",
      cpf_masked: "***.908.112-**",
      cns: "702 1190 3345 7711",
      birth_date: "1991-03-22",
      ubs_id: "ubs-cidade-nova",
    },
    {
      id: "pat-antonio",
      name: "Antônio Marcos Souza",
      cpf_masked: "***.774.205-**",
      cns: "704 5532 1089 6640",
      birth_date: "1975-08-19",
      ubs_id: "ubs-vila-nova",
    },
    {
      id: "pat-sebastiao",
      name: "Sebastião Oliveira Silva",
      cpf_masked: "***.128.993-**",
      cns: "706 3301 7742 5581",
      birth_date: "1954-01-30",
      ubs_id: "ubs-pedra-grande",
    },
  ];

  const insertPatient = db.prepare(
    "INSERT INTO patients (id, name, cpf_masked, cns, birth_date, ubs_id) VALUES (?, ?, ?, ?, ?, ?)"
  );
  for (const p of patients) {
    insertPatient.run(p.id, p.name, p.cpf_masked, p.cns, p.birth_date, p.ubs_id);
  }

  // 15 REMUME primary care medications with varied stocks across Almenara's UBSs
  const medications = [
    ["med-01", "Losartana Potássica 50mg", "Losartana potássica", "50mg (Comprimido)", "ubs-centro", "Disponível"],
    ["med-02", "Metformina 850mg", "Cloridrato de metformina", "850mg (Comprimido)", "ubs-centro", "Disponível"],
    ["med-03", "Amoxicilina 500mg", "Amoxicilina tri-hidratada", "500mg (Cápsula)", "ubs-sao-pedro", "Estoque Baixo"],
    ["med-04", "Dipirona Sódica 500mg", "Dipirona monoidratada", "500mg (Comprimido)", "ubs-centro", "Disponível"],
    ["med-05", "Omeprazol 20mg", "Omeprazol", "20mg (Cápsula)", "ubs-cidade-nova", "Disponível"],
    ["med-06", "Hidroclorotiazida 25mg", "Hidroclorotiazida", "25mg (Comprimido)", "ubs-vila-nova", "Disponível"],
    ["med-07", "Sinvastatina 20mg", "Sinvastatina", "20mg (Comprimido)", "ubs-sao-pedro", "Em Reposição"],
    ["med-08", "Atenolol 50mg", "Atenolol", "50mg (Comprimido)", "ubs-pedra-grande", "Disponível"],
    ["med-09", "Ibuprofeno 600mg", "Ibuprofeno", "600mg (Comprimido)", "ubs-cidade-nova", "Estoque Baixo"],
    ["med-10", "Azitromicina 500mg", "Azitromicina di-hidratada", "500mg (Comprimido)", "ubs-vila-nova", "Em Reposição"],
    ["med-11", "Enalapril 10mg", "Maleato de enalapril", "10mg (Comprimido)", "ubs-centro", "Disponível"],
    ["med-12", "Glibenclamida 5mg", "Glibenclamida", "5mg (Comprimido)", "ubs-pedra-grande", "Estoque Baixo"],
    ["med-13", "Salbutamol 100mcg", "Sulfato de salbutamol", "100mcg/dose (Aerossol)", "ubs-sao-pedro", "Disponível"],
    ["med-14", "Paracetamol 750mg", "Paracetamol", "750mg (Comprimido)", "ubs-cidade-nova", "Disponível"],
    ["med-15", "Ácido Fólico 5mg", "Ácido fólico", "5mg (Comprimido)", "ubs-pedra-grande", "Disponível"],
  ] as const;

  const insertMed = db.prepare(
    "INSERT INTO medications (id, name, active_ingredient, dosage, ubs_id, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  for (const [id, name, ingredient, dosage, ubsId, status] of medications) {
    insertMed.run(id, name, ingredient, dosage, ubsId, status, nowIso);
  }

  // 25 historical + active appointments distributed across all 5 UBSs and 4 specialties
  // Includes Maria Aparecida dos Santos having a Pediatria/Odontologia or recent Clínico Geral?
  // Note: Give Maria Aparecida 1 active 'Confirmado' appointment for today/tomorrow in 'Clínico Geral'
  // so she can see it in "Meus Agendamentos" AND test the 15-day anti-duplicity rule right away on 'Clínico Geral'!
  const seedAppointments: Array<{
    id: string;
    patientIdx: number;
    ubsId: string;
    specialty: string;
    dayOffset: number;
    time: string;
    status: string;
    isWalkin?: number;
  }> = [
    // Today's queue (for immediate Reception demonstration)
    { id: "apt-01", patientIdx: 0, ubsId: "ubs-centro", specialty: "Clínico Geral", dayOffset: 0, time: "08:00", status: "Confirmado" },
    { id: "apt-02", patientIdx: 1, ubsId: "ubs-sao-pedro", specialty: "Clínico Geral", dayOffset: 0, time: "08:30", status: "Aguardando" },
    { id: "apt-03", patientIdx: 2, ubsId: "ubs-cidade-nova", specialty: "Enfermagem (Preventivo/Pré-natal)", dayOffset: 0, time: "09:00", status: "Confirmado" },
    { id: "apt-04", patientIdx: 3, ubsId: "ubs-vila-nova", specialty: "Odontologia", dayOffset: 0, time: "09:30", status: "Aguardando" },
    { id: "apt-05", patientIdx: 4, ubsId: "ubs-pedra-grande", specialty: "Clínico Geral", dayOffset: 0, time: "10:00", status: "Confirmado" },
    { id: "apt-06", patientIdx: 0, ubsId: "ubs-centro", specialty: "Odontologia", dayOffset: 2, time: "14:00", status: "Aguardando" },

    // Historical records in the current month across all 5 UBSs (total = 25)
    { id: "apt-07", patientIdx: 1, ubsId: "ubs-centro", specialty: "Clínico Geral", dayOffset: -1, time: "08:00", status: "Realizado" },
    { id: "apt-08", patientIdx: 2, ubsId: "ubs-centro", specialty: "Pediatria", dayOffset: -2, time: "09:00", status: "Realizado" },
    { id: "apt-09", patientIdx: 3, ubsId: "ubs-centro", specialty: "Odontologia", dayOffset: -3, time: "10:30", status: "Faltou" },
    { id: "apt-10", patientIdx: 4, ubsId: "ubs-centro", specialty: "Enfermagem (Preventivo/Pré-natal)", dayOffset: -4, time: "13:30", status: "Realizado" },

    { id: "apt-11", patientIdx: 0, ubsId: "ubs-sao-pedro", specialty: "Enfermagem (Preventivo/Pré-natal)", dayOffset: -18, time: "08:30", status: "Realizado" },
    { id: "apt-12", patientIdx: 2, ubsId: "ubs-sao-pedro", specialty: "Pediatria", dayOffset: -3, time: "09:30", status: "Realizado" },
    { id: "apt-13", patientIdx: 3, ubsId: "ubs-sao-pedro", specialty: "Clínico Geral", dayOffset: -5, time: "14:00", status: "Faltou" },
    { id: "apt-14", patientIdx: 4, ubsId: "ubs-sao-pedro", specialty: "Odontologia", dayOffset: -6, time: "15:00", status: "Realizado" },

    { id: "apt-15", patientIdx: 1, ubsId: "ubs-cidade-nova", specialty: "Clínico Geral", dayOffset: -2, time: "07:30", status: "Realizado" },
    { id: "apt-16", patientIdx: 3, ubsId: "ubs-cidade-nova", specialty: "Pediatria", dayOffset: -4, time: "10:00", status: "Faltou" },
    { id: "apt-17", patientIdx: 4, ubsId: "ubs-cidade-nova", specialty: "Odontologia", dayOffset: -7, time: "13:00", status: "Realizado" },
    { id: "apt-18", patientIdx: 2, ubsId: "ubs-cidade-nova", specialty: "Clínico Geral", dayOffset: -8, time: "15:30", status: "Realizado" },

    { id: "apt-19", patientIdx: 1, ubsId: "ubs-vila-nova", specialty: "Clínico Geral", dayOffset: -1, time: "08:00", status: "Realizado" },
    { id: "apt-20", patientIdx: 2, ubsId: "ubs-vila-nova", specialty: "Enfermagem (Preventivo/Pré-natal)", dayOffset: -5, time: "10:00", status: "Faltou" },
    { id: "apt-21", patientIdx: 3, ubsId: "ubs-vila-nova", specialty: "Pediatria", dayOffset: -6, time: "14:30", status: "Realizado" },

    { id: "apt-22", patientIdx: 4, ubsId: "ubs-pedra-grande", specialty: "Clínico Geral", dayOffset: -2, time: "08:30", status: "Realizado" },
    { id: "apt-23", patientIdx: 1, ubsId: "ubs-pedra-grande", specialty: "Odontologia", dayOffset: -4, time: "09:00", status: "Faltou" },
    { id: "apt-24", patientIdx: 2, ubsId: "ubs-pedra-grande", specialty: "Enfermagem (Preventivo/Pré-natal)", dayOffset: -7, time: "10:30", status: "Realizado" },
    { id: "apt-25", patientIdx: 3, ubsId: "ubs-pedra-grande", specialty: "Pediatria", dayOffset: -9, time: "13:30", status: "Faltou" },
  ];

  const insertApt = db.prepare(`
    INSERT INTO appointments (
      id, patient_id, patient_name, patient_cns, patient_cpf_masked,
      ubs_id, specialty, date, time, status, is_walkin, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const a of seedAppointments) {
    const pat = patients[a.patientIdx];
    insertApt.run(
      a.id,
      pat.id,
      pat.name,
      pat.cns,
      pat.cpf_masked,
      a.ubsId,
      a.specialty,
      addDaysIso(today, a.dayOffset),
      a.time,
      a.status,
      a.isWalkin ?? 0,
      nowIso
    );
  }

  const seedLogs = [
    ["log-01", "Sistema Saúde Almenara", "Sistema", "SEED_INICIAL", "Base inicial carregada: 5 UBS, 15 medicamentos REMUME e 25 agendamentos", "127.0.0.1"],
    ["log-02", "Carla Mendes (Recepção)", "Recepção / Farmácia", "ATUALIZACAO_ESTOQUE", "Amoxicilina 500mg (UBS São Pedro) marcada como Estoque Baixo", "177.84.12.45"],
    ["log-03", "Maria Aparecida dos Santos", "Cidadão (Munícipe)", "CONFIRMACAO_PRESENCA", "Presença confirmada na UBS Centro - Clínico Geral (08:00)", "189.45.201.18"],
    ["log-04", "Dr. Ricardo Almeida", "Gestão Pública", "CONSULTA_BI_TCE", "Painel de indicadores de absenteísmo e auditoria acessado", "177.84.12.10"],
  ];

  const insertLog = db.prepare(
    "INSERT INTO audit_logs (id, user_name, user_role, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  for (const [id, userName, userRole, action, details, ip] of seedLogs) {
    insertLog.run(id, userName, userRole, action, details, ip, nowIso);
  }
}

function seedUsers(db: DatabaseSync): void {
  const userRow = db.prepare("SELECT COUNT(*) as total FROM users").get() as { total: number };
  if (userRow.total > 0) return;

  const nowIso = new Date().toISOString();
  const demoUsers = [
    {
      id: "usr-cidadao-maria",
      name: "Maria Aparecida dos Santos",
      cpf_digits: "12345678900",
      cpf_masked: "***.456.789-**",
      password: "123456",
      role: "cidadao",
      cns: "700 4512 8890 3312",
      ubs_id: "ubs-centro",
      patient_id: "pat-maria",
      address: "Rua Governador Valadares, 120 - Centro, Almenara/MG",
      whatsapp: "(33) 99912-3401",
      emergency_contact_name: "João Carlos dos Santos",
      emergency_contact_phone: "(33) 99988-1122",
    },
    {
      id: "usr-recepcao-carla",
      name: "Carla Mendes (Recepção / Farmácia)",
      cpf_digits: "11122233344",
      cpf_masked: "***.222.333-**",
      password: "123456",
      role: "recepcao",
      cns: "700 0001 2233 4455",
      ubs_id: "ubs-centro",
      patient_id: null,
      address: "UBS Centro - Almenara/MG",
      whatsapp: "(33) 3721-1420",
      emergency_contact_name: "Coordenação Atenção Básica",
      emergency_contact_phone: "(33) 3721-1400",
    },
    {
      id: "usr-gestao-ricardo",
      name: "Dr. Ricardo Almeida (Secretário de Saúde)",
      cpf_digits: "99988877766",
      cpf_masked: "***.888.777-**",
      password: "123456",
      role: "gestao",
      cns: "700 0009 8877 6655",
      ubs_id: "ubs-centro",
      patient_id: null,
      address: "Secretaria Municipal de Saúde - Centro, Almenara/MG",
      whatsapp: "(33) 3721-1000",
      emergency_contact_name: "Gabinete SMS Almenara",
      emergency_contact_phone: "(33) 3721-1001",
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (
      id, name, cpf_digits, cpf_masked, password, role, cns, ubs_id,
      patient_id, address, whatsapp, emergency_contact_name, emergency_contact_phone, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const u of demoUsers) {
    insertUser.run(
      u.id,
      u.name,
      u.cpf_digits,
      u.cpf_masked,
      u.password,
      u.role,
      u.cns,
      u.ubs_id,
      u.patient_id,
      u.address,
      u.whatsapp,
      u.emergency_contact_name,
      u.emergency_contact_phone,
      nowIso
    );
  }
}

function seedVaccines(db: DatabaseSync): void {
  const row = db.prepare("SELECT COUNT(*) as total FROM vaccines").get() as { total: number };
  if (row.total > 0) return;

  const insertVac = db.prepare(`
    INSERT INTO vaccines (
      id, patient_id, vaccine_name, dose, batch, manufacturer,
      date_applied, ubs_name, professional, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedList = [
    ["vac-01", "pat-maria", "COVID-19 (XBB Bivalente)", "Reforço Anual", "RNDS-42A24", "Moderna / Fiocruz", "2026-04-12", "UBS Centro - Almenara/MG", "Enf. Juliana Costa (COREN-MG 412.890)", "Aplicada"],
    ["vac-02", "pat-maria", "Influenza (Gripe Tetravalente)", "Campanha 2026", "BUT-4291F", "Instituto Butantan", "2026-05-08", "UBS Centro - Almenara/MG", "Téc. Marcos Vinicius (COREN-MG 889.112)", "Aplicada"],
    ["vac-03", "pat-maria", "Febre Amarela (Atenuada)", "Dose Única", "BIO-4233M", "Bio-Manguinhos / Fiocruz", "2023-09-19", "Sala de Vacina Central - Almenara/MG", "Enf. Patrícia Lemos (COREN-MG 319.440)", "Aplicada"],
    ["vac-04", "pat-maria", "Dupla Adulto (dT - Difteria e Tétano)", "Reforço (10 anos)", "PNI-4277D", "Instituto Butantan", "2024-11-04", "UBS Centro - Almenara/MG", "Enf. Juliana Costa (COREN-MG 412.890)", "Aplicada"],
    ["vac-05", "pat-maria", "Hepatite B (Recombinante)", "3ª Dose / Esquema", "Aguardando aplicação", "PNI / Ministério da Saúde", "2026-12-10", "UBS Centro - Almenara/MG", "Agendar na Sala de Vacina", "Pendente"],
    ["vac-06", "pat-jose", "Influenza (Gripe Tetravalente)", "Campanha 2026", "BUT-1988F", "Instituto Butantan", "2026-05-14", "UBS São Pedro - Almenara/MG", "Téc. Marcos Vinicius (COREN-MG 889.112)", "Aplicada"],
    ["vac-07", "pat-jose", "Pneumocócica 23-Valente", "Dose Idoso (SUS)", "PNI-1922P", "Bio-Manguinhos", "2025-08-22", "UBS São Pedro - Almenara/MG", "Enf. Juliana Costa (COREN-MG 412.890)", "Aplicada"],
  ];

  for (const v of seedList) {
    insertVac.run(...v);
  }
}

export function getDb(): DatabaseSync {
  if (!globalThis.__saudeAlmenaraDb) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    globalThis.__saudeAlmenaraDb = new DatabaseSync(DB_PATH);
  }
  if (globalThis.__saudeAlmenaraSchemaVersion !== CURRENT_SCHEMA_VERSION) {
    initSchema(globalThis.__saudeAlmenaraDb);
    seedDatabase(globalThis.__saudeAlmenaraDb);
    seedUsers(globalThis.__saudeAlmenaraDb);
    seedVaccines(globalThis.__saudeAlmenaraDb);
    globalThis.__saudeAlmenaraSchemaVersion = CURRENT_SCHEMA_VERSION;
  }
  return globalThis.__saudeAlmenaraDb;
}

export function recordAuditLog(params: {
  userName: string;
  userRole: string;
  action: string;
  details: string;
  ipAddress?: string;
}): void {
  const db = getDb();
  const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const ip = params.ipAddress || "177.84.12.104";
  db.prepare(
    "INSERT INTO audit_logs (id, user_name, user_role, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    params.userName,
    params.userRole,
    params.action,
    params.details,
    ip,
    new Date().toISOString()
  );
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return "187.64.112.38";
}
