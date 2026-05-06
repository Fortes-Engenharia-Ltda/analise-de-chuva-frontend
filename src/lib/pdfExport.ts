import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import {
  IMPACT_LABELS,
  IMPACT_RANGES,
  type AggregatedImpact,
  type ImpactKey,
  type ImpactPerMonth,
  type Weights,
} from "@/lib/rainfall";

// === Paleta (alinhada ao design system, em RGB para o jsPDF) ===
const C = {
  primary: [22, 117, 211] as [number, number, number],          // azul chuva
  primarySoft: [232, 244, 254] as [number, number, number],
  secondary: [37, 168, 122] as [number, number, number],        // verde
  text: [18, 30, 51] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  border: [216, 225, 235] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  // Cores das categorias (HSL → RGB aproximado)
  impactNone: [171, 184, 199] as [number, number, number],
  impactLow: [56, 178, 211] as [number, number, number],
  impactModerate: [22, 117, 211] as [number, number, number],
  impactHigh: [240, 158, 51] as [number, number, number],
  impactSevere: [222, 73, 73] as [number, number, number],
};

const IMPACT_RGB: Record<ImpactKey, [number, number, number]> = {
  none: C.impactNone,
  low: C.impactLow,
  moderate: C.impactModerate,
  high: C.impactHigh,
  severe: C.impactSevere,
};

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const IMPACTED_KEYS: ImpactKey[] = ["low", "moderate", "high", "severe"];

const round = (n: number) => (n > 0 ? Math.ceil(n) : 0).toLocaleString("pt-BR");
const fmt1 = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n: number) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

// Largura útil da página A4 em mm com margens 14mm
const PAGE = { w: 210, h: 297, margin: 14 };
const CONTENT_W = PAGE.w - PAGE.margin * 2;

interface ExportArgs {
  location: string;
  estacaoCodigo: string;
  monthsCount: number;
  yearsRange: string;
  historyPeriodLabel: string;
  monthly: ImpactPerMonth[];
  agg: AggregatedImpact;
  weights: Weights;
  earthworksSevereShare: number;
  chartContainer?: HTMLElement | null;
}

interface ChartSummary {
  head: string[];
  body: string[][];
  note?: string;
  impactOrder?: ImpactKey[];
  rowIntensity?: number[];
}

const drawHeader = (doc: jsPDF, title: string, subtitle: string) => {
  // Faixa azul superior
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, PAGE.w, 28, "F");

  doc.setTextColor(...C.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, PAGE.margin, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(subtitle, PAGE.margin, 20);

  // Data no canto direito
  const dateStr = new Date().toLocaleDateString("pt-BR");
  doc.setFontSize(8);
  doc.text(`Emitido em ${dateStr}`, PAGE.w - PAGE.margin, 20, { align: "right" });
};

const drawFooter = (doc: jsPDF) => {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.2);
    doc.line(PAGE.margin, PAGE.h - 12, PAGE.w - PAGE.margin, PAGE.h - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text("Análise de Chuva · Dados ANA / Hidroweb", PAGE.margin, PAGE.h - 7);
    doc.text(`Página ${i} de ${pageCount}`, PAGE.w - PAGE.margin, PAGE.h - 7, { align: "right" });
  }
};

