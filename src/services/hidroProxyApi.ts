import {
  HIDRO_ENDPOINTS,
  type HidroSeriesFeatureKey,
} from "@/services/hidroEndpointRegistry";

export interface HidroUf {
  sigla: string;
  nome: string;
  codigo: string;
}

export interface HidroMunicipio {
  codigo: string;
  nome: string;
  ufSigla: string;
  ufCodigo: string;
}

export interface HidroEstacao {
  codigo: string;
  nome: string;
  municipioCodigo: string;
  municipioNome: string;
  ufSigla: string;
  tipoMedicao: string;
  nivelConsistencia: string;
  periodoChuvaInicio?: string;
  periodoChuvaFim?: string;
}

export class HidroApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "HidroApiError";
    this.statusCode = statusCode;
  }
}

interface HidroItemsEnvelope<T> {
  items?: T[];
  Items?: T[];
  data?: T[];
  Data?: T[];
  results?: T[];
  Results?: T[];
  value?: T[];
  Value?: T[];
}

interface RequestOptions {
  signal?: AbortSignal;
}

export interface HidroSeriesRequest {
  feature: HidroSeriesFeatureKey;
  stationCode: string;
  startDate: string;
  endDate: string;
  onProgress?: (progress: HidroSeriesProgress) => void;
  requestDelayMs?: number;
  signal?: AbortSignal;
}

export interface HidroSeriesProgress {
  completedWindows: number;
  totalWindows: number;
}

const DEFAULT_SERIES_MAX_RANGE_DAYS = 3660;
const DEFAULT_SERIES_REQUEST_DELAY_MS = 120;
const SERIES_DATE_KEYS = [
  "Data",
  "DataLeitura",
  "DataLeituraUTC",
  "Data_Hora_Medicao",
  "Data_Hora_Dado",
  "DataHora",
  "DataMedicao",
] as const;

function resolveSeriesFeatureParam(feature: HidroSeriesFeatureKey): string {
  switch (feature) {
    case "hidroSerieChuva":
      return "HidroSerieChuva";
    case "hidroinfoanaSerieTelemetricaAdotada":
      return "telemetricaadotada";
    case "hidroinfoanaSerieTelemetricaDetalhada":
      return "telemetrica_detalhada";
    case "hidrosatSerieDados":
      return "hidrosat";
    default:
      return feature;
  }
}

const configuredBase = (import.meta.env.VITE_HIDRO_PROXY_BASE_URL ?? "").trim();
const fallbackDevBase = import.meta.env.DEV ? "http://localhost:3000" : "";
const defaultBase = configuredBase || fallbackDevBase;

export function getConfiguredHidroApiBaseUrl(): string {
  return defaultBase;
}

function getBaseUrl(): string {
  const value = (defaultBase ?? "").trim();
  if (!value) {
    throw new HidroApiError(
      "Configure VITE_HIDRO_PROXY_BASE_URL para habilitar o modo API.",
    );
  }
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function pickString(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return "";
}

function normalizeList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const envelope = payload as HidroItemsEnvelope<T>;
  if (Array.isArray(envelope.items)) return envelope.items;
  if (Array.isArray(envelope.Items)) return envelope.Items;
  if (Array.isArray(envelope.data)) return envelope.data;
  if (Array.isArray(envelope.Data)) return envelope.Data;
  if (Array.isArray(envelope.results)) return envelope.results;
  if (Array.isArray(envelope.Results)) return envelope.Results;
  if (Array.isArray(envelope.value)) return envelope.value;
  if (Array.isArray(envelope.Value)) return envelope.Value;

  const arrayValue = Object.values(payload).find((value) => Array.isArray(value));
  if (Array.isArray(arrayValue)) {
    return arrayValue as T[];
  }

  return [];
}

