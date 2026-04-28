import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchHidroEstacoesByMunicipio,
  fetchHidroMunicipios,
  fetchHidroSeriesData,
  fetchHidroUfs,
} from "@/services/hidroProxyApi";

function asJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("hidroProxyApi UF mapping", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_HIDRO_PROXY_BASE_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps the UF payload returned by the proxy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      asJsonResponse({
        items: [
          {
            Estado_Sigla: "RO",
            Estado_Nome: "RONDÔNIA",
            codigouf: "1",
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHidroUfs();

    expect(result).toEqual([
      {
        sigla: "RO",
        nome: "RONDÔNIA",
        codigo: "1",
      },
    ]);
  });
});

describe("hidroProxyApi municipality mapping", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_HIDRO_PROXY_BASE_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("maps the municipality payload returned by the proxy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      asJsonResponse({
        items: [
          {
            Municipio_Nome: "ALTA FLORESTA D'OESTE",
            codigomunicipio: "1000500",
            Estado_Codigo: "18",
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHidroMunicipios("RO");

    expect(result).toEqual([
      {
        codigo: "1000500",
        nome: "ALTA FLORESTA D'OESTE",
        ufSigla: "RO",
        ufCodigo: "18",
      },
    ]);
  });
});

describe("hidroProxyApi inventory mapping", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_HIDRO_PROXY_BASE_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("requests the local station inventory by municipality name and UF", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      asJsonResponse({
        items: [
          {
            CodigoEstacao: "12345678",
            NomeEstacao: "ALEGRE_Centro",
            CodigoMunicipio: "3200201",
            NomeMunicipio: "Alegre",
            SiglaUF: "ES",
            TipoMedicaoChuvas: "1",
            NivelConsistencia: "2",
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHidroEstacoesByMunicipio("Alegre", "ES");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "http://localhost:3000/api/hidro/estacoes?municipio=Alegre&uf=ES",
      }),
      { method: "GET" },
    );
    expect(result).toEqual([
      {
        codigo: "12345678",
        nome: "ALEGRE_Centro",
        municipioCodigo: "3200201",
        municipioNome: "Alegre",
        ufSigla: "ES",
        tipoMedicao: "1",
        nivelConsistencia: "2",
      },
    ]);
  });

  it("maps the real station payload keys returned by the backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      asJsonResponse({
        items: [
          {
            codigoestacao: "2041119",
            Estacao_Nome: "ALEGRE_Conceição",
            Municipio_Nome: "ALEGRE",
            UF_Estacao: "ES",
            TipoMedicaoChuvas: "1",
            NivelConsistencia: "2",
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHidroEstacoesByMunicipio("Alegre", "ES");

    expect(result).toEqual([
      {
        codigo: "2041119",
        nome: "ALEGRE_Conceição",
        municipioCodigo: "",
        municipioNome: "ALEGRE",
        ufSigla: "ES",
        tipoMedicao: "1",
        nivelConsistencia: "2",
      },
    ]);
  });
});

describe("hidroProxyApi series date windowing", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_HIDRO_PROXY_BASE_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("requests series in a single call when range fits endpoint max days", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      asJsonResponse({
        items: [{ id: 1 }],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHidroSeriesData({
      feature: "hidroSerieChuva",
      stationCode: "123",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: "http://localhost:3000/api/hidro/series?feature=HidroSerieChuva&CodigoDaEstacao=123&DataInicio=2025-01-01&DataFim=2025-12-31",
      }),
      { method: "GET" },
    );
    expect(result).toEqual([{ id: 1 }]);
  });

  it("splits series requests into multiple windows when range exceeds endpoint max days", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(asJsonResponse({ items: [{ chunk: 1 }] }))
      .mockResolvedValueOnce(asJsonResponse({ items: [{ chunk: 2 }] }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchHidroSeriesData({
      feature: "hidroSerieChuva",
      stationCode: "123",
      startDate: "2020-01-01",
      endDate: "2021-01-01",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = (fetchMock.mock.calls[0][0] as URL).href;
    const secondUrl = (fetchMock.mock.calls[1][0] as URL).href;

    expect(firstUrl).toBe(
      "http://localhost:3000/api/hidro/series?feature=HidroSerieChuva&CodigoDaEstacao=123&DataInicio=2020-01-01&DataFim=2020-12-31",
    );
    expect(secondUrl).toBe(
      "http://localhost:3000/api/hidro/series?feature=HidroSerieChuva&CodigoDaEstacao=123&DataInicio=2021-01-01&DataFim=2021-01-01",
    );
    expect(result).toEqual([{ chunk: 1 }, { chunk: 2 }]);
  });

  it("reports progress as each window is completed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(asJsonResponse({ items: [{ chunk: 1 }] }))
      .mockResolvedValueOnce(asJsonResponse({ items: [{ chunk: 2 }] }));
    const onProgress = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    await fetchHidroSeriesData({
      feature: "hidroSerieChuva",
      stationCode: "123",
      startDate: "2020-01-01",
      endDate: "2021-01-01",
      requestDelayMs: 0,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      completedWindows: 1,
      totalWindows: 2,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      completedWindows: 2,
      totalWindows: 2,
    });
  });
});
