export type HidroEndpointCategory = "auth" | "catalog" | "inventory" | "series";

export interface HidroEndpointDefinition {
  key: HidroEndpointKey;
  path: string;
  label: string;
  category: HidroEndpointCategory;
  maxRangeDays?: number;
}

export type HidroEndpointKey =
  | "oauthPermissoes"
  | "oauth"
  | "hidrosatSerieDados"
  | "hidrosatInventarioEstacoes"
  | "hidroinfoanaSerieTelemetricaDetalhada"
  | "hidroinfoanaSerieTelemetricaAdotada"
  | "hidroUf"
  | "hidroSubBacia"
  | "hidroSerieVazao"
  | "hidroSerieSedimentos"
  | "hidroSerieResumoDescarga"
  | "hidroSerieQa"
  | "hidroSeriePerfilTransversal"
  | "hidroSerieGranulometria"
  | "hidroSerieCurvaDescarga"
  | "hidroSerieCotas"
  | "hidroSerieChuva"
  | "hidroRio"
  | "hidroMunicipio"
  | "hidroInventarioEstacoes"
  | "hidroEntidade"
  | "hidroBacia";

export const HIDRO_ENDPOINTS: Record<HidroEndpointKey, HidroEndpointDefinition> = {
  oauthPermissoes: {
    key: "oauthPermissoes",
    path: "/EstacoesTelemetricas/OAUthPermissoes/v1",
    label: "Permissoes SSO",
    category: "auth",
  },
  oauth: {
    key: "oauth",
    path: "/EstacoesTelemetricas/OAUth/v1",
    label: "Autenticacao",
    category: "auth",
  },
  hidrosatSerieDados: {
    key: "hidrosatSerieDados",
    path: "/EstacoesTelemetricas/HidrosatSerieDados/v1",
    label: "HidroSat - Serie de Dados",
    category: "series",
    maxRangeDays: 366,
  },
  hidrosatInventarioEstacoes: {
    key: "hidrosatInventarioEstacoes",
    path: "/EstacoesTelemetricas/HidrosatInventarioEstacoes/v1",
    label: "HidroSat - Inventario de Estacoes",
    category: "inventory",
  },
  hidroinfoanaSerieTelemetricaDetalhada: {
    key: "hidroinfoanaSerieTelemetricaDetalhada",
    path: "/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaDetalhada/v1",
    label: "HidroInfoANA - Serie Telemetrica Detalhada",
    category: "series",
    maxRangeDays: 30,
  },
  hidroinfoanaSerieTelemetricaAdotada: {
    key: "hidroinfoanaSerieTelemetricaAdotada",
    path: "/EstacoesTelemetricas/HidroinfoanaSerieTelemetricaAdotada/v1",
    label: "HidroInfoANA - Serie Telemetrica Adotada",
    category: "series",
    maxRangeDays: 30,
  },
  hidroUf: {
    key: "hidroUf",
    path: "/EstacoesTelemetricas/HidroUF/v1",
    label: "UFs",
    category: "catalog",
  },
  hidroSubBacia: {
    key: "hidroSubBacia",
    path: "/EstacoesTelemetricas/HidroSubBacia/v1",
    label: "Sub-bacias",
    category: "catalog",
  },
  hidroSerieVazao: {
    key: "hidroSerieVazao",
    path: "/EstacoesTelemetricas/HidroSerieVazao/v1",
    label: "Serie de Vazao",
    category: "series",
    maxRangeDays: 366,
  },
  hidroSerieSedimentos: {
    key: "hidroSerieSedimentos",
    path: "/EstacoesTelemetricas/HidroSerieSedimentos/v1",
    label: "Serie de Sedimentos",
    category: "series",
    maxRangeDays: 366,
  },
  hidroSerieResumoDescarga: {
    key: "hidroSerieResumoDescarga",
    path: "/EstacoesTelemetricas/HidroSerieResumoDescarga/v1",
    label: "Serie Resumo de Descarga",
    category: "series",
    maxRangeDays: 366,
  },
  hidroSerieQa: {
    key: "hidroSerieQa",
    path: "/EstacoesTelemetricas/HidroSerieQA/v1",
    label: "Serie de Qualidade da Agua",
    category: "series",
    maxRangeDays: 366,
  },
  hidroSeriePerfilTransversal: {
    key: "hidroSeriePerfilTransversal",
    path: "/EstacoesTelemetricas/HidroSeriePerfilTransversal/v1",
    label: "Serie Perfil Transversal",
    category: "series",
    maxRangeDays: 366,
  },
  hidroSerieGranulometria: {
    key: "hidroSerieGranulometria",
    path: "/EstacoesTelemetricas/HidroSerieGranulometria/v1",
    label: "Serie Granulometria",
    category: "series",
    maxRangeDays: 366,
  },
  hidroSerieCurvaDescarga: {
    key: "hidroSerieCurvaDescarga",
    path: "/EstacoesTelemetricas/HidroSerieCurvaDescarga/v1",
    label: "Serie Curva de Descarga",
    category: "series",
    maxRangeDays: 366,
  },
  hidroSerieCotas: {
    key: "hidroSerieCotas",
    path: "/EstacoesTelemetricas/HidroSerieCotas/v1",
    label: "Serie de Cotas",
    category: "series",
    maxRangeDays: 366,
  },
  hidroSerieChuva: {
    key: "hidroSerieChuva",
    path: "/EstacoesTelemetricas/HidroSerieChuva/v1",
    label: "Serie de Chuva",
    category: "series",
    maxRangeDays: 366,
  },
  hidroRio: {
    key: "hidroRio",
    path: "/EstacoesTelemetricas/HidroRio/v1",
    label: "Rios",
    category: "catalog",
  },
  hidroMunicipio: {
    key: "hidroMunicipio",
    path: "/EstacoesTelemetricas/HidroMunicipio/v1",
    label: "Municipios",
    category: "catalog",
  },
  hidroInventarioEstacoes: {
    key: "hidroInventarioEstacoes",
    path: "/EstacoesTelemetricas/HidroInventarioEstacoes/v1",
    label: "Inventario de Estacoes",
    category: "inventory",
  },
  hidroEntidade: {
    key: "hidroEntidade",
    path: "/EstacoesTelemetricas/HidroEntidade/v1",
    label: "Entidades",
    category: "catalog",
  },
  hidroBacia: {
    key: "hidroBacia",
    path: "/EstacoesTelemetricas/HidroBacia/v1",
    label: "Bacias",
    category: "catalog",
  },
};

