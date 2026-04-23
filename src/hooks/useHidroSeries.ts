import { useMutation } from "@tanstack/react-query";
import { mapHidroSeriesToParsedFile } from "@/lib/hidroMappers";
import {
  fetchHidroSeriesData,
  type HidroEstacao,
} from "@/services/hidroProxyApi";
import { type ParsedFile } from "@/lib/rainfall";
import { type HidroSeriesFeatureKey } from "@/services/hidroEndpointRegistry";

interface FetchSeriesParams {
  feature: HidroSeriesFeatureKey;
  station: HidroEstacao;
  years?: number;
}

function formatDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchAndMapSeries({
  feature,
  station,
  years = 15,
}: FetchSeriesParams): Promise<ParsedFile> {
  const endDate = new Date();
  const startDate = new Date(endDate.getFullYear() - years, endDate.getMonth(), endDate.getDate());

  const series = await fetchHidroSeriesData({
    feature,
    stationCode: station.codigo,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
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
