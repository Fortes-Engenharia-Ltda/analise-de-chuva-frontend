import { type MonthRow, type ParsedFile } from "@/lib/rainfall";
import type { HidroEstacao } from "@/services/hidroProxyApi";
import type { HidroSeriesFeatureKey } from "@/services/hidroEndpointRegistry";

interface BuildParsedFileOptions {
  feature: HidroSeriesFeatureKey;
  station: HidroEstacao;
  series: Record<string, unknown>[];
}

const RAIN_KEYS = [
  "Chuva_Adotada",
  "ChuvaAdotada",
  "Chuva",
  "chuva",
  "Precipitacao",
  "Precipitacao_Adotada",
  "Valor",
  "valor",
] as const;

const DATE_KEYS = [
  "Data",
  "DataLeitura",
  "DataLeituraUTC",
  "Data_Hora_Medicao",
  "Data_Hora_Dado",
  "DataHora",
  "DataMedicao",
] as const;

function pick(raw: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = raw[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
}

function parseRain(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim().replace(",", ".");
  if (!value || value === "-") return null;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;

  const text = String(raw).trim();
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, yyyy, mm, dd] = iso;
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  const fallback = new Date(text);
  if (Number.isNaN(fallback.getTime())) {
    return null;
  }

  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

function getMonthRainDays(raw: Record<string, unknown>): (number | null)[] | null {
  const days = Array.from({ length: 31 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return parseRain(
      pick(raw, [
        `Chuva${day}`,
        `chuva${day}`,
        `Chuva_${day}`,
        `chuva_${day}`,
      ]),
    );
  });

  return days.some((value) => value !== null) ? days : null;
}

function buildMonthRow(
  station: HidroEstacao,
  date: Date,
  days: (number | null)[],
): MonthRow {
  const valid = days.filter((value): value is number => value !== null);

  return {
    estacao: station.codigo,
    nivelConsistencia: station.nivelConsistencia || "2",
    tipoMedicao: station.tipoMedicao || "1",
    date: new Date(date.getFullYear(), date.getMonth(), 1),
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    days,
    rainyDays: valid.filter((value) => value > 0).length,
    totalRain: valid.reduce((sum, value) => sum + value, 0),
  };
}

function toMonthRows(station: HidroEstacao, series: Record<string, unknown>[]): MonthRow[] {
  const monthMap = new Map<string, MonthRow>();

  for (const item of series) {
    const date = parseDate(pick(item, DATE_KEYS));
    if (!date) continue;

    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;

    const monthlyDays = getMonthRainDays(item);
    if (monthlyDays) {
      monthMap.set(key, buildMonthRow(station, date, monthlyDays));
      continue;
    }

    const rain = parseRain(pick(item, RAIN_KEYS));
    if (rain === null) continue;

    const dayIndex = date.getDate() - 1;

    let row = monthMap.get(key);
    if (!row) {
      row = buildMonthRow(station, date, Array.from({ length: 31 }, () => null));
      monthMap.set(key, row);
    }

    row.days[dayIndex] = rain;
  }

  const rows = [...monthMap.values()]
    .map((row) => {
      const valid = row.days.filter((value): value is number => value !== null);
      return {
        ...row,
        rainyDays: valid.filter((value) => value > 0).length,
        totalRain: valid.reduce((sum, value) => sum + value, 0),
      };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return rows;
}

export function mapHidroSeriesToParsedFile({
  station,
  series,
}: BuildParsedFileOptions): ParsedFile {
  const rows = toMonthRows(station, series);

  return {
    header: {
      estacaoCodigo: station.codigo,
      nivelConsistencia: station.nivelConsistencia || "2",
      tipoMedicaoChuvas: station.tipoMedicao || "1",
    },
    rows,
  };
}
