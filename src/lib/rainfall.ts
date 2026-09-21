import Papa from "papaparse";

export type ImpactKey = "none" | "low" | "moderate" | "high" | "severe";

export interface MonthRow {
  estacao: string;
  nivelConsistencia: string;
  tipoMedicao: string;
  date: Date;          // primeiro dia do mês
  year: number;
  month: number;       // 1-12
  days: (number | null)[]; // 31 posições (índice 0 = dia 1)
  rainyDays: number;   // dias com > 0
  totalRain: number;
}

export interface ParsedFile {
  header: {
    estacaoCodigo: string;
    nivelConsistencia: string;
    tipoMedicaoChuvas: string;
  };
  rows: MonthRow[];
}

export type HistoryPeriodUnit = "years" | "months";

export interface HistoryPeriod {
  unit: HistoryPeriodUnit;
  value: number;
}

const parseNum = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/"/g, "").replace(",", ".");
  if (s === "" || s === "-") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const parseDateBR = (s: string): Date | null => {
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
};

export async function parseCsvFile(file: File): Promise<ParsedFile> {
  const buf = await file.arrayBuffer();
  // tenta latin1 primeiro (padrão ANA), fallback utf-8
  let text: string;
  try {
    text = new TextDecoder("windows-1252").decode(buf);
  } catch {
    text = new TextDecoder("utf-8").decode(buf);
  }
  const lines = text.split(/\r?\n/);

  // Header da consulta antes da linha 15
  const headerBlock = lines.slice(0, 14).join("\n");
  const estCodMatch = headerBlock.match(/Código da Estação:\s*(\S+)/i);

  // A partir da linha 15 (índice 14) está o cabeçalho da tabela
  const tableText = lines.slice(14).join("\n");

  const result = Papa.parse<Record<string, string>>(tableText, {
    delimiter: ";",
    header: true,
    skipEmptyLines: true,
    quoteChar: '"',
  });

  const rows: MonthRow[] = [];
  let estacao = estCodMatch?.[1] ?? "";
  let nivel = "";
  let tipo = "";

  for (const r of result.data) {
    const data = r["Data"];
    if (!data) continue;
    const date = parseDateBR(data);
    if (!date) continue;

    const days: (number | null)[] = [];
    for (let d = 1; d <= 31; d++) {
      const key = `Chuva${String(d).padStart(2, "0")}`;
      days.push(parseNum(r[key]));
    }

    const validDays = days.filter((v): v is number => v !== null);
    const rainyDays = validDays.filter((v) => v > 0).length;
    const totalRain = validDays.reduce((a, b) => a + b, 0);

    estacao = estacao || r["EstacaoCodigo"] || "";
    nivel = r["NivelConsistencia"] || nivel;
    tipo = r["TipoMedicaoChuvas"] || tipo;

    rows.push({
      estacao: r["EstacaoCodigo"] || estacao,
      nivelConsistencia: r["NivelConsistencia"] || "",
      tipoMedicao: r["TipoMedicaoChuvas"] || "",
      date,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      days,
      rainyDays,
      totalRain,
    });
  }

  // Ordena cronologicamente
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    header: {
      estacaoCodigo: estacao,
      nivelConsistencia: nivel,
      tipoMedicaoChuvas: tipo,
    },
    rows,
  };
}

// Limita histórico aos últimos N anos usando a data atual como referência.
export function getHistoryStartDate(referenceDate: Date, period: HistoryPeriod): Date {
  const value = Math.max(1, Math.round(period.value));
  if (period.unit === "years") {
    return new Date(referenceDate.getFullYear() - value, referenceDate.getMonth(), 1);
  }

  return new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (value - 1), 1);
}

export function formatHistoryPeriodLabel(period: HistoryPeriod): string {
  const value = Math.max(1, Math.round(period.value));
  if (period.unit === "months") {
    return `${value} ${value === 1 ? "mês" : "meses"}`;
  }

  return `${value} ${value === 1 ? "ano" : "anos"}`;
}

export function filterByHistory(rows: MonthRow[], period: HistoryPeriod, referenceDate = new Date()): MonthRow[] {
  if (rows.length === 0) return rows;
  const cutoff = getHistoryStartDate(referenceDate, period);
  const currentMonthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  return rows.filter((r) => r.date >= cutoff && r.date <= currentMonthStart);
}

