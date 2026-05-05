import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudDownload,
  Droplets,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { HidroApiError } from "@/services/hidroProxyApi";
import { parseCsvFile, type ParsedFile } from "@/lib/rainfall";
import { useHidroCatalog } from "@/hooks/useHidroCatalog";
import { useHidroSeries } from "@/hooks/useHidroSeries";
import {
  fetchHidroLatestAvailableDate,
  getConfiguredHidroApiBaseUrl,
  type HidroSeriesProgress,
} from "@/services/hidroProxyApi";
import {
  DEFAULT_HIDRO_FEATURE,
  type HidroSeriesFeatureKey,
} from "@/services/hidroEndpointRegistry";

interface Props {
  onLoaded: (location: string, data: ParsedFile, analysisYears: number) => void;
}

const MUNICIPIOS_PAGE_SIZE = 75;
const DEFAULT_ANALYSIS_YEARS = 15;

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getCatalogErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message && error.message !== "Failed to fetch") {
      return error.message;
    }
  }

  return "Não foi possível carregar os dados da API agora. Tente novamente em alguns segundos.";
}

function formatInventoryDate(value?: string) {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const [, yyyy, mm] = match;
  return `${mm}/${yyyy}`;
}

function formatStationPeriod(
  station: { periodoChuvaInicio?: string; periodoChuvaFim?: string } | null,
  latestAvailableDate?: string | null,
) {
  if (!station) return "";

  const start = formatInventoryDate(station.periodoChuvaInicio);
  const end = formatInventoryDate(latestAvailableDate ?? station.periodoChuvaFim);

  if (start && end) return `${start} - ${end}`;
  if (start) return `${start} - ...`;
  if (end) return `- ${end}`;
  return "Período não informado";
}

