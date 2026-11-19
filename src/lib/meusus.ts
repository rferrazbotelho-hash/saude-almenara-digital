export interface MeuSusVaccinePayload {
  vaccine_name: string;
  dose: string;
  batch: string;
  manufacturer: string;
  date_applied: string;
  ubs_name: string;
  professional: string;
  status: "Aplicada" | "Pendente";
}

export function deriveCnsFromCpf(cpfDigits: string): string {
  let hash = 0;
  for (let i = 0; i < cpfDigits.length; i++) {
    hash = (hash * 31 + cpfDigits.charCodeAt(i)) % 1000000000;
  }
  const suffix = String(hash).padStart(9, "4") + cpfDigits.slice(0, 3);
  const full = ("700" + suffix).slice(0, 15);
  return `${full.slice(0, 3)} ${full.slice(3, 7)} ${full.slice(7, 11)} ${full.slice(11, 15)}`;
}

export function buildMeuSusVaccines(
  cpfDigits: string,
  ubsName = "UBS Centro - Almenara/MG"
): MeuSusVaccinePayload[] {
  const seedNum = parseInt(cpfDigits.slice(-3) || "101", 10);
  const lotSuffix = String((seedNum % 89) + 10);

  return [
    {
      vaccine_name: "COVID-19 (XBB Bivalente)",
      dose: "Reforço Anual",
      batch: `RNDS-${lotSuffix}A24`,
      manufacturer: "Moderna / Fiocruz",
      date_applied: "2026-04-12",
      ubs_name: ubsName,
      professional: "Enf. Juliana Costa (COREN-MG 412.890)",
      status: "Aplicada",
    },
    {
      vaccine_name: "Influenza (Gripe Tetravalente)",
      dose: "Campanha 2026",
      batch: `BUT-${lotSuffix}91F`,
      manufacturer: "Instituto Butantan",
      date_applied: "2026-05-08",
      ubs_name: ubsName,
      professional: "Téc. Marcos Vinicius (COREN-MG 889.112)",
      status: "Aplicada",
    },
    {
      vaccine_name: "Febre Amarela (Atenuada)",
      dose: "Dose Única",
      batch: `BIO-${lotSuffix}33M`,
      manufacturer: "Bio-Manguinhos / Fiocruz",
      date_applied: "2023-09-19",
      ubs_name: "Sala de Vacina Central - Almenara/MG",
      professional: "Enf. Patrícia Lemos (COREN-MG 319.440)",
      status: "Aplicada",
    },
    {
      vaccine_name: "Dupla Adulto (dT - Difteria e Tétano)",
      dose: "Reforço (10 anos)",
      batch: `PNI-${lotSuffix}77D`,
      manufacturer: "Instituto Butantan",
      date_applied: "2024-11-04",
      ubs_name: ubsName,
      professional: "Enf. Juliana Costa (COREN-MG 412.890)",
      status: "Aplicada",
    },
    {
      vaccine_name: "Hepatite B (Recombinante)",
      dose: "3ª Dose / Esquema",
      batch: "Aguardando aplicação",
      manufacturer: "PNI / Ministério da Saúde",
      date_applied: "2026-12-10",
      ubs_name: ubsName,
      professional: "Agendar na Sala de Vacina",
      status: "Pendente",
    },
  ];
}