// Compatibilidade com código e testes existentes.
export function filterByYears(rows: MonthRow[], years = 15, referenceDate = new Date()): MonthRow[] {
  return filterByHistory(rows, { unit: "years", value: years }, referenceDate);
}

export const IMPACT_LABELS: Record<ImpactKey, string> = {
  none: "Sem impacto",
  low: "Baixo impacto",
  moderate: "Impacto moderado",
  high: "Impacto alto",
  severe: "Impacto severo",
};

export const IMPACT_RANGES: Record<ImpactKey, string> = {
  none: "0–2 mm/dia",
  low: "2–10 mm/dia",
  moderate: "10–15 mm/dia",
  high: "15–20 mm/dia",
  severe: "> 20 mm/dia",
};

export const IMPACT_COLORS: Record<ImpactKey, string> = {
  none: "hsl(var(--impact-none))",
  low: "hsl(var(--impact-low))",
  moderate: "hsl(var(--impact-moderate))",
  high: "hsl(var(--impact-high))",
  severe: "hsl(var(--impact-severe))",
};

export function classifyImpact(mm: number): ImpactKey {
  if (mm < 2) return "none";
  if (mm < 10) return "low";
  if (mm < 15) return "moderate";
  if (mm <= 20) return "high";
  return "severe";
}

export interface ImpactPerMonth {
  month: number; // 1-12
  monthLabel: string;
  none: number;
  low: number;
  moderate: number;
  high: number;
  severe: number;
  rainy: number; // soma de todos os tipos com chuva > 0 = low+moderate+high+severe
  total: number; // total de dias avaliados
}

export const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Para cada mês (1..12) calcula a média de dias por categoria considerando todos os anos disponíveis
export function impactByMonthAvg(rows: MonthRow[]): ImpactPerMonth[] {
  const byMonth: Record<number, { count: number; sums: Record<ImpactKey, number>; totalDays: number }> = {};
  for (let m = 1; m <= 12; m++) {
    byMonth[m] = { count: 0, sums: { none: 0, low: 0, moderate: 0, high: 0, severe: 0 }, totalDays: 0 };
  }

  for (const r of rows) {
    const bucket = byMonth[r.month];
    bucket.count++;
    for (const v of r.days) {
      if (v === null) continue;
      bucket.totalDays++;
      bucket.sums[classifyImpact(v)]++;
    }
  }

  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const b = byMonth[m];
    const c = b.count || 1;
    const none = b.sums.none / c;
    const low = b.sums.low / c;
    const moderate = b.sums.moderate / c;
    const high = b.sums.high / c;
    const severe = b.sums.severe / c;
    return {
      month: m,
      monthLabel: MONTH_NAMES[i],
      none, low, moderate, high, severe,
      rainy: low + moderate + high + severe,
      total: none + low + moderate + high + severe,
    };
  });
}

// Arredonda para cima valores > 0 (mesma regra exibida na tabela mensal)
export const ceilDays = (n: number) => (n > 0 ? Math.ceil(n) : 0);

// Dias chuvosos do mês = soma das categorias com chuva, cada uma já arredondada para cima
export const roundedRainyDays = (m: ImpactPerMonth) =>
  ceilDays(m.low) + ceilDays(m.moderate) + ceilDays(m.high) + ceilDays(m.severe);

// Texto explicativo da metodologia, compartilhado entre dashboard e PDF
export const CALCULATION_NOTES: string[] = [
  "Cada dia do histórico é classificado pela chuva registrada: sem impacto (< 2 mm), baixo (2–10 mm), moderado (10–15 mm), alto (15–20 mm) e severo (> 20 mm).",
  "A média mensal de cada categoria é o número de dias da categoria naquele mês dividido pela quantidade de anos com dados para o mês.",
  "Médias mensais maiores que zero são arredondadas para cima (ex.: 0,2 dia → 1 dia). Os dias chuvosos do mês são a soma das categorias com chuva já arredondadas.",
  "O total anual de cada categoria é a soma das 12 médias mensais já arredondadas, e não o arredondamento da soma das médias. Por isso o total pode ser maior que a soma dos valores exatos.",
  "Dias ponderados = total anual arredondado × peso da categoria. A distribuição percentual usa os mesmos totais arredondados.",
  "Improdutividade = soma dos dias ponderados das categorias consideradas em cada critério ÷ 365.",
];

