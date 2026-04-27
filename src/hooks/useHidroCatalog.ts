import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchHidroEstacoesByMunicipio,
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
    queryFn: fetchHidroUfs,
    staleTime: 1000 * 60 * 60,
    enabled,
  });

  const municipiosQuery = useQuery({
    queryKey: ["hidro", "catalog", "municipios", ufSigla],
    queryFn: () => fetchHidroMunicipios(ufSigla),
    staleTime: 1000 * 60 * 30,
    enabled: enabled && !!ufSigla,
  });

  const municipioSelecionado = useMemo(
    () => municipiosQuery.data?.find((municipio) => municipio.codigo === municipioCodigo) ?? null,
    [municipiosQuery.data, municipioCodigo],
  );

  const estacoesQuery = useQuery({
    queryKey: ["hidro", "catalog", "estacoes", feature, ufSigla, municipioCodigo, municipioSelecionado?.nome],
    queryFn: () => fetchHidroEstacoesByMunicipio(municipioSelecionado?.nome ?? "", ufSigla),
    staleTime: 1000 * 60 * 15,
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
