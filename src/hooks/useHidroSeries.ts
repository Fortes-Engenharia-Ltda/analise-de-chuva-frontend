import { useMutation } from "@tanstack/react-query";
import { mapHidroSeriesToParsedFile } from "@/lib/hidroMappers";
import {
  fetchHidroSeriesData,
  type HidroEstacao,
  type HidroSeriesProgress,
} from "@/services/hidroProxyApi";
import { type ParsedFile } from "@/lib/rainfall";
import { type HidroSeriesFeatureKey } from "@/services/hidroEndpointRegistry";

interface FetchSeriesParams {
  feature: HidroSeriesFeatureKey;
  station: HidroEstacao;
  years?: number;
  onProgress?: (progress: HidroSeriesProgress) => void;
}

function formatDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseHidroDate(value?: string): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildCandidateRange(station: HidroEstacao, years: number) {
  const today = new Date();
  const periodEnd = parseHidroDate(station.periodoChuvaFim);
  const endDate = periodEnd && periodEnd < today ? periodEnd : today;
  const startDate = new Date(endDate.getFullYear() - years + 1, 0, 1);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

async function fetchAndMapSeries({
  feature,
  station,
  years = 15,
  onProgress,
}: FetchSeriesParams): Promise<ParsedFile> {
  const range = buildCandidateRange(station, years);
  const series = await fetchHidroSeriesData({
    feature,
    stationCode: station.codigo,
    startDate: range.startDate,
    endDate: range.endDate,
    onProgress,
  });

  return mapHidroSeriesToParsedFile({
    feature,
    station,
    series,
  });
}

export function useHidroSeries() {
  return useMutation({
    mutationFn: fetchAndMapSeries,
  });
}
