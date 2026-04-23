import { useEffect, useMemo, useState } from "react";
import { CloudDownload, Droplets, FileText, Loader2, Upload } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { parseCsvFile, type ParsedFile } from "@/lib/rainfall";
import { useHidroCatalog } from "@/hooks/useHidroCatalog";
import { useHidroSeries } from "@/hooks/useHidroSeries";
import { getConfiguredHidroApiBaseUrl } from "@/services/hidroProxyApi";
import {
  DEFAULT_HIDRO_FEATURE,
  HIDRO_SERIES_FEATURES,
  HIDRO_SERIES_LABELS,
  type HidroSeriesFeatureKey,
} from "@/services/hidroEndpointRegistry";

interface Props {
  onLoaded: (location: string, data: ParsedFile) => void;
}

export const UploadScreen = ({ onLoaded }: Props) => {
  const [mode, setMode] = useState<"csv" | "api">("csv");
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loadingCsv, setLoadingCsv] = useState(false);

  const [feature, setFeature] = useState<HidroSeriesFeatureKey>(DEFAULT_HIDRO_FEATURE);
  const [ufSigla, setUfSigla] = useState("");
  const [municipioCodigo, setMunicipioCodigo] = useState("");
  const [stationCode, setStationCode] = useState("");

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
  const selectedMunicipio = useMemo(
    () => municipios.find((municipio) => municipio.codigo === municipioCodigo) ?? null,
    [municipios, municipioCodigo],
  );
  const selectedStation = useMemo(
    () => stations.find((station) => station.codigo === stationCode) ?? null,
    [stationCode, stations],
  );
  const apiLocation = useMemo(() => {
    if (!selectedStation) return "";
    const municipioNome = selectedMunicipio?.nome || selectedStation.municipioNome;
    const uf = selectedStation.ufSigla || ufSigla;
    const localBase = [municipioNome, uf].filter(Boolean).join(" - ");
    if (localBase) {
      return `${localBase} · Estação ${selectedStation.codigo}`;
    }
    return `Estação ${selectedStation.codigo}`;
  }, [selectedMunicipio?.nome, selectedStation, ufSigla]);

  useEffect(() => {
    setMunicipioCodigo("");
    setStationCode("");
  }, [ufSigla]);

  useEffect(() => {
    setStationCode("");
  }, [feature, municipioCodigo]);

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
    if (!stationCode) return toast.error("Selecione a estação de referência");
    if (!selectedStation) return toast.error("Estação selecionada inválida");

    try {
      const data = await seriesMutation.mutateAsync({
        feature,
        station: selectedStation,
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
                  Escolha a funcionalidade, a cidade e depois a estação. Quando existir apenas uma
                  estação para a cidade, a seleção acontece automaticamente.
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Base da API: {apiBaseUrl || "não configurada"}
              </div>

              {ufsQuery.isError && (
                <Alert variant="destructive">
                  <AlertTitle>Falha ao carregar UFs</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>
                      {ufsQuery.error instanceof Error
                        ? ufsQuery.error.message
                        : "Não foi possível consultar as UFs na API."}
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={() => ufsQuery.refetch()}>
                      Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Funcionalidade da API</Label>
                <Select
                  value={feature}
                  onValueChange={(value) => setFeature(value as HidroSeriesFeatureKey)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a funcionalidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {HIDRO_SERIES_FEATURES.map((featureKey) => (
                      <SelectItem key={featureKey} value={featureKey}>
                        {HIDRO_SERIES_LABELS[featureKey]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  <Select
                    value={municipioCodigo}
                    onValueChange={setMunicipioCodigo}
                    disabled={!ufSigla || municipiosQuery.isLoading}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !ufSigla
                            ? "Selecione a UF primeiro"
                            : municipiosQuery.isLoading
                              ? "Carregando cidades..."
                              : "Selecione a cidade"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(municipiosQuery.data ?? []).map((municipio) => (
                        <SelectItem key={municipio.codigo} value={municipio.codigo}>
                          {municipio.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                              ? "Nenhuma estação encontrada"
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

                {autoSelectedStation && (
                  <p className="text-xs text-muted-foreground">
                    Estação selecionada automaticamente: {autoSelectedStation.codigo}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Local definido automaticamente pela API: {apiLocation || "selecione UF, cidade e estação"}
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
