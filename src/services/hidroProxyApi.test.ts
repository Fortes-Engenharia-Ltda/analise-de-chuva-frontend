import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchHidroEstacoesByMunicipio, fetchHidroMunicipios, fetchHidroUfs } from "@/services/hidroProxyApi";

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