const sectionTitle = (doc: jsPDF, y: number, label: string) => {
  doc.setFillColor(...C.primarySoft);
  doc.rect(PAGE.margin, y, CONTENT_W, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.primary);
  doc.text(label.toUpperCase(), PAGE.margin + 3, y + 5.5);
  return y + 12;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const mixColor = (
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] => {
  const p = clamp01(t);
  return [
    Math.round(a[0] + (b[0] - a[0]) * p),
    Math.round(a[1] + (b[1] - a[1]) * p),
    Math.round(a[2] + (b[2] - a[2]) * p),
  ];
};

const buildChartSummary = (
  type: "monthly" | "distribution" | "totals",
  args: ExportArgs
): ChartSummary => {
  if (type === "monthly") {
    const rainyPerMonth = args.monthly.map((m) => m.rainy);

    return {
      head: ["Mês", "Dias chuvosos médios", "Alta severidade (alto + severo)"],
      body: args.monthly.map((m) => [
        MONTHS_FULL[m.month - 1],
        `${fmt1(m.rainy)} dias`,
        `${fmt1(m.high + m.severe)} dias`,
      ]),
      rowIntensity: rainyPerMonth,
    };
  }

  if (type === "distribution") {
    return {
      head: ["Categoria", "Faixa", "Dias/ano", "Participação"],
      body: IMPACTED_KEYS.map((k) => [
        IMPACT_LABELS[k],
        IMPACT_RANGES[k],
        fmt1(args.agg.totals[k]),
        pct(args.agg.percentages[k]),
      ]),
      impactOrder: IMPACTED_KEYS,
    };
  }

  return {
    head: ["Categoria", "Dias (média)", "Ponderado", "Peso"],
    body: IMPACTED_KEYS.map((k) => [
      IMPACT_LABELS[k],
      fmt1(args.agg.totals[k]),
      fmt1(args.agg.weighted[k]),
      `${Math.round(args.weights[k] * 100)}%`,
    ]),
    impactOrder: IMPACTED_KEYS,
  };
};

const estimateSummaryHeight = (rowsCount: number, hasNote: boolean) => {
  const tableHeight = 12 + rowsCount * 6;
  return tableHeight + (hasNote ? 5 : 0);
};

// ============================================================
//  PÁGINA 1 — Capa + Critérios + Médias mensais
// ============================================================
const renderCover = (doc: jsPDF, args: ExportArgs) => {
  drawHeader(
    doc,
    `Análise de Chuva — ${args.location}`,
    `Estação ${args.estacaoCodigo} · ${args.monthsCount} meses · ${args.yearsRange}`
  );

  let y = 38;

  // Box de resumo
  doc.setDrawColor(...C.border);
  doc.setFillColor(...C.white);
  doc.roundedRect(PAGE.margin, y, CONTENT_W, 26, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...C.text);
  doc.text("Resumo da análise", PAGE.margin + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.text(
    `Histórico considerado: ${args.historyPeriodLabel} (${args.monthsCount} meses).`,
    PAGE.margin + 4, y + 14
  );
  doc.text(
    "Valores mensais maiores que zero são arredondados para cima; totais usam médias precisas.",
    PAGE.margin + 4, y + 20
  );
  y += 32;

  // === Critérios de impacto ===
  y = sectionTitle(doc, y, "Critérios de classificação");

  const critRows: [string, string, string][] = [
    ["0 – 2 mm", "Sem impacto", "Não impacta a obra"],
    ["2 – 10 mm", "Baixo impacto", "Pequenas interrupções pontuais"],
    ["10 – 15 mm", "Impacto moderado", "Pode impactar ~0,5 dia de obra"],
    ["15 – 20 mm", "Impacto alto", "Pode impactar 1 dia de obra"],
    ["> 20 mm", "Impacto severo", "2+ dias de obra (3 dias em terraplenagem)"],
  ];
  const impactKeysOrder: ImpactKey[] = ["none", "low", "moderate", "high", "severe"];

  autoTable(doc, {
    startY: y,
    head: [["Precipitação diária", "Categoria", "Impacto típico"]],
    body: critRows,
    theme: "grid",
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    bodyStyles: { fontSize: 9, textColor: C.text },
    columnStyles: {
      0: { halign: "center", cellWidth: 38, fontStyle: "bold" },
      1: { halign: "left", cellWidth: 45 },
      2: { halign: "left" },
    },
    margin: { left: PAGE.margin, right: PAGE.margin },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const key = impactKeysOrder[data.row.index];
        data.cell.styles.textColor = IMPACT_RGB[key];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // === Média mensal de dias chuvosos ===
  y = sectionTitle(doc, y, "Média de dias chuvosos por mês");

  const rainyRows = args.monthly.map((m, i) => [MONTHS_FULL[i], `${round(m.rainy)} dias`]);
  // Quebra em 2 colunas (jan-jun | jul-dez)
  const half: any[] = [];
  for (let i = 0; i < 6; i++) {
    half.push([rainyRows[i][0], rainyRows[i][1], rainyRows[i + 6][0], rainyRows[i + 6][1]]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Mês", "Dias chuvosos", "Mês", "Dias chuvosos"]],
    body: half,
    theme: "striped",
    headStyles: { fillColor: C.primary, textColor: C.white, fontSize: 9, halign: "center" },
    bodyStyles: { fontSize: 9, halign: "center", textColor: C.text },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });
};

// ============================================================
//  PÁGINA 2 — Tabela média/impacto por mês
// ============================================================
const renderMonthlyImpact = (doc: jsPDF, args: ExportArgs) => {
  doc.addPage();
  drawHeader(doc, `Análise de Chuva — ${args.location}`, "Média de dias por categoria de impacto");

  let y = 38;
  y = sectionTitle(doc, y, "Média de dias / impacto por mês");

  const keys: ImpactKey[] = ["none", "low", "moderate", "high", "severe"];
  const head = [["Mês", ...keys.map((k) => IMPACT_LABELS[k])]];
  const body = args.monthly.map((m, i) => [
    MONTHS_FULL[i],
    ...keys.map((k) => `${round(m[k])} dias`),
  ]);
  const totals = [
    "Total de dias impactados",
    "—",
    ...(["low", "moderate", "high", "severe"] as ImpactKey[]).map(
      (k) => `${fmt1(args.agg.totals[k])} dias`
    ),
  ];

  autoTable(doc, {
    startY: y,
    head,
    body,
    foot: [totals],
    theme: "grid",
    headStyles: {
      fillColor: C.primary,
      textColor: C.white,
      fontSize: 8.5,
      halign: "center",
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 9, halign: "center", textColor: C.text },
    footStyles: {
      fillColor: C.primarySoft,
      textColor: C.primary,
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
    },
    columnStyles: {
      0: { halign: "left", fontStyle: "bold", textColor: C.text },
    },
    margin: { left: PAGE.margin, right: PAGE.margin },
  });

  y = (doc as any).lastAutoTable.finalY + 3;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(
    `*Médias do histórico selecionado (${args.historyPeriodLabel}). Valores mensais maiores que zero são arredondados para cima; totais usam médias precisas.`,
    PAGE.margin, y + 3
  );
  y += 10;

  // === Distribuição percentual ===
  y = sectionTitle(doc, y, "Distribuição por tipologia (% sobre dias chuvosos)");

  const pctRows = (["low", "moderate", "high", "severe"] as ImpactKey[]).map((k) => [
    IMPACT_LABELS[k],
    IMPACT_RANGES[k],
    pct(args.agg.percentages[k]),
    `${fmt1(args.agg.totals[k])} dias/ano`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Categoria", "Faixa", "% chuvosos", "Total anual"]],
    body: pctRows,
    theme: "grid",
    headStyles: { fillColor: C.primary, textColor: C.white, fontSize: 9, halign: "center" },
    bodyStyles: { fontSize: 9, textColor: C.text },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "center", fontStyle: "bold" },
      3: { halign: "center" },
    },
    margin: { left: PAGE.margin, right: PAGE.margin },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const order: ImpactKey[] = ["low", "moderate", "high", "severe"];
        data.cell.styles.textColor = IMPACT_RGB[order[data.row.index]];
      }
    },
  });
};

