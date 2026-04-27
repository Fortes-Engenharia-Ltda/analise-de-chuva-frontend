import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
import { toast } from "sonner";
import { parseCsvFile, type ParsedFile } from "@/lib/rainfall";
import { useHidroCatalog } from "@/hooks/useHidroCatalog";
import { useHidroSeries } from "@/hooks/useHidroSeries";
import { getConfiguredHidroApiBaseUrl, type HidroEstacao } from "@/services/hidroProxyApi";
import {
  DEFAULT_HIDRO_FEATURE,
  type HidroSeriesFeatureKey,
} from "@/services/hidroEndpointRegistry";

interface Props {
  onLoaded: (location: string, data: ParsedFile) => void;
}

const MUNICIPIOS_PAGE_SIZE = 75;

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

export const UploadScreen = ({ onLoaded }: Props) => {
  const [mode, setMode] = useState<"csv" | "api">("csv");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loadingCsv, setLoadingCsv] = useState(false);

  const feature: HidroSeriesFeatureKey = DEFAULT_HIDRO_FEATURE;
  const [ufSigla, setUfSigla] = useState("");
  const [municipioCodigo, setMunicipioCodigo] = useState("");
  const [municipioSearch, setMunicipioSearch] = useState("");
  const [municipioPage, setMunicipioPage] = useState(1);
  const [municipioOpen, setMunicipioOpen] = useState(false);
  const [stationCode, setStationCode] = useState("");
  const [stationCodeManual, setStationCodeManual] = useState("");

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

    return municipios.filter((municipio) => municipio.ufCodigo === selectedUf.codigo);
  }, [municipios, selectedUf?.codigo]);
  const selectedMunicipio = useMemo(
    () => municipiosDaUf.find((municipio) => municipio.codigo === municipioCodigo) ?? null,
    [municipiosDaUf, municipioCodigo],
  );
  const selectedStation = useMemo(
    () => stations.find((station) => station.codigo === stationCode) ?? null,
    [stationCode, stations],
  );
  const fallbackStation = useMemo<HidroEstacao | null>(() => {
    const codigo = stationCodeManual.trim();
    if (!codigo) return null;

    return {
      codigo,
      nome: "",
      municipioCodigo: municipioCodigo,
      municipioNome: selectedMunicipio?.nome ?? "",
      ufSigla,
      tipoMedicao: "1",
      nivelConsistencia: "2",
    };
  }, [municipioCodigo, municipioSearch, selectedMunicipio?.nome, stationCodeManual, ufSigla]);
  const activeStation = selectedStation ?? fallbackStation;
  const apiLocation = useMemo(() => {
    if (!activeStation) return "";
    const municipioNome = selectedMunicipio?.nome || activeStation.municipioNome;
    const uf = activeStation.ufSigla || ufSigla;
    const localBase = [municipioNome, uf].filter(Boolean).join(" - ");
    if (localBase) {
      return `${localBase} · Estação ${activeStation.codigo}`;
    }
    return `Estação ${activeStation.codigo}`;
  }, [activeStation, selectedMunicipio?.nome, ufSigla]);

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
    setStationCodeManual("");
    setMunicipioSearch("");
    setMunicipioPage(1);
    setMunicipioOpen(false);
  }, [ufSigla]);

  useEffect(() => {
    setStationCode("");
    setStationCodeManual("");
  }, [municipioCodigo]);

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
        onLoaded(location.trim(), data);
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
      const data = await seriesMutation.mutateAsync({
        feature,
        station: activeStation,
      });
      if (data.rows.length === 0) {
        toast.error("A API não retornou dados válidos para o período selecionado");
        return;
      }
      onLoaded(apiLocation, data);
      toast.success(`${data.rows.length} meses carregados via API`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Falha ao consultar dados da API";
      toast.error(message);
    }
  };

  const isSubmitting = mode === "csv" ? loadingCsv : seriesMutation.isPending;

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
                {stations.length > 0 ? (
                  <Select
                    value={stationCode}
                    onValueChange={(value) => {
                      setStationCode(value);
                      setStationCodeManual("");
                    }}
                    disabled={!municipioCodigo || estacoesQuery.isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !municipioCodigo
                            ? "Selecione a cidade primeiro"
                            : estacoesQuery.isLoading
                              ? "Carregando estações..."
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
                ) : (
                  <Input
                    value={stationCodeManual}
                    onChange={(e) => setStationCodeManual(e.target.value)}
                    placeholder={
                      !municipioCodigo
                        ? "Selecione a cidade primeiro"
                        : "Digite o código da estação"
                    }
                    disabled={!municipioCodigo}
                  />
                )}

                {autoSelectedStation && (
                  <p className="text-xs text-muted-foreground">
                    Estação selecionada automaticamente: {autoSelectedStation.codigo}
                  </p>
                )}
                {municipioCodigo && stations.length === 0 && !estacoesQuery.isLoading && !estacoesQuery.isError && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma estação foi encontrada para esta cidade. Informe o código manualmente.
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

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processando...
              </>
            ) : mode === "csv" ? (
              "Analisar dados"
            ) : (
              "Consultar API e analisar"
            )}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Histórico considerado: últimos 15 anos.
        </p>
      </div>
    </div>
  );
};