export const UploadScreen = ({ onLoaded }: Props) => {
  const [mode, setMode] = useState<"csv" | "api">("csv");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [analysisYears, setAnalysisYears] = useState(DEFAULT_ANALYSIS_YEARS);

  const feature: HidroSeriesFeatureKey = DEFAULT_HIDRO_FEATURE;
  const [ufSigla, setUfSigla] = useState("");
  const [municipioCodigo, setMunicipioCodigo] = useState("");
  const [municipioSearch, setMunicipioSearch] = useState("");
  const [municipioPage, setMunicipioPage] = useState(1);
  const [municipioOpen, setMunicipioOpen] = useState(false);
  const [stationCode, setStationCode] = useState("");
  const [seriesProgress, setSeriesProgress] = useState<HidroSeriesProgress | null>(null);

  const { ufsQuery, municipiosQuery, estacoesQuery, autoSelectedStation } = useHidroCatalog({
    enabled: mode === "api",
    feature,
    ufSigla,
    municipioCodigo,
  });
  const seriesMutation = useHidroSeries();
  const apiBaseUrl = getConfiguredHidroApiBaseUrl();

  const stations = useMemo(() => estacoesQuery.data ?? [], [estacoesQuery.data]);
  const municipios = useMemo(() => municipiosQuery.data ?? [], [municipiosQuery.data]);
  const selectedUf = useMemo(
    () => ufsQuery.data?.find((uf) => uf.sigla === ufSigla) ?? null,
    [ufsQuery.data, ufSigla],
  );
  const deferredMunicipioSearch = useDeferredValue(normalizeSearchText(municipioSearch));
  const municipiosDaUf = useMemo(() => {
    if (!selectedUf?.codigo) {
      return municipios;
    }
    const filtered = municipios.filter((municipio) => municipio.ufCodigo === selectedUf.codigo);

    // Some API payloads do not populate ufCodigo consistently; if filtering removes everything,
    // keep the raw list so valid cities still appear.
    return filtered.length > 0 ? filtered : municipios;
  }, [municipios, selectedUf?.codigo]);
  const selectedMunicipio = useMemo(
    () => municipiosDaUf.find((municipio) => municipio.codigo === municipioCodigo) ?? null,
    [municipiosDaUf, municipioCodigo],
  );
  const selectedStation = useMemo(
    () => stations.find((station) => station.codigo === stationCode) ?? null,
    [stationCode, stations],
  );
  const activeStation = selectedStation;
  const latestStationDateQuery = useQuery({
    queryKey: ["hidro", "station", "latest-date", feature, activeStation?.codigo],
    queryFn: ({ signal }) => fetchHidroLatestAvailableDate(feature, activeStation!, signal),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 6,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: mode === "api" && !!activeStation,
  });
  const selectedStationPeriod = useMemo(() => {
    if (!activeStation) return "";
    if (latestStationDateQuery.isLoading && !latestStationDateQuery.data) {
      const start = formatInventoryDate(activeStation.periodoChuvaInicio);
      return start ? `${start} - ...` : "Consultando...";
    }
    return formatStationPeriod(activeStation, latestStationDateQuery.data);
  }, [activeStation, latestStationDateQuery.data, latestStationDateQuery.isLoading]);
  const filteredMunicipios = useMemo(() => {
    if (!deferredMunicipioSearch) {
      return municipiosDaUf;
    }

    return municipiosDaUf.filter((municipio) => {
      const nomeNormalizado = normalizeSearchText(municipio.nome);
      return (
        nomeNormalizado.includes(deferredMunicipioSearch) ||
        municipio.codigo.includes(deferredMunicipioSearch)
      );
    });
  }, [deferredMunicipioSearch, municipiosDaUf]);

  const visibleMunicipios = useMemo(
    () => filteredMunicipios.slice(0, municipioPage * MUNICIPIOS_PAGE_SIZE),
    [filteredMunicipios, municipioPage],
  );

  const municipioOptions = useMemo(() => {
    if (!selectedMunicipio) {
      return visibleMunicipios;
    }

    if (visibleMunicipios.some((municipio) => municipio.codigo === selectedMunicipio.codigo)) {
      return visibleMunicipios;
    }

    return [selectedMunicipio, ...visibleMunicipios];
  }, [selectedMunicipio, visibleMunicipios]);

  useEffect(() => {
    setMunicipioCodigo("");
    setStationCode("");
    setMunicipioSearch("");
    setMunicipioPage(1);
    setMunicipioOpen(false);
  }, [ufSigla]);

  useEffect(() => {
    setStationCode("");
  }, [municipioCodigo]);

  useEffect(() => {
    if (mode !== "api") {
      setSeriesProgress(null);
    }
  }, [mode]);

  useEffect(() => {
    setMunicipioPage(1);
  }, [deferredMunicipioSearch]);

  useEffect(() => {
    if (autoSelectedStation) {
      setStationCode(autoSelectedStation.codigo);
      return;
    }

    if (stationCode && !stations.some((station) => station.codigo === stationCode)) {
      setStationCode("");
    }
  }, [autoSelectedStation, stationCode, stations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedYears = Math.max(1, Math.min(80, Math.round(analysisYears)));

    if (mode === "csv") {
      if (!location.trim()) return toast.error("Informe o local");
      if (!file) return toast.error("Selecione um arquivo .csv");
      setLoadingCsv(true);
      try {
        const data = await parseCsvFile(file);
        if (data.rows.length === 0) {
          toast.error("Nenhum dado válido encontrado no CSV");
          return;
        }
        onLoaded(location.trim(), data, normalizedYears);
        toast.success(`${data.rows.length} meses carregados`);
      } catch (err) {
        console.error(err);
        toast.error("Falha ao processar o arquivo");
      } finally {
        setLoadingCsv(false);
      }
      return;
    }

    if (!ufSigla) return toast.error("Selecione a UF");
    if (!municipioCodigo) return toast.error("Selecione a cidade de referência");
    if (!activeStation) return toast.error("Selecione ou informe a estação de referência");

    try {
      setSeriesProgress(null);
      const data = await seriesMutation.mutateAsync({
        feature,
        station: activeStation,
        years: normalizedYears,
        onProgress: setSeriesProgress,
      });
      if (data.rows.length === 0) {
        toast.error("A API não retornou dados válidos para o período selecionado");
        return;
      }
      const loadedMunicipioNome = selectedMunicipio?.nome || activeStation.municipioNome;
      const loadedUf = activeStation.ufSigla || ufSigla;
      const loadedLocationBase = [loadedMunicipioNome, loadedUf].filter(Boolean).join(" - ");
      const loadedLocation = loadedLocationBase
        ? `${loadedLocationBase} · Estação ${activeStation.codigo}`
        : `Estação ${activeStation.codigo}`;
      onLoaded(loadedLocation, data, normalizedYears);
      toast.success(`${data.rows.length} meses carregados via API`);
    } catch (err) {
      console.error(err);
      // Friendly handling for station-feature mismatch returned by backend
      if (err instanceof HidroApiError) {
        // try to extract nested info
        const payload = (err.details as any)?.payload ?? (err.details as any) ?? null;
        const nestedError = payload?.error ?? null;
        const code = err.code ?? nestedError?.code ?? payload?.code;
        const requestId = (err.details && (err.details as any).requestId) || payload?.requestId || null;

        if (code === "STATION_FEATURE_MISMATCH" || err.statusCode === 422) {
          toast.error("Esta estação não é compatível com a consulta. Tente outra estação.");
        } else if (code === "ANA_UPSTREAM_ERROR" || nestedError || (payload && payload.upstreamData)) {
          // Friendly message for ANA upstream errors, avoid showing raw JSON
          toast.error(
            `Consulta rejeitada pela fonte ANA. Tente outra estação.${requestId ? ` (id: ${requestId})` : ""}`,
          );
        } else {
          // Fallback to message but ensure it's a string
          const message = typeof err.message === "string" ? err.message : "Falha ao consultar dados da API";
          const raw = message.trim();
          if (raw.startsWith("{") && raw.includes("ANA_UPSTREAM_ERROR")) {
            toast.error("Consulta rejeitada pela fonte ANA. Tente outra estação.");
          } else {
            toast.error(message);
          }
        }
      } else {
        const message = err instanceof Error ? err.message : "Falha ao consultar dados da API";
        const raw = typeof message === "string" ? message.trim() : "";
        if (raw.startsWith("{") && raw.includes("ANA_UPSTREAM_ERROR")) {
          toast.error("Consulta rejeitada pela fonte ANA. Tente outra estação.");
        } else {
          toast.error(message);
        }
      }
    } finally {
      setSeriesProgress(null);
    }
  };

  const isSubmitting = mode === "csv" ? loadingCsv : seriesMutation.isPending;
  const apiProgressPercent =
    seriesProgress && seriesProgress.totalWindows > 0
      ? Math.round((seriesProgress.completedWindows / seriesProgress.totalWindows) * 100)
      : 0;

  return (
    <div className="min-h-screen surface-soft flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-rain flex items-center justify-center shadow-elevated mb-4">
            <Droplets className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Análise de Chuvas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importe os dados pluviométricos para iniciar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-6 shadow-card space-y-5 border">
          <Tabs value={mode} onValueChange={(value) => setMode(value as "csv" | "api")}> 
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="csv">
                <Upload className="w-4 h-4 mr-1.5" /> CSV
              </TabsTrigger>
              <TabsTrigger value="api">
                <CloudDownload className="w-4 h-4 mr-1.5" /> API
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="local">Local da estação</Label>
                <Input
                  id="local"
                  placeholder="Ex.: Brasília - DF"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  autoFocus
                />
              </div>

              <Label htmlFor="file">Arquivo .csv (formato ANA)</Label>
              <label
                htmlFor="file"
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl px-4 py-8 cursor-pointer hover:border-primary hover:bg-primary-soft/40 transition-colors"
              >
                {file ? (
                  <>
                    <FileText className="w-6 h-6 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm">Clique para selecionar</span>
                    <span className="text-xs text-muted-foreground">.csv exportado do Hidroweb</span>
                  </>
                )}
                <input
                  id="file"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <Alert>
                <AlertTitle>Fluxo API por referência geográfica</AlertTitle>
                <AlertDescription>
                  Escolha a UF, depois a cidade e por fim a estação.
                </AlertDescription>
              </Alert>

              {ufsQuery.isError && (
                <Alert variant="destructive">
                  <AlertTitle>Falha ao carregar UFs</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>{getCatalogErrorMessage(ufsQuery.error)}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => ufsQuery.refetch()}>
                      Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>UF</Label>
                  <Select
                    value={ufSigla}
                    onValueChange={setUfSigla}
                    disabled={ufsQuery.isLoading || ufsQuery.isError || (ufsQuery.data ?? []).length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          ufsQuery.isLoading
                            ? "Carregando UFs..."
                            : ufsQuery.isError
                              ? "Erro ao carregar UFs"
                              : (ufsQuery.data ?? []).length === 0
                                ? "Nenhuma UF disponível"
                                : "Selecione a UF"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(ufsQuery.data ?? []).map((uf) => (
                        <SelectItem key={uf.sigla} value={uf.sigla}>
                          {uf.sigla} - {uf.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cidade de referência</Label>
                  <Popover open={municipioOpen} onOpenChange={setMunicipioOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={municipioOpen}
                        disabled={!ufSigla || municipiosQuery.isLoading}
                        className="w-full justify-between"
                      >
                        <span className="truncate text-left">
                          {selectedMunicipio
                            ? selectedMunicipio.nome
                            : !ufSigla
                              ? "Selecione a UF primeiro"
                              : municipiosQuery.isLoading
                                ? "Carregando cidades..."
                                : "Selecione a cidade ou digite para filtrar"}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          value={municipioSearch}
                          onValueChange={(value) => {
                            setMunicipioSearch(value);
                            setMunicipioPage(1);
                          }}
                          placeholder="Digite o nome da cidade"
                        />
                        <CommandList>
                          <CommandEmpty>
                            Nenhuma cidade encontrada.
                          </CommandEmpty>
                          <CommandGroup>
                            {visibleMunicipios.map((municipio) => (
                              <CommandItem
                                key={municipio.codigo}
                                value={municipio.nome}
                                onSelect={() => {
                                  setMunicipioCodigo(municipio.codigo);
                                  setMunicipioOpen(false);
                                  setMunicipioSearch("");
                                  setMunicipioPage(1);
                                }}
                              >
                                <span className="truncate">{municipio.nome}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                        <div className="flex items-center justify-between border-t px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={municipioPage === 1}
                            onClick={() => setMunicipioPage((current) => Math.max(1, current - 1))}
                            aria-label="Página anterior"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Página {municipioPage} de {Math.max(1, Math.ceil(filteredMunicipios.length / MUNICIPIOS_PAGE_SIZE))}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={filteredMunicipios.length <= visibleMunicipios.length}
                            onClick={() => setMunicipioPage((current) => current + 1)}
                            aria-label="Próxima página"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estação de referência</Label>
                <Select
                  value={stationCode}
                  onValueChange={setStationCode}
                  disabled={!municipioCodigo || estacoesQuery.isLoading || stations.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !municipioCodigo
                          ? "Selecione a cidade primeiro"
                          : estacoesQuery.isLoading
                            ? "Carregando estações..."
                            : stations.length === 0
                              ? "Nenhuma estação compatível encontrada"
                              : "Selecione a estação"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map((station) => (
                      <SelectItem key={station.codigo} value={station.codigo}>
                        {station.codigo} - {station.nome || "Sem nome"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeStation && (
                  <Badge variant="outline" className="w-fit rounded-md px-2 py-1 font-normal text-muted-foreground">
                    Período de referência: {selectedStationPeriod}
                  </Badge>
                )}
                {activeStation && latestStationDateQuery.isError && (
                  <p className="text-xs text-muted-foreground">
                    Não foi possível confirmar a última data real agora.
                  </p>
                )}

                {autoSelectedStation && (
                  <p className="text-xs text-muted-foreground">
                    Estação selecionada automaticamente: {autoSelectedStation.codigo}
                  </p>
                )}
                {municipioCodigo && stations.length === 0 && !estacoesQuery.isLoading && !estacoesQuery.isError && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma estação compatível foi encontrada para esta cidade.
                  </p>
                )}
                {municipioCodigo && estacoesQuery.isError && (
                  <p className="text-xs text-destructive">
                    Não foi possível carregar a lista de estações para esta cidade: {getCatalogErrorMessage(estacoesQuery.error)}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="analysis-years">Prazo de análise</Label>
            <div className="flex items-center gap-2">
              <Input
                id="analysis-years"
                type="number"
                min={1}
                max={80}
                value={analysisYears}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setAnalysisYears(Number.isFinite(next) ? next : DEFAULT_ANALYSIS_YEARS);
                }}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">anos</span>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === "api" && seriesProgress
                  ? ` Consultando API (${seriesProgress.completedWindows}/${seriesProgress.totalWindows})...`
                  : " Processando..."}
              </>
            ) : mode === "csv" ? (
              "Analisar dados"
            ) : (
              "Consultar API e analisar"
            )}
          </Button>

          {mode === "api" && isSubmitting && seriesProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progresso da consulta por janelas</span>
                <span>{seriesProgress.completedWindows}/{seriesProgress.totalWindows} ({apiProgressPercent}%)</span>
              </div>
              <Progress value={apiProgressPercent} aria-label="Progresso da consulta da API" />
            </div>
          )}
        </form>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Histórico considerado: prazo selecionado conforme dados disponíveis.
        </p>
      </div>
    </div>
  );
};