const drawUnproductivityCards = (doc: jsPDF, args: ExportArgs, y: number) => {
  const items = [
    { label: "Obras cobertas", value: args.agg.unprodCovered, hint: "Severo / 365" },
    { label: "Fora de áreas industriais", value: args.agg.unprodOutsideIndustrial, hint: "(Mod + Alto + Sev) / 365" },
    { label: "Comuns em áreas industriais", value: args.agg.unprodCommonIndustrial, hint: "(Bx + Mod + Alto + Sev) / 365" },
    {
      label: "Alto volume de terraplenagem",
      value: args.agg.unprodEarthworks,
      hint: `(Bx + Mod + Alto + Sev x ${Math.round(args.earthworksSevereShare * 100)}%) / 365`,
    },
  ];

  // 2 cards por linha (largura/2 - gap)
  const gap = 4;
  const cardW = (CONTENT_W - gap) / 2;
  const cardH = 28;
  items.forEach((it, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = PAGE.margin + col * (cardW + gap);
    const cy = y + row * (cardH + gap);

    doc.setFillColor(...C.white);
    doc.setDrawColor(...C.border);
    doc.roundedRect(x, cy, cardW, cardH, 2, 2, "FD");

    // barra lateral colorida
    doc.setFillColor(...C.secondary);
    doc.rect(x, cy, 2, cardH, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text(it.label, x + 6, cy + 7);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...C.text);
    doc.text(pct(it.value * 100), x + 6, cy + 18);

    doc.setFont("courier", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...C.muted);
    doc.text(it.hint, x + 6, cy + 24);
  });
};

