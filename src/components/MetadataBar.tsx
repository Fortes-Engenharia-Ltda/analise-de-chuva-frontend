import { Info } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

interface Props {
  estacaoCodigo: string;
}

export const MetadataBar = ({ estacaoCodigo }: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-muted/40 border border-border rounded-lg text-xs">
        <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">
          <span className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5" />
            Fonte: ANA – Sistema de Informações Hidrológicas · Estação {estacaoCodigo || "—"}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 grid md:grid-cols-2 gap-3 text-muted-foreground leading-relaxed">
            <div>
              <p className="font-medium text-foreground mb-1">Agência Nacional de Águas – ANA</p>
              <p>Superintendência de Gestão da Rede Hidrometeorológica – SGH</p>
              <p>Sistema de Informações Hidrológicas – Versão WEB</p>
              <p>Fone: (61) 2109-5242 · hidro@ana.gov.br</p>
            </div>
            <div>
              <p><span className="font-medium text-foreground">NivelConsistencia:</span> 1 = Bruto, 2 = Consistido</p>
              <p><span className="font-medium text-foreground">TipoMedicaoChuvas:</span> 1 = Pluviômetro, 2 = Pluviógrafo, 3 = Data logger</p>
              <p><span className="font-medium text-foreground">Status:</span> 0 = Branco, 1 = Real, 2 = Estimado, 3 = Duvidoso, 4 = Acumulado</p>
              <p className="mt-1"><span className="font-medium text-foreground">Restrição:</span> Código da Estação {estacaoCodigo || "—"}</p>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