function makeUrl(path: string, params: Record<string, string | undefined>) {
  const url = new URL(`${getBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

function isPluviometricStation(row: Record<string, unknown>): boolean {
  const tipoEstacao = pickString(row, ["Tipo_Estacao", "TipoEstacao"]).toLowerCase();
  const tipoPluviometro = pickString(row, ["Tipo_Estacao_Pluviometro", "TipoEstacaoPluviometro"]);
  const periodoInicio = pickString(row, [
    "Data_Periodo_Pluviometro_Inicio",
    "DataPeriodoPluviometroInicio",
  ]);

  return tipoEstacao.includes("pluv") || tipoPluviometro === "1" || !!periodoInicio;
}

function compareStations(a: HidroEstacao, b: HidroEstacao) {
  const aStart = a.periodoChuvaInicio || "9999";
  const bStart = b.periodoChuvaInicio || "9999";
  const byStart = aStart.localeCompare(bStart);
  return byStart || a.nome.localeCompare(b.nome, "pt-BR");
}

function parseSeriesDate(raw: unknown): Date | null {
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
  if (Number.isNaN(fallback.getTime())) return null;
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

function parseSeriesRain(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().replace(",", ".");
  if (!normalized || normalized === "-") return null;
  const value = Number.parseFloat(normalized);
  return Number.isNaN(value) ? null : value;
}

function getLatestDateFromRow(row: Record<string, unknown>): Date | null {
  const baseDate = parseSeriesDate(
    SERIES_DATE_KEYS.map((key) => row[key]).find((value) => value !== null && value !== undefined && String(value).trim() !== ""),
  );
  if (!baseDate) return null;

  let latestMonthlyDate: Date | null = null;
  for (let day = 31; day >= 1; day -= 1) {
    const key = String(day).padStart(2, "0");
    const rain = parseSeriesRain(
      row[`Chuva_${key}`] ?? row[`Chuva${key}`] ?? row[`chuva_${key}`] ?? row[`chuva${key}`],
    );

    if (rain !== null) {
      latestMonthlyDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
      break;
    }
  }

  if (latestMonthlyDate) return latestMonthlyDate;

  const singleRain = parseSeriesRain(
    row.Chuva_Adotada ??
    row.ChuvaAdotada ??
    row.Chuva ??
    row.chuva ??
    row.Precipitacao ??
    row.Precipitacao_Adotada ??
    row.Valor ??
    row.valor,
  );

  return singleRain !== null ? baseDate : null;
}

function parseInventoryYear(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-/);
  return match ? Number(match[1]) : null;
}

async function requestList<T>(
  path: string,
  params: Record<string, string | undefined>,
  options?: RequestOptions,
) {
  const response = await fetch(makeUrl(path, params), {
    method: "GET",
    signal: options?.signal,
  });

  if (!response.ok) {
    // Try to parse structured JSON error from backend/proxy
    const text = await response.text().catch(() => "");
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (payload && typeof payload === "object") {
      // Handle wrapped proxy error shape: { error: { code, message, details }, requestId }
      const topError = (payload as any).error;
      let msg: string | null = null;
      let code: string | undefined = undefined;
      let details: unknown = null;

      if (topError && typeof topError === "object") {
        msg = topError.message || topError.error || topError.msg || null;
        code = topError.code || (payload as any).code;
        details = topError.details ?? topError.upstreamData ?? (payload as any).details ?? null;
      } else {
        msg = (payload as any).message || (payload as any).error || (payload as any).msg || text || null;
        code = (payload as any).code;
        details = (payload as any).details ?? (payload as any).errors ?? null;
      }

      const err = new HidroApiError(String(msg ?? "Falha ao consultar API ANA."), response.status);
      err.code = code;
      err.details = {
        requestId: (payload as any).requestId,
        payload: details,
      };
      throw err;
    }

    // Fallback to raw text when payload isn't JSON
    throw new HidroApiError(text || "Falha ao consultar API ANA.", response.status);
  }

  const payload = await response.json();
  return normalizeList<T>(payload);
}

export async function fetchHidroUfs(signal?: AbortSignal): Promise<HidroUf[]> {
  const endpoint = HIDRO_ENDPOINTS.hidroUf;
  const rows = await requestList<Record<string, unknown>>(endpoint.path, {}, { signal });

  return rows
    .map((row) => ({
      sigla: pickString(row, ["Estado_Sigla", "SiglaUF", "UF", "Sigla"]),
      nome: pickString(row, ["Estado_Nome", "NomeUF", "Nome", "Descricao"]),
      codigo: pickString(row, ["codigouf", "CodigoUF", "Codigo", "Id"]),
    }))
    .filter((row) => row.sigla && row.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function fetchHidroMunicipios(
  ufSigla: string,
  signal?: AbortSignal,
): Promise<HidroMunicipio[]> {
  const endpoint = HIDRO_ENDPOINTS.hidroMunicipio;
  const rows = await requestList<Record<string, unknown>>(endpoint.path, {
    uf: ufSigla,
  }, { signal });

  return rows
    .map((row) => ({
      codigo: pickString(row, [
        "codigomunicipio",
        "CodigoMunicipio",
        "Municipio_Codigo_IBGE",
        "Codigo",
        "CodMunicipio",
        "IdMunicipio",
      ]),
      nome: pickString(row, ["Municipio_Nome", "NomeMunicipio", "Municipio", "Nome"]),
      ufSigla: ufSigla,
      ufCodigo: pickString(row, ["Estado_Codigo", "EstadoCodigo", "CodigoUF", "Codigo"]),
    }))
    .filter((row) => row.codigo && row.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function fetchHidroEstacoesByMunicipio(
  municipioNome: string,
  ufSigla: string,
  signal?: AbortSignal,
): Promise<HidroEstacao[]> {
  const rows = await requestList<Record<string, unknown>>("/api/hidro/estacoes", {
    municipio: municipioNome,
    uf: ufSigla,
  }, { signal });

  return rows
    .map((row) => ({
      codigo: pickString(row, ["CodigoEstacao", "codigoestacao", "CodigoDaEstacao", "CodEstacao"]),
      nome: pickString(row, ["NomeEstacao", "Estacao_Nome", "Estacao", "Nome"]),
      municipioCodigo: pickString(row, ["CodigoMunicipio", "codigomunicipio", "CodMunicipio"]),
      municipioNome: pickString(row, ["NomeMunicipio", "Municipio_Nome", "Municipio", "Nome"]),
      ufSigla: pickString(row, ["SiglaUF", "UF_Estacao", "UF"]),
      tipoMedicao: pickString(row, ["TipoMedicaoChuvas", "TipoMedicao", "Tipo"]),
      nivelConsistencia: pickString(row, ["NivelConsistencia", "Consistencia"]),
      periodoChuvaInicio: pickString(row, ["Data_Periodo_Pluviometro_Inicio"]),
      periodoChuvaFim: pickString(row, ["Data_Periodo_Pluviometro_Fim"]),
    }))
    .filter((row) => row.codigo)
    .sort(compareStations);
}

export async function fetchHidroEstacoesByMunicipioForFeature(
  feature: HidroSeriesFeatureKey,
  municipioNome: string,
  ufSigla: string,
  signal?: AbortSignal,
): Promise<HidroEstacao[]> {
  const rows = await requestList<Record<string, unknown>>("/api/hidro/estacoes", {
    municipio: municipioNome,
    uf: ufSigla,
    feature,
    strict: "true",
  }, { signal });

  return rows
    .filter((row) => feature !== "hidroSerieChuva" || isPluviometricStation(row))
    .map((row) => ({
      codigo: pickString(row, ["CodigoEstacao", "codigoestacao", "CodigoDaEstacao", "CodEstacao"]),
      nome: pickString(row, ["NomeEstacao", "Estacao_Nome", "Estacao", "Nome"]),
      municipioCodigo: pickString(row, ["CodigoMunicipio", "codigomunicipio", "CodMunicipio"]),
      municipioNome: pickString(row, ["NomeMunicipio", "Municipio_Nome", "Municipio", "Nome"]),
      ufSigla: pickString(row, ["SiglaUF", "UF_Estacao", "UF"]),
      tipoMedicao: pickString(row, ["TipoMedicaoChuvas", "TipoMedicao", "Tipo"]),
      nivelConsistencia: pickString(row, ["NivelConsistencia", "Consistencia"]),
      periodoChuvaInicio: pickString(row, ["Data_Periodo_Pluviometro_Inicio"]),
      periodoChuvaFim: pickString(row, ["Data_Periodo_Pluviometro_Fim"]),
    }))
    .filter((row) => row.codigo)
    .sort(compareStations);
}

export async function fetchHidroSeriesData({
  feature,
  stationCode,
  startDate,
  endDate,
  onProgress,
  requestDelayMs = DEFAULT_SERIES_REQUEST_DELAY_MS,
  signal,
}: HidroSeriesRequest): Promise<Record<string, unknown>[]> {
  const endpoint = HIDRO_ENDPOINTS[feature];
  const maxRangeDays = endpoint.maxRangeDays ?? DEFAULT_SERIES_MAX_RANGE_DAYS;

  const parseDate = (value: string) => {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const addDays = (date: Date, days: number) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const parsedStart = parseDate(startDate);
  const parsedEnd = parseDate(endDate);

  if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
    throw new HidroApiError("Intervalo de datas invalido para consulta de series.");
  }

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, Math.max(0, ms));
    });

  const windows: Array<{ start: Date; end: Date }> = [];
  let previewStart = parsedStart;

  while (previewStart <= parsedEnd) {
    const previewEndCandidate = addDays(previewStart, Math.max(1, maxRangeDays) - 1);
    const previewEnd = previewEndCandidate < parsedEnd ? previewEndCandidate : parsedEnd;
    windows.push({ start: previewStart, end: previewEnd });
    previewStart = addDays(previewEnd, 1);
  }

  const allRows: Record<string, unknown>[] = [];
  for (let index = 0; index < windows.length; index += 1) {
    const window = windows[index];

    const rows = await requestList<Record<string, unknown>>("/api/hidro/series", {
      feature: resolveSeriesFeatureParam(feature),
      CodigoDaEstacao: stationCode,
      DataInicio: formatDate(window.start),
      DataFim: formatDate(window.end),
    }, { signal });

    allRows.push(...rows);
    onProgress?.({
      completedWindows: index + 1,
      totalWindows: windows.length,
    });

    const hasMoreWindows = index < windows.length - 1;
    if (hasMoreWindows && requestDelayMs > 0) {
      await wait(requestDelayMs);
    }
  }

  return allRows;
}

export async function fetchHidroLatestAvailableDate(
  feature: HidroSeriesFeatureKey,
  station: HidroEstacao,
  signal?: AbortSignal,
): Promise<string | null> {
  const currentYear = new Date().getFullYear();
  const oldestYear = parseInventoryYear(station.periodoChuvaInicio) ?? currentYear - 80;

  for (let year = currentYear; year >= oldestYear; year -= 1) {
    const endDate = year === currentYear
      ? new Date()
      : new Date(year, 11, 31);

    const rows = await fetchHidroSeriesData({
      feature,
      stationCode: station.codigo,
      startDate: `${year}-01-01`,
      endDate: `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`,
      requestDelayMs: 0,
      signal,
    });

    let latest: Date | null = null;
    for (const row of rows) {
      const candidate = getLatestDateFromRow(row);
      if (candidate && (!latest || candidate > latest)) {
        latest = candidate;
      }
    }

    if (latest) {
      const yyyy = latest.getFullYear();
      const mm = String(latest.getMonth() + 1).padStart(2, "0");
      const dd = String(latest.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return null;
}
