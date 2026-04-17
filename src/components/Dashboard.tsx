import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Gauge } from "lucide-react";
import {
  aggregate,
  DEFAULT_WEIGHTS,
  IMPACT_COLORS,
  IMPACT_LABELS,
  IMPACT_RANGES,
  ImpactKey,
  impactByMonthAvg,
  type MonthRow,
  type Weights,
} from "@/lib/rainfall";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

interface Props {
  rows: MonthRow[];
}

// Arredonda para cima em 1 casa decimal (ceiling ao próximo 0,1)
const ceil1 = (n: number) => Math.ceil(n * 10) / 10;
const fmt = (n: number, d = 1) => n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtCeil = (n: number) => fmt(ceil1(n), 1);
const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export const Dashboard = ({ rows }: Props) => {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);

  const monthly = useMemo(() => impactByMonthAvg(rows), [rows]);
  const agg = useMemo(() => aggregate(monthly, weights), [monthly, weights]);

  const impactedKeys: ImpactKey[] = ["low", "moderate", "high", "severe"];
  const pieData = impactedKeys.map((k) => ({
    name: IMPACT_LABELS[k],
    value: agg.totals[k],
    key: k,
  })).filter((d) => d.value > 0.001);

  const totalsData = impactedKeys.map((k) => ({
    name: IMPACT_LABELS[k],
    key: k,
    dias: agg.totals[k],
    ponderado: k === "none" ? 0 : agg.weighted[k as "low" | "moderate" | "high" | "severe"],
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Médias mensais (chuvosos e com impacto) por mês */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <h3 className="font-semibold">Média de dias chuvosos por mês</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Valores arredondados para cima (ceil em 0,1)
          </p>
          <div className="grid grid-cols-6 gap-2">
            {monthly.map((m) => (
              <div key={m.month} className="rounded-xl border bg-primary-soft/40 p-2.5 text-center">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                  {m.monthLabel}
                </p>
                <p className="text-lg font-semibold tabular-nums text-primary">{fmtCeil(m.rainy)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <h3 className="font-semibold">Média de dias com impacto por mês</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Exclui dias sem impacto (&lt; 2 mm)
          </p>
          <div className="grid grid-cols-6 gap-2">
            {monthly.map((m) => {
              const impact = m.low + m.moderate + m.high + m.severe;
              return (
                <div key={m.month} className="rounded-xl border bg-secondary-soft/40 p-2.5 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                    {m.monthLabel}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-secondary">{fmtCeil(impact)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Totais por categoria + Ponderado por categoria */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {impactedKeys.map((k) => (
          <div key={`tot-${k}`} className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: IMPACT_COLORS[k] }} />
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                {IMPACT_LABELS[k]}
              </p>
            </div>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {fmtCeil(agg.totals[k])}
              <span className="text-base text-muted-foreground font-normal ml-1">dias</span>
            </p>
            <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Gauge className="w-3 h-3" /> Ponderado
              </span>
              <span className="font-medium tabular-nums">
                {fmtCeil(agg.weighted[k as "low" | "moderate" | "high" | "severe"])} dias
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bar mensal stacked */}
        <div className="lg:col-span-2 bg-card border rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Média de dias chuvosos por mês</h3>
              <p className="text-xs text-muted-foreground">Empilhado por categoria de impacto</p>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer>
              <BarChart data={monthly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="monthLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number, name: string) => [fmt(v), name]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="low" stackId="a" name="Baixo" fill={IMPACT_COLORS.low} radius={[0, 0, 0, 0]} />
                <Bar dataKey="moderate" stackId="a" name="Moderado" fill={IMPACT_COLORS.moderate} />
                <Bar dataKey="high" stackId="a" name="Alto" fill={IMPACT_COLORS.high} />
                <Bar dataKey="severe" stackId="a" name="Severo" fill={IMPACT_COLORS.severe} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie distribuição */}
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <h3 className="font-semibold">Distribuição por tipologia</h3>
          <p className="text-xs text-muted-foreground mb-2">% sobre dias chuvosos</p>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {pieData.map((d) => (
                    <Cell key={d.key} fill={IMPACT_COLORS[d.key]} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => fmt(v)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2">
            {impactedKeys.map((k) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: IMPACT_COLORS[k] }} />
                  {IMPACT_LABELS[k]}
                </span>
                <span className="font-medium tabular-nums">{pct(agg.percentages[k])}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Total de dias por categoria + Pesos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-card border rounded-2xl p-5 shadow-card">
          <h3 className="font-semibold">Total de dias impactados (anual) e ponderação</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Comparação entre dias brutos e dias ponderados por peso
          </p>
          <div className="h-[260px]">
            <ResponsiveContainer>
              <BarChart data={totalsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => fmt(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="dias" name="Dias (média)" fill="hsl(var(--primary) / 0.85)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="ponderado" name="Ponderado" fill="hsl(var(--secondary) / 0.85)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold">Pesos por categoria</h3>
            <Badge variant="outline" className="text-[10px]">Editável</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Ajuste a importância de cada faixa</p>
          <div className="space-y-4">
            {(["low", "moderate", "high", "severe"] as const).map((k) => (
              <div key={k}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: IMPACT_COLORS[k] }} />
                    {IMPACT_LABELS[k]}
                    <span className="text-muted-foreground">({IMPACT_RANGES[k]})</span>
                  </span>
                  <span className="text-xs font-medium tabular-nums">{Math.round(weights[k] * 100)}%</span>
                </div>
                <Slider
                  value={[weights[k] * 100]}
                  onValueChange={([v]) => setWeights({ ...weights, [k]: v / 100 })}
                  min={0}
                  max={200}
                  step={5}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Indicadores de improdutividade */}
      <div className="bg-card border rounded-2xl p-5 shadow-card">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="w-4 h-4 text-secondary" />
          <h3 className="font-semibold">Improdutividade considerada (anual)</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Calculada sobre os dias ponderados, dividida por 365 dias
        </p>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Obras cobertas",
              value: agg.unprodCovered,
              hint: "Severo / 365",
            },
            {
              label: "Fora de áreas industriais",
              value: agg.unprodOutsideIndustrial,
              hint: "(Mod + Alto + Sev) / 365",
            },
            {
              label: "Comuns em áreas industriais",
              value: agg.unprodCommonIndustrial,
              hint: "(Bx + Mod + Alto + Sev) / 365",
            },
            {
              label: "Alto volume de terraplenagem",
              value: agg.unprodEarthworks,
              hint: "(Bx + Mod + Alto + Sev) / 365",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">
                {pct(item.value * 100)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 font-mono">{item.hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
