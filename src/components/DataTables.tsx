import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  classifyImpact,
  IMPACT_COLORS,
  MONTH_NAMES,
  NIVEL_LABEL,
  type MonthRow,
} from "@/lib/rainfall";
import { cn } from "@/lib/utils";

interface Props {
  rows: MonthRow[];
}

const fmt = (n: number, d = 1) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export const DataTables = ({ rows }: Props) => {
  // Mais recente primeiro
  const sorted = useMemo(() => [...rows].sort((a, b) => b.date.getTime() - a.date.getTime()), [rows]);
  const [selectedKey, setSelectedKey] = useState<string | null>(
    sorted[0] ? `${sorted[0].year}-${sorted[0].month}-${sorted[0].nivelConsistencia}` : null
  );

  const selected = sorted.find(
    (r) => `${r.year}-${r.month}-${r.nivelConsistencia}` === selectedKey
  );

  const daysInMonth = selected ? new Date(selected.year, selected.month, 0).getDate() : 0;
  const dailyData = selected
    ? Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        value: selected.days[i],
      }))
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-5 animate-fade-in">
      {/* Tabela mensal */}
      <div className="lg:col-span-3 bg-card border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold">Resumo mensal</h3>
          <p className="text-xs text-muted-foreground">
            Selecione uma linha para ver o detalhamento diário
          </p>
        </div>
        <ScrollArea className="h-[560px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead>Estação</TableHead>
                <TableHead>Consistência</TableHead>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Média de chuva (mm/dia)</TableHead>
                <TableHead className="text-right">Dias chuvosos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => {
                const key = `${r.year}-${r.month}-${r.nivelConsistencia}`;
                const validCount = r.days.filter((v) => v !== null).length;
                const mean = validCount ? r.totalRain / validCount : 0;
                const isSel = key === selectedKey;
                return (
                  <TableRow
                    key={key + r.date.toISOString()}
                    onClick={() => setSelectedKey(key)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSel && "bg-primary-soft hover:bg-primary-soft"
                    )}
                  >
                    <TableCell className="font-mono text-xs">{r.estacao}</TableCell>
                    <TableCell>
                      <Badge variant={r.nivelConsistencia === "2" ? "default" : "secondary"} className="text-[10px]">
                        {NIVEL_LABEL[r.nivelConsistencia] ?? r.nivelConsistencia}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {MONTH_NAMES[r.month - 1]}/{r.year}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(mean, 2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.rainyDays}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Detalhamento diário */}
      <div className="lg:col-span-2 bg-card border rounded-2xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold">
            Detalhamento diário {selected && `· ${MONTH_NAMES[selected.month - 1]}/${selected.year}`}
          </h3>
          <p className="text-xs text-muted-foreground">Volume de chuva (mm) por dia</p>
        </div>
        <ScrollArea className="h-[560px]">
          {selected ? (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead className="text-right">Volume (mm)</TableHead>
                  <TableHead className="text-right">Categoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyData.map((d) => {
                  const cat = d.value !== null ? classifyImpact(d.value) : null;
                  return (
                    <TableRow key={d.day}>
                      <TableCell className="tabular-nums">{String(d.day).padStart(2, "0")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.value === null ? <span className="text-muted-foreground">—</span> : fmt(d.value, 1)}
                      </TableCell>
                      <TableCell className="text-right">
                        {cat && (
                          <span
                            className="inline-flex items-center gap-1.5 text-[11px]"
                            style={{ color: IMPACT_COLORS[cat] }}
                          >
                            <span className="w-2 h-2 rounded-full" style={{ background: IMPACT_COLORS[cat] }} />
                            {cat === "none" && "Sem impacto"}
                            {cat === "low" && "Baixo"}
                            {cat === "moderate" && "Moderado"}
                            {cat === "high" && "Alto"}
                            {cat === "severe" && "Severo"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Selecione um mês na tabela ao lado.
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
