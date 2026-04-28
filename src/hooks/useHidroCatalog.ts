import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchHidroEstacoesByMunicipioForFeature,
  fetchHidroMunicipios,
  fetchHidroUfs,
  type HidroEstacao,
} from "@/services/hidroProxyApi";
import { type HidroSeriesFeatureKey } from "@/services/hidroEndpointRegistry";

interface UseHidroCatalogParams {
  enabled: boolean;
  feature: HidroSeriesFeatureKey;
  ufSigla: string;
  municipioCodigo: string;
}

export function useHidroCatalog({
  enabled,
  feature,
  ufSigla,
  municipioCodigo,
}: UseHidroCatalogParams) {
  const ufsQuery = useQuery({
    queryKey: ["hidro", "catalog", "ufs"],
    queryFn: ({ signal }) => fetchHidroUfs(signal),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled,
  });

  const municipiosQuery = useQuery({
    queryKey: ["hidro", "catalog", "municipios", ufSigla],
    queryFn: ({ signal }) => fetchHidroMunicipios(ufSigla, signal),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 6,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: enabled && !!ufSigla,
  });

  const municipioSelecionado = useMemo(
    () => municipiosQuery.data?.find((municipio) => municipio.codigo === municipioCodigo) ?? null,
    [municipiosQuery.data, municipioCodigo],
  );

  const estacoesQuery = useQuery({
    queryKey: ["hidro", "catalog", "estacoes", feature, ufSigla, municipioCodigo],
    queryFn: ({ signal }) =>
      fetchHidroEstacoesByMunicipioForFeature(
        feature,
        municipioSelecionado?.nome ?? "",
        ufSigla,
        signal,
      ),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60 * 3,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: enabled && !!municipioCodigo && !!ufSigla && !!municipioSelecionado?.nome,
  });

  const autoSelectedStation = useMemo<HidroEstacao | null>(() => {
    const stations = estacoesQuery.data ?? [];
    return stations.length === 1 ? stations[0] : null;
  }, [estacoesQuery.data]);

  return {
    ufsQuery,
    municipiosQuery,
    estacoesQuery,
    autoSelectedStation,
  };
}