export type HidroSeriesFeatureKey =
  | "hidroinfoanaSerieTelemetricaAdotada"
  | "hidroinfoanaSerieTelemetricaDetalhada"
  | "hidroSerieChuva"
  | "hidrosatSerieDados";

export const HIDRO_SERIES_FEATURES: HidroSeriesFeatureKey[] = [
  "hidroinfoanaSerieTelemetricaAdotada",
  "hidroinfoanaSerieTelemetricaDetalhada",
  "hidroSerieChuva",
  "hidrosatSerieDados",
];

export const DEFAULT_HIDRO_FEATURE: HidroSeriesFeatureKey = "hidroinfoanaSerieTelemetricaAdotada";

export const HIDRO_SERIES_LABELS: Record<HidroSeriesFeatureKey, string> = {
  hidroinfoanaSerieTelemetricaAdotada: "Telemetrica adotada (chuva, nivel e vazao)",
  hidroinfoanaSerieTelemetricaDetalhada: "Telemetrica detalhada (adotada + bruta)",
  hidroSerieChuva: "Serie de chuva (convencional)",
  hidrosatSerieDados: "HidroSat (estimativa por satelite)",
};

export function getInventoryEndpoint(feature: HidroSeriesFeatureKey): HidroEndpointKey {
  return feature === "hidrosatSerieDados" ? "hidrosatInventarioEstacoes" : "hidroInventarioEstacoes";
}
