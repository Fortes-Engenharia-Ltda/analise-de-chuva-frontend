import { useState } from "react";
import { Upload, Droplets, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseCsvFile, type ParsedFile } from "@/lib/rainfall";

interface Props {
  onLoaded: (location: string, data: ParsedFile) => void;
}

export const UploadScreen = ({ onLoaded }: Props) => {
  const [location, setLocation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return toast.error("Informe o local");
    if (!file) return toast.error("Selecione um arquivo .csv");
    setLoading(true);
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
      setLoading(false);
    }
  };

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
          <div className="space-y-2">
            <Label htmlFor="local">Local da estação</Label>
            <Input
              id="local"
              placeholder="Ex.: Brasília – DF"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
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
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Processando..." : "Analisar dados"}
          </Button>
        </form>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Histórico considerado: últimos 15 anos.
        </p>
      </div>
    </div>
  );
};