// ============================================================
//  PÁGINA 3 — Pesos + Gráfico de ponderação + Improdutividades
// ============================================================
const renderUnproductivity = async (doc: jsPDF, args: ExportArgs) => {
  doc.addPage();
  drawHeader(doc, `Análise de Chuva — ${args.location}`, "Ponderação e improdutividade considerada");

  let y = 38;

  // === Pesos ===
  y = sectionTitle(doc, y, "Pesos por categoria (configuração atual)");

  const weightRows = (["low", "moderate", "high", "severe"] as const).map((k) => [
    IMPACT_LABELS[k],
    IMPACT_RANGES[k],
    `${Math.round(args.weights[k] * 100)}%`,
    `${fmt1(args.agg.weighted[k])} dias`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Categoria", "Faixa", "Peso", "Dias ponderados"]],
    body: weightRows,
    theme: "grid",
    headStyles: { fillColor: C.primary, textColor: C.white, fontSize: 9, halign: "center" },
    bodyStyles: { fontSize: 9, textColor: C.text },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { halign: "center" },
      2: { halign: "center", fontStyle: "bold" },
      3: { halign: "center" },
    },
    margin: { left: PAGE.margin, right: PAGE.margin },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const order = ["low", "moderate", "high", "severe"] as ImpactKey[];
        data.cell.styles.textColor = IMPACT_RGB[order[data.row.index]];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // === Gráfico de ponderação (3º gráfico do dashboard) ===
  const totalsChartEl = args.chartContainer
    ? args.chartContainer.querySelectorAll<HTMLElement>(".pdf-chart")[2]
    : null;

  if (totalsChartEl) {
    const canvas = await html2canvas(totalsChartEl, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const ratio = canvas.height / canvas.width;
    const summary = buildChartSummary("totals", args);

    let imgW = CONTENT_W * 0.8;
    let imgH = imgW * ratio;
    let summaryH = estimateSummaryHeight(summary.body.length, false);
    let blockH = imgH + summaryH + 10;

    // Reduz a imagem para manter o gráfico + tabela na mesma página dos pesos.
    while (y + blockH > PAGE.h - 18 && imgW > CONTENT_W * 0.62) {
      imgW -= 6;
      imgH = imgW * ratio;
      summaryH = estimateSummaryHeight(summary.body.length, false);
      blockH = imgH + summaryH + 10;
    }

    const imgX = PAGE.margin + (CONTENT_W - imgW) / 2;
    doc.addImage(imgData, "PNG", imgX, y, imgW, imgH);
    y += imgH + 2;

    autoTable(doc, {
      startY: y,
      head: [summary.head],
      body: summary.body,
      theme: "grid",
      headStyles: {
        fillColor: C.primarySoft,
        textColor: C.primary,
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: C.text,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: "bold" },
      },
      margin: { left: PAGE.margin, right: PAGE.margin },
      didParseCell: (data) => {
        if (
          data.section === "body" &&
          data.column.index === 0 &&
          summary.impactOrder &&
          summary.impactOrder[data.row.index]
        ) {
          data.cell.styles.textColor = IMPACT_RGB[summary.impactOrder[data.row.index]];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  const unprodSectionMinH = 12 + 2 * 28 + 4 + 4;
  if (y + unprodSectionMinH > PAGE.h - 18) {
    doc.addPage();
    drawHeader(doc, `Análise de Chuva — ${args.location}`, "Ponderação e improdutividade considerada");
    y = 38;
  }

  // === Improdutividade ===
  y = sectionTitle(doc, y, "Improdutividade considerada (anual)");

  drawUnproductivityCards(doc, args, y);
};

// ============================================================
//  PÁGINA 4 — Gráficos (capturados como imagem)
// ============================================================
const renderCharts = async (doc: jsPDF, args: ExportArgs) => {
  if (!args.chartContainer) return;

  // Captura cada bloco com classe .pdf-chart dentro do container
  const chartEls = Array.from(
    args.chartContainer.querySelectorAll<HTMLElement>(".pdf-chart")
  ).slice(0, 2);
  if (chartEls.length === 0) return;

  const addChartsPage = (continued = false) => {
    doc.addPage();
    drawHeader(doc, `Análise de Chuva — ${args.location}`, "Visualizações gráficas");
    return sectionTitle(
      doc,
      38,
      continued ? "Gráficos do dashboard (continuação)" : "Gráficos do dashboard"
    );
  };

  for (const [index, el] of chartEls.entries()) {
    let y = addChartsPage(index > 0);

    const canvas = await html2canvas(el, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const chartType = index === 0 ? "monthly" : "distribution";
    const summary = buildChartSummary(chartType, args);

    const imgData = canvas.toDataURL("image/png");
    const ratio = canvas.height / canvas.width;
    let imgW = chartType === "distribution" ? CONTENT_W * 0.84 : CONTENT_W;
    let imgH = imgW * ratio;
    let summaryH = estimateSummaryHeight(summary.body.length, Boolean(summary.note));
    let blockH = imgH + summaryH + 8;

    // Ajusta tamanho para evitar quebra da tabela para outra página.
    while (y + blockH > PAGE.h - 18 && imgW > CONTENT_W * 0.64) {
      imgW -= 6;
      imgH = imgW * ratio;
      summaryH = estimateSummaryHeight(summary.body.length, Boolean(summary.note));
      blockH = imgH + summaryH + 8;
    }

    const imgX = PAGE.margin + (CONTENT_W - imgW) / 2;

    doc.addImage(imgData, "PNG", imgX, y, imgW, imgH);
    y += imgH + 2;

    autoTable(doc, {
      startY: y,
      head: [summary.head],
      body: summary.body,
      theme: "grid",
      headStyles: {
        fillColor: C.primarySoft,
        textColor: C.primary,
        fontSize: 8,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: C.text,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: "bold" },
      },
      margin: { left: PAGE.margin, right: PAGE.margin },
      didParseCell: (data) => {
        if (
          data.section === "body" &&
          summary.rowIntensity &&
          summary.rowIntensity[data.row.index] !== undefined
        ) {
          const values = summary.rowIntensity;
          const min = Math.min(...values);
          const max = Math.max(...values);
          const val = summary.rowIntensity[data.row.index];
          const t = max - min > 0 ? (val - min) / (max - min) : 0;
          data.cell.styles.fillColor = mixColor(C.primarySoft, C.primary, t);
          data.cell.styles.textColor = t > 0.72 ? C.white : C.text;
          data.cell.styles.fontStyle = "bold";
        }

        if (
          data.section === "body" &&
          data.column.index === 0 &&
          summary.impactOrder &&
          summary.impactOrder[data.row.index]
        ) {
          data.cell.styles.textColor = IMPACT_RGB[summary.impactOrder[data.row.index]];
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 4;

    if (summary.note) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.text(summary.note, PAGE.margin, y);
    }
  }
};

// ============================================================
//  Entry point
// ============================================================
export async function exportDashboardPdf(args: ExportArgs) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  renderCover(doc, args);
  renderMonthlyImpact(doc, args);
  await renderUnproductivity(doc, args);
  await renderCharts(doc, args);

  drawFooter(doc);

  const safeLoc = args.location.replace(/[^\w\-]+/g, "_");
  doc.save(`Analise_Chuva_${safeLoc}.pdf`);
}
