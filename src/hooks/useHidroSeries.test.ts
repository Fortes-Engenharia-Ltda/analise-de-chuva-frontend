import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCandidateRange } from "@/hooks/useHidroSeries";
import type { HidroEstacao } from "@/services/hidroProxyApi";

const station: HidroEstacao = {
  codigo: "1951005",
  nome: "Estacao teste",
  municipioCodigo: "",
  municipioNome: "",
  ufSigla: "ES",
  tipoMedicao: "1",
  nivelConsistencia: "2",
};

describe("buildCandidateRange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in the same month 15 years before the current date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 4));

    expect(buildCandidateRange(station, 15)).toEqual({
      startDate: "2011-05-01",
      endDate: "2026-05-04",
    });
  });

  it("uses the station period end when it is earlier than today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 4));

    expect(
      buildCandidateRange(
        {
          ...station,
          periodoChuvaFim: "2025-12-01 00:00:00.0",
        },
        15,
      ),
    ).toEqual({
      startDate: "2010-12-01",
      endDate: "2025-12-01",
    });
  });
});
