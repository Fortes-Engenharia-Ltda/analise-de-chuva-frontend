import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IMPACT_COLORS, IMPACT_LABELS, type ImpactKey } from "@/lib/rainfall";

const ROWS: { key: ImpactKey; range: string; desc: string }[] = [
  { key: "none", range: "0 – 2 mm", desc: "Volume pluviométrico que não impacta a obra" },
  { key: "low", range: "2 – 10 mm", desc: "Volume pluviométrico com baixo impacto (pequenas interrupções pontuais)" },
  { key: "moderate", range: "10 – 15 mm", desc: "Volume que pode impactar ~0,5 dia de obra" },
  { key: "high", range: "15 – 20 mm", desc: "Volume que pode impactar 1 dia de obra" },
  { key: "severe", range: "> 20 mm", desc: "Volume que pode impactar 2 dias de obra ou mais (em obras com grande volume de terraplenagem, considerar 3 dias de impacto)" },
];

export const ImpactLegend = () => (
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" size="sm" className="gap-1.5 no-print">
        <Info className="w-3.5 h-3.5" />
        Critérios de impacto
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[380px] p-0">
      <div className="px-4 py-3 border-b">
        <h4 className="font-semibold text-sm">Classificação por precipitação diária</h4>
        <p className="text-xs text-muted-foreground mt-0.5">Faixa em mm/dia → impacto típico na obra</p>
      </div>
      <div className="divide-y">
        {ROWS.map((r) => (
          <div key={r.key} className="px-4 py-2.5 flex gap-3 items-start">
            <span
              className="mt-1 w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ background: IMPACT_COLORS[r.key] }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold tabular-nums">{r.range}</span>
                <span className="text-xs font-medium text-foreground">{IMPACT_LABELS[r.key]}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{r.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </PopoverContent>
  </Popover>
);
