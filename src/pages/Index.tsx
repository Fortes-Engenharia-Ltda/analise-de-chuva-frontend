import { useMemo, useRef, useState } from "react";
import { ArrowLeft, BarChart3, Database, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadScreen } from "@/components/UploadScreen";
import { MetadataBar } from "@/components/MetadataBar";
import { Dashboard, type DashboardHandle } from "@/components/Dashboard";
import { DataTables } from "@/components/DataTables";
import { ImpactLegend } from "@/components/ImpactLegend";
import { filterByYears, type ParsedFile } from "@/lib/rainfall";
import { toast } from "sonner";

const Index = () => {
  const [location, setLocation] = useState<string | null>(null);
  const [data, setData] = useState<ParsedFile | null>(null);
  const [analysisYears, setAnalysisYears] = useState(15);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<DashboardHandle>(null);

  const handleExport = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      await dashboardRef.current.exportPdf();
      toast.success("PDF gerado com sucesso");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF");
    } finally {
      setExporting(false);
    }
  };

  const filteredRows = useMemo(
    () => (data ? filterByYears(data.rows, analysisYears) : []),
    [data, analysisYears]
  );

  if (!data || !location) {
    return (
      <UploadScreen
        onLoaded={(loc, d, years) => {
          setLocation(loc);
          setData(d);
          setAnalysisYears(years);
        }}
      />
    );
  }

  const yearsRange =
    filteredRows.length > 0
      ? `${filteredRows[0].year}–${filteredRows[filteredRows.length - 1].year}`
      : "";

  return (
    <div className="min-h-screen surface-soft">
      <header className="border-b bg-card/60 backdrop-blur-sm sticky top-0 z-20 no-print">
        <div className="container max-w-7xl flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg gradient-rain flex items-center justify-center shadow-card">
              <BarChart3 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight leading-none">
                Análise de Chuva — {location}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredRows.length} meses · {yearsRange} · Estação {data.header.estacaoCodigo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ImpactLegend />
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 mr-1.5" />
              )}
              {exporting ? "Gerando…" : "Exportar PDF"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setData(null);
                setLocation(null);
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Nova análise
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-7xl py-6 space-y-4">
        <MetadataBar estacaoCodigo={data.header.estacaoCodigo} />

        <Tabs defaultValue="dashboard">
          <TabsList>
            <TabsTrigger value="dashboard">
              <BarChart3 className="w-4 h-4 mr-1.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="data">
              <Database className="w-4 h-4 mr-1.5" /> Dados
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-4">
            <Dashboard
              ref={dashboardRef}
              rows={filteredRows}
              location={location}
              estacaoCodigo={data.header.estacaoCodigo}
              yearsRange={yearsRange}
              analysisYears={analysisYears}
            />
          </TabsContent>
          <TabsContent value="data" className="mt-4">
            <DataTables rows={filteredRows} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="container max-w-7xl py-6 text-center text-xs text-muted-foreground">
        Histórico considerado: {analysisYears} anos · Dados ANA · Hidroweb
      </footer>
    </div>
  );
};

export default Index;
