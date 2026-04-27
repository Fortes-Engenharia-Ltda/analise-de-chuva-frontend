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
}

export class HidroApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "HidroApiError";
    this.statusCode = statusCode;
  }
}

interface HidroItemsEnvelope<T> {
  items?: T[];
  Items?: T[];
}

export interface HidroSeriesRequest {
  feature: HidroSeriesFeatureKey;
  stationCode: string;
  startDate: string;
  endDate: string;
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

async function requestList<T>(path: string, params: Record<string, string | undefined>) {
  const response = await fetch(makeUrl(path, params), { method: "GET" });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new HidroApiError(body || "Falha ao consultar API ANA.", response.status);
  }

  const payload = await response.json();
  return normalizeList<T>(payload);
}

export async function fetchHidroUfs(): Promise<HidroUf[]> {
  const endpoint = HIDRO_ENDPOINTS.hidroUf;
  const rows = await requestList<Record<string, unknown>>(endpoint.path, {});

  return rows
    .map((row) => ({
      sigla: pickString(row, ["Estado_Sigla", "SiglaUF", "UF", "Sigla"]),
      nome: pickString(row, ["Estado_Nome", "NomeUF", "Nome", "Descricao"]),
      codigo: pickString(row, ["codigouf", "CodigoUF", "Codigo", "Id"]),
    }))
    .filter((row) => row.sigla && row.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function fetchHidroMunicipios(ufSigla: string): Promise<HidroMunicipio[]> {
  const endpoint = HIDRO_ENDPOINTS.hidroMunicipio;
  const rows = await requestList<Record<string, unknown>>(endpoint.path, {
    SiglaUF: ufSigla,
  });

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
): Promise<HidroEstacao[]> {
  const rows = await requestList<Record<string, unknown>>("/api/hidro/estacoes", {
    municipio: municipioNome,
    uf: ufSigla,
  });

  return rows
    .map((row) => ({
      codigo: pickString(row, ["CodigoEstacao", "codigoestacao", "CodigoDaEstacao", "CodEstacao"]),
      nome: pickString(row, ["NomeEstacao", "Estacao_Nome", "Estacao", "Nome"]),
      municipioCodigo: pickString(row, ["CodigoMunicipio", "codigomunicipio", "CodMunicipio"]),
      municipioNome: pickString(row, ["NomeMunicipio", "Municipio_Nome", "Municipio", "Nome"]),
      ufSigla: pickString(row, ["SiglaUF", "UF_Estacao", "UF"]),
      tipoMedicao: pickString(row, ["TipoMedicaoChuvas", "TipoMedicao", "Tipo"]),
      nivelConsistencia: pickString(row, ["NivelConsistencia", "Consistencia"]),
    }))
    .filter((row) => row.codigo)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function fetchHidroSeriesData({
  feature,
  stationCode,
  startDate,
  endDate,
}: HidroSeriesRequest): Promise<Record<string, unknown>[]> {
  const endpoint = HIDRO_ENDPOINTS[feature];
  return requestList<Record<string, unknown>>(endpoint.path, {
    CodigoDaEstacao: stationCode,
    DataInicio: startDate,
    DataFim: endDate,
  });
}
