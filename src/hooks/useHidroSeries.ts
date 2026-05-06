import { useMutation } from "@tanstack/react-query";
import { mapHidroSeriesToParsedFile } from "@/lib/hidroMappers";
import {
  fetchHidroSeriesData,
  type HidroEstacao,
  type HidroSeriesProgress,
} from "@/services/hidroProxyApi";
import { getHistoryStartDate, type HistoryPeriod, type ParsedFile } from "@/lib/rainfall";
import { type HidroSeriesFeatureKey } from "@/services/hidroEndpointRegistry";

interface FetchSeriesParams {
  feature: HidroSeriesFeatureKey;
  station: HidroEstacao;
  historyPeriod?: HistoryPeriod;
  onProgress?: (progress: HidroSeriesProgress) => void;
}

function formatDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function buildCandidateRange(_station: HidroEstacao, historyPeriod: HistoryPeriod) {
  const today = new Date();
  const endDate = today;
  const startDate = getHistoryStartDate(endDate, historyPeriod);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

async function fetchAndMapSeries({
  feature,
  station,
  historyPeriod = { unit: "years", value: 15 },
  onProgress,
}: FetchSeriesParams): Promise<ParsedFile> {
  const range = buildCandidateRange(station, historyPeriod);
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
