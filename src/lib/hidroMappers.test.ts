import { describe, expect, it } from "vitest";
import { mapHidroSeriesToParsedFile } from "@/lib/hidroMappers";
import type { HidroEstacao } from "@/services/hidroProxyApi";

const station: HidroEstacao = {
  codigo: "2041119",
  nome: "ALEGRE_Conceicao",
  municipioCodigo: "3200201",
  municipioNome: "ALEGRE",
  ufSigla: "ES",
  tipoMedicao: "1",
  nivelConsistencia: "2",
};

describe("mapHidroSeriesToParsedFile", () => {
  it("maps monthly HidroSerieChuva rows returned with Chuva01..Chuva31 fields", () => {
    const result = mapHidroSeriesToParsedFile({
      feature: "hidroSerieChuva",
      station,
      series: [
        {
          Data: "01/01/2025",
          Chuva01: "0",
          Chuva02: "2,5",
          Chuva03: "",
          Chuva04: "10.25",
        },
      ],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      estacao: "2041119",
      year: 2025,
      month: 1,
      rainyDays: 2,
      totalRain: 12.75,
    });
    expect(result.rows[0].days.slice(0, 4)).toEqual([0, 2.5, null, 10.25]);
  });

  it("maps the real proxy HidroSerieChuva field names", () => {
    const result = mapHidroSeriesToParsedFile({
      feature: "hidroSerieChuva",
      station,
      series: [
        {
          Data_Hora_Dado: "2010-01-01 00:00:00.0",
          Chuva_01: "2.0",
          Chuva_02: "0.0",
          Chuva_16: "24.1",
        },
      ],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      year: 2010,
      month: 1,
      rainyDays: 2,
      totalRain: 26.1,
    });
    expect(result.rows[0].days[0]).toBe(2);
    expect(result.rows[0].days[15]).toBe(24.1);
  });

  it("keeps one monthly row for each Data_Hora_Dado returned by the backend", () => {
    const series = Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return {
        Data_Hora_Dado: `2010-${month}-01 00:00:00.0`,
        Chuva_01: String(index + 1),
      };
    });

    const result = mapHidroSeriesToParsedFile({
      feature: "hidroSerieChuva",
      station,
      series,
    });

    expect(result.rows).toHaveLength(12);
    expect(result.rows[0]).toMatchObject({ year: 2010, month: 1, totalRain: 1 });
    expect(result.rows[11]).toMatchObject({ year: 2010, month: 12, totalRain: 12 });
  });

  it("keeps mapping daily rows returned with a single rain value", () => {
    const result = mapHidroSeriesToParsedFile({
      feature: "hidroSerieChuva",
      station,
      series: [
        { Data: "2025-02-01", Chuva: "1.5" },
        { Data: "2025-02-02", Chuva: "0" },
        { Data: "2025-02-03", Chuva: "4" },
      ],
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      year: 2025,
      month: 2,
      rainyDays: 2,
      totalRain: 5.5,
    });
    expect(result.rows[0].days.slice(0, 3)).toEqual([1.5, 0, 4]);
  });
});