export interface Weights {
  low: number;
  moderate: number;
  high: number;
  severe: number;
}

export const DEFAULT_WEIGHTS: Weights = { low: 0.25, moderate: 0.5, high: 1, severe: 1 };

export interface AggregatedImpact {
  totals: Record<ImpactKey, number>;          // soma anual das médias mensais arredondadas para cima
  totalImpacted: number;                       // sum (excluindo none)
  totalRainy: number;                          // sum (excluindo none)
  totalDays: number;                           // sum incluindo none
  percentages: Record<ImpactKey, number>;      // % dos dias chuvosos por tipo (do total chuvoso)
  weighted: Record<"low" | "moderate" | "high" | "severe", number>;
  weightedSum: number;
  unprodCovered: number;
  unprodOutsideIndustrial: number;
  unprodCommonIndustrial: number;
  unprodEarthworks: number;
}

interface AggregateOptions {
  earthworksSevereShare?: number;
}

export function aggregate(
  monthly: ImpactPerMonth[],
  weights: Weights,
  options: AggregateOptions = {},
): AggregatedImpact {
  const totals: Record<ImpactKey, number> = { none: 0, low: 0, moderate: 0, high: 0, severe: 0 };
  // Soma das médias mensais já arredondadas para cima (regra da tabela mensal)
  for (const m of monthly) {
    totals.none += ceilDays(m.none);
    totals.low += ceilDays(m.low);
    totals.moderate += ceilDays(m.moderate);
    totals.high += ceilDays(m.high);
    totals.severe += ceilDays(m.severe);
  }

  const totalRainy = totals.low + totals.moderate + totals.high + totals.severe;
  const totalDays = totalRainy + totals.none;

  const percentages: Record<ImpactKey, number> = {
    none: totalDays ? (totals.none / totalDays) * 100 : 0,
    low: totalRainy ? (totals.low / totalRainy) * 100 : 0,
    moderate: totalRainy ? (totals.moderate / totalRainy) * 100 : 0,
    high: totalRainy ? (totals.high / totalRainy) * 100 : 0,
    severe: totalRainy ? (totals.severe / totalRainy) * 100 : 0,
  };

  const weighted = {
    low: totals.low * weights.low,
    moderate: totals.moderate * weights.moderate,
    high: totals.high * weights.high,
    severe: totals.severe * weights.severe,
  };
  const earthworksSevereShare = options.earthworksSevereShare ?? 1;
  const weightedSum = weighted.low + weighted.moderate + weighted.high + weighted.severe;

  return {
    totals,
    totalImpacted: totalRainy,
    totalRainy,
    totalDays,
    percentages,
    weighted,
    weightedSum,
    unprodCovered: weighted.severe / 365,
    unprodOutsideIndustrial: (weighted.moderate + weighted.high + weighted.severe) / 365,
    unprodCommonIndustrial: (weighted.low + weighted.moderate + weighted.high + weighted.severe) / 365,
    unprodEarthworks: (
      weighted.low +
      weighted.moderate +
      weighted.high +
      weighted.severe * earthworksSevereShare
    ) / 365,
  };
}

export function avgRainyDaysPerMonth(monthly: ImpactPerMonth[]): number {
  const sum = monthly.reduce((a, m) => a + roundedRainyDays(m), 0);
  return sum / 12;
}

export function avgImpactedDaysPerMonth(monthly: ImpactPerMonth[]): number {
  // dias com impacto = excluindo "none" e considerando todas as categorias chuvosas
  return avgRainyDaysPerMonth(monthly);
}

export const NIVEL_LABEL: Record<string, string> = {
  "1": "Bruto",
  "2": "Consistido",
};

export const TIPO_MEDICAO_LABEL: Record<string, string> = {
  "1": "Pluviômetro",
  "2": "Pluviógrafo",
  "3": "Data logger",
};
