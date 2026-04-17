
## Investigação concluída

Reproduzi os cálculos com o CSV `3051023_Chuvas.csv` (174 meses no período de 15 anos: out/2010 → out/2025).

**Totais reais (média anual de dias por categoria):**
| Categoria | Soma raw | Soma com CEIL por mês |
|---|---|---|
| Baixo | 33,5 | **39** |
| Moderado | 11,8 | **18** (~19) |
| Alto | 11,1 | **17** |
| Severo | 27,3 | **32** (~31) |

**Improdutividades calculadas com totais raw:**
- Cobertas: 27,28 / 365 = **7,47%** ✓ (bate com seus 7,5%)
- Fora industriais: (5,89 + 11,06 + 27,28) / 365 = **12,12%** ✓ (bate com 12,1%)
- Comuns industriais: (8,38 + 5,89 + 11,06 + 27,28) / 365 = **14,41%** ✓ (bate com 14,4%)

**Improdutividades calculadas com totais CEIL (= os 39, 19, 17, 31 da imagem):**
- Cobertas: 31/365 = **8,49%**
- Fora industriais: (19·0,5 + 17 + 31)/365 = **15,75%**
- Comuns industriais: (39·0,25 + 9,5 + 17 + 31)/365 = **18,42%**

## Diagnóstico

Os números "errados" (8,49% / 15,75% / 18,42%) na tabela de referência (planilha Excel azul) vêm de **somar os valores arredondados para cima de cada mês** em vez de somar os valores médios reais. Ou seja, a planilha de referência arredonda para inteiro **antes** de somar — o que infla os totais em ~17–60%.

**Nosso dashboard já está calculando corretamente:** `aggregate()` em `src/lib/rainfall.ts` soma os valores raw das médias mensais antes de aplicar pesos e dividir por 365. Os 7,5% / 12,1% / 14,4% que você obteve manualmente são os valores **matematicamente corretos**.

## O que mudar (proposta)

Dois pontos pequenos para alinhar visualmente o dashboard com o cálculo correto e evitar a confusão "totais não batem com a soma da coluna":

1. **`src/components/Dashboard.tsx` — Linha do "Total de dias impactados" da tabela mensal**: trocar `fmtCeil(agg.totals[k])` por uma versão com 1 casa decimal (`fmt(agg.totals[k], 1)`). Assim o usuário vê 33,5 / 11,8 / 11,1 / 27,3, deixando claro que são médias e que o cálculo de improdutividade usa esses valores precisos (não a soma das células arredondadas acima).

2. **Nota explicativa abaixo da tabela**: trocar a nota atual ("*Média dos últimos 15 anos") por algo como:
   > *Médias dos últimos 15 anos. Os valores por mês são exibidos arredondados ao inteiro mais próximo; o total e a improdutividade são calculados a partir das médias precisas (sem arredondamento intermediário).*

3. **Opcional — cards de "Total por categoria"**: também exibir com 1 casa decimal para consistência com a nova linha de total.

Nenhuma alteração na lógica de cálculo é necessária — ela já está correta.
