# Analise de Chuva

Aplicacao web para analisar series pluviometricas da ANA/Hidroweb, gerando dashboard com indicadores de impacto de chuva e tabelas de dados mensais.

## O que o projeto faz

- Importa dados por CSV (formato ANA) ou consulta via API proxy.
- Mostra resumo por estacao, com periodo de referencia.
- Gera visualizacoes de impacto (dias de chuva, classes de impacto e ponderacao).
- Permite exportar analise em PDF.

## Requisitos

- Node.js 18+ (recomendado 20+)
- npm 9+
- Proxy da API ANA/Hidroweb em execucao (quando usar modo API)

## Configuracao

Para producao (build), configure no `.env`:

```env
VITE_HIDRO_PROXY_BASE_URL=https://seu-proxy-producao
```

Para desenvolvimento local (`npm run dev`), configure no `.env.local`:

```env
VITE_HIDRO_PROXY_BASE_URL_LOCAL=http://localhost:3000
```

Regra aplicada no projeto:

- `dev`: usa `VITE_HIDRO_PROXY_BASE_URL_LOCAL` (com fallback para `VITE_HIDRO_PROXY_BASE_URL`).
- `producao`: usa apenas `VITE_HIDRO_PROXY_BASE_URL`.

## Como rodar

Instalar dependencias:

```bash
npm install
```

Ambiente de desenvolvimento:

```bash
npm run dev
```

Build de producao:

```bash
npm run build
```

Executar testes:

```bash
npm test
```

## Fluxo de uso (resumo)

1. Escolha `CSV` ou `API`.
2. No modo API: selecione UF, cidade e estacao.
3. Verifique o periodo de referencia exibido para a estacao.
4. Clique em `Consultar API e analisar`.
5. Navegue entre Dashboard e Dados, e exporte PDF se necessario.

## Estrutura principal

- `src/components/UploadScreen.tsx`: tela de entrada (CSV/API).
- `src/hooks/useHidroCatalog.ts`: carregamento de UFs, municipios e estacoes.
- `src/hooks/useHidroSeries.ts`: consulta de series e montagem dos dados para analise.
- `src/services/hidroProxyApi.ts`: cliente da API proxy.
- `src/lib/hidroMappers.ts`: normalizacao dos formatos de resposta da ANA.
- `src/components/Dashboard.tsx`: graficos e indicadores.
- `src/lib/pdfExport.ts`: exportacao em PDF.