import { describe, expect, it, vi } from "vitest";
import {
  aggregate,
  DEFAULT_WEIGHTS,
  filterByHistory,
  type HistoryPeriod,
  type ImpactPerMonth,
  type MonthRow,
} from "@/lib/rainfall";

const baseMonthly: ImpactPerMonth[] = Array.from({ length: 12 }, (_, index) => ({
  month: index + 1,
  monthLabel: "",
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
  rainy: 10,
  total: 10,
}));

describe("aggregate", () => {
  it("applies the selected severe share only to earthworks unproductivity", () => {
    const fullSevere = aggregate(baseMonthly, DEFAULT_WEIGHTS, {
      earthworksSevereShare: 1,
    });
    const halfSevere = aggregate(baseMonthly, DEFAULT_WEIGHTS, {
      earthworksSevereShare: 0.5,
    });

    expect(halfSevere.unprodCovered).toBe(fullSevere.unprodCovered);
    expect(halfSevere.unprodOutsideIndustrial).toBe(fullSevere.unprodOutsideIndustrial);
    expect(halfSevere.unprodCommonIndustrial).toBe(fullSevere.unprodCommonIndustrial);
    expect(halfSevere.unprodEarthworks).toBeLessThan(fullSevere.unprodEarthworks);
  });
});

describe("filterByHistory", () => {
  it("filters using the current date as the reference", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 6));

    const rows: MonthRow[] = [
      {
        estacao: "1",
        nivelConsistencia: "2",
        tipoMedicao: "1",
        date: new Date(2010, 11, 1),
        year: 2010,
        month: 12,
        days: Array.from({ length: 31 }, () => null),
        rainyDays: 0,
        totalRain: 0,
      },
      {
        estacao: "1",
        nivelConsistencia: "2",
        tipoMedicao: "1",
        date: new Date(2011, 4, 1),
        year: 2011,
        month: 5,
        days: Array.from({ length: 31 }, () => null),
        rainyDays: 0,
        totalRain: 0,
      },
      {
        estacao: "1",
        nivelConsistencia: "2",
        tipoMedicao: "1",
        date: new Date(2025, 11, 1),
        year: 2025,
        month: 12,
        days: Array.from({ length: 31 }, () => null),
        rainyDays: 0,
        totalRain: 0,
      },
      {
        estacao: "1",
        nivelConsistencia: "2",
        tipoMedicao: "1",
        date: new Date(2026, 4, 1),
        year: 2026,
        month: 5,
        days: Array.from({ length: 31 }, () => null),
        rainyDays: 0,
        totalRain: 0,
      },
    ];

    const filtered = filterByHistory(rows, { unit: "years", value: 15 });

    expect(filtered.map((row) => row.date.toISOString().slice(0, 10))).toEqual([
      "2011-05-01",
      "2025-12-01",
      "2026-05-01",
    ]);
  });

  it("filters exact month windows when requested", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 6));

    const rows: MonthRow[] = [
      {
        estacao: "1",
        nivelConsistencia: "2",
        tipoMedicao: "1",
        date: new Date(2024, 10, 1),
        year: 2024,
        month: 11,
        days: Array.from({ length: 31 }, () => null),
        rainyDays: 0,
        totalRain: 0,
      },
      {
        estacao: "1",
        nivelConsistencia: "2",
        tipoMedicao: "1",
        date: new Date(2024, 11, 1),
        year: 2024,
        month: 12,
        days: Array.from({ length: 31 }, () => null),
        rainyDays: 0,
        totalRain: 0,
      },
      {
        estacao: "1",
        nivelConsistencia: "2",
        tipoMedicao: "1",
        date: new Date(2026, 4, 1),
        year: 2026,
        month: 5,
        days: Array.from({ length: 31 }, () => null),
        rainyDays: 0,
        totalRain: 0,
      },
    ];

    const period: HistoryPeriod = { unit: "months", value: 18 };
    const filtered = filterByHistory(rows, period);

    expect(filtered.map((row) => row.date.toISOString().slice(0, 10))).toEqual([
      "2024-12-01",
      "2026-05-01",
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
