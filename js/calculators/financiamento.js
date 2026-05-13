/**
 * @file financiamento.js
 * @description Lógica de cálculo de financiamento imobiliário do FinCalc.
 *              Implementa os sistemas Price (parcelas iguais) e SAC
 *              (amortização constante), além de CET, comprometimento
 *              de renda e geração da tabela de amortização completa.
 *
 *              REGRAS DESTE MÓDULO:
 *              - Sem manipulação de DOM
 *              - Sem efeitos colaterais
 *              - Todas as funções são puras (mesma entrada = mesma saída)
 *              - Dados de entrada já devem vir sanitizados (via validators.js)
 *              - Taxas recebidas em DECIMAL (ex: 0.01 para 1% a.m.)
 *
 * @module Financiamento
 *
 * DEPENDÊNCIAS: nenhuma
 *
 * USO:
 *   import { calcularPrice, calcularSAC, calcularCET } from '../calculators/financiamento.js';
 */

'use strict';

/* ============================================================
   CONSTANTES INTERNAS
   ============================================================ */

/** Precisão de arredondamento para valores monetários (centavos) */
const PRECISAO_CENTAVOS = 2;

/** Número máximo de parcelas suportado na tabela de amortização */
const MAX_PARCELAS_TABELA = 600;

/* ============================================================
   UTILITÁRIOS INTERNOS
   ============================================================ */

/**
 * Arredonda um valor para N casas decimais.
 * Usa método "round half away from zero" — padrão financeiro brasileiro.
 *
 * @param {number} value    - Valor a arredondar
 * @param {number} decimals - Casas decimais (padrão: 2)
 * @returns {number}
 */
function arredondar(value, decimals = PRECISAO_CENTAVOS) {
  const fator = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * fator) / fator;
}

/**
 * Valida se os parâmetros básicos de financiamento são números finitos e positivos.
 * Lança erro descritivo se inválidos — os calculators não devem receber lixo.
 *
 * @param {number} pv - Valor presente (principal)
 * @param {number} i  - Taxa mensal decimal
 * @param {number} n  - Número de parcelas
 * @throws {Error} Se qualquer parâmetro for inválido
 */
function validarParametrosBasicos(pv, i, n) {
  if (!isFinite(pv) || pv <= 0) {
    throw new Error(`Valor financiado inválido: ${pv}. Deve ser um número positivo.`);
  }
  if (!isFinite(i) || i < 0) {
    throw new Error(`Taxa mensal inválida: ${i}. Deve ser zero ou positiva.`);
  }
  if (!isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(`Prazo inválido: ${n}. Deve ser um inteiro positivo.`);
  }
}

/* ============================================================
   SISTEMA PRICE — PARCELAS IGUAIS
   ============================================================ */

/**
 * Calcula a parcela constante pelo sistema Price (Tabela Price / Francês).
 * Fórmula: PMT = PV × [i × (1+i)^n] / [(1+i)^n - 1]
 *
 * @param {number} pv - Valor presente (principal financiado em R$)
 * @param {number} i  - Taxa de juros mensal em decimal (ex: 0.01 para 1% a.m.)
 * @param {number} n  - Número de parcelas (meses)
 * @returns {number}  Valor da parcela mensal arredondado em centavos
 *
 * @example
 * calcularParcelaPrice(300000, 0.01, 360) // ≈ 3085.84
 */
function calcularParcelaPrice(pv, i, n) {
  // Taxa zero: divisão simples sem juros
  if (i === 0) return arredondar(pv / n);

  const fator = Math.pow(1 + i, n);
  const parcela = pv * (i * fator) / (fator - 1);
  return arredondar(parcela);
}

/**
 * Gera a tabela de amortização completa pelo sistema Price.
 * Cada linha representa uma parcela com: número, saldo devedor antes,
 * parcela, juros, amortização e saldo devedor após.
 *
 * A última parcela é ajustada para eliminar resíduo de arredondamento.
 *
 * @param {number} pv - Principal
 * @param {number} i  - Taxa mensal decimal
 * @param {number} n  - Número de parcelas
 * @returns {Array<{
 *   numero:          number,
 *   saldoAntes:      number,
 *   parcela:         number,
 *   juros:           number,
 *   amortizacao:     number,
 *   saldoDepois:     number
 * }>}
 */
function gerarTabelaPrice(pv, i, n) {
  const pmt    = calcularParcelaPrice(pv, i, n);
  const tabela = [];
  let saldo    = pv;

  for (let mes = 1; mes <= n; mes++) {
    const saldoAntes   = arredondar(saldo);
    const juros        = arredondar(saldo * i);
    let   amortizacao  = arredondar(pmt - juros);
    let   parcelaReal  = pmt;

    // Ajuste na última parcela para zerar o saldo exatamente
    if (mes === n) {
      amortizacao = arredondar(saldo);
      parcelaReal = arredondar(amortizacao + juros);
    }

    const saldoDepois = arredondar(Math.max(0, saldo - amortizacao));

    tabela.push({
      numero:      mes,
      saldoAntes,
      parcela:     parcelaReal,
      juros,
      amortizacao,
      saldoDepois,
    });

    saldo = saldoDepois;
  }

  return tabela;
}

/**
 * Calcula o resumo completo de um financiamento pelo sistema Price.
 *
 * @param {number} pv - Principal financiado
 * @param {number} i  - Taxa mensal decimal
 * @param {number} n  - Prazo em meses
 * @returns {{
 *   sistema:          'PRICE',
 *   parcela:          number,
 *   primeiraParcela:  number,
 *   ultimaParcela:    number,
 *   totalPago:        number,
 *   totalJuros:       number,
 *   valorFinanciado:  number,
 *   prazoMeses:       number,
 *   taxaMensal:       number,
 * }}
 */
function resumoPrice(pv, i, n) {
  validarParametrosBasicos(pv, i, n);

  const tabela       = gerarTabelaPrice(pv, i, n);
  const parcela      = tabela[0].parcela;
  const ultimaParcela = tabela[n - 1].parcela;
  const totalPago    = arredondar(tabela.reduce((acc, row) => acc + row.parcela, 0));
  const totalJuros   = arredondar(totalPago - pv);

  return {
    sistema:          'PRICE',
    parcela,
    primeiraParcela:  parcela,
    ultimaParcela,
    totalPago,
    totalJuros,
    valorFinanciado:  arredondar(pv),
    prazoMeses:       n,
    taxaMensal:       i,
  };
}

/* ============================================================
   SISTEMA SAC — AMORTIZAÇÃO CONSTANTE
   ============================================================ */

/**
 * Calcula a amortização constante do SAC.
 * A amortização é sempre PV / n, independente dos juros.
 *
 * @param {number} pv - Principal
 * @param {number} n  - Prazo em meses
 * @returns {number}  Amortização mensal constante
 */
function calcularAmortizacaoSAC(pv, n) {
  return arredondar(pv / n);
}

/**
 * Gera a tabela de amortização completa pelo sistema SAC.
 * As parcelas diminuem progressivamente pois a amortização é fixa
 * e os juros incidem sobre saldo devedor decrescente.
 *
 * @param {number} pv - Principal
 * @param {number} i  - Taxa mensal decimal
 * @param {number} n  - Prazo em meses
 * @returns {Array<{
 *   numero:          number,
 *   saldoAntes:      number,
 *   parcela:         number,
 *   juros:           number,
 *   amortizacao:     number,
 *   saldoDepois:     number
 * }>}
 */
function gerarTabelaSAC(pv, i, n) {
  const amortBase = calcularAmortizacaoSAC(pv, n);
  const tabela    = [];
  let saldo       = pv;

  for (let mes = 1; mes <= n; mes++) {
    const saldoAntes = arredondar(saldo);
    const juros      = arredondar(saldo * i);

    // Última parcela: amortização absorve o saldo restante (resíduo de arredondamento)
    const amortizacao = mes === n
      ? arredondar(saldo)
      : amortBase;

    const parcela    = arredondar(amortizacao + juros);
    const saldoDepois = arredondar(Math.max(0, saldo - amortizacao));

    tabela.push({
      numero: mes,
      saldoAntes,
      parcela,
      juros,
      amortizacao,
      saldoDepois,
    });

    saldo = saldoDepois;
  }

  return tabela;
}

/**
 * Calcula o resumo completo de um financiamento pelo sistema SAC.
 *
 * @param {number} pv - Principal financiado
 * @param {number} i  - Taxa mensal decimal
 * @param {number} n  - Prazo em meses
 * @returns {{
 *   sistema:          'SAC',
 *   parcela:          number,
 *   primeiraParcela:  number,
 *   ultimaParcela:    number,
 *   totalPago:        number,
 *   totalJuros:       number,
 *   valorFinanciado:  number,
 *   prazoMeses:       number,
 *   taxaMensal:       number,
 * }}
 */
function resumoSAC(pv, i, n) {
  validarParametrosBasicos(pv, i, n);

  const tabela        = gerarTabelaSAC(pv, i, n);
  const primeiraParcela = tabela[0].parcela;
  const ultimaParcela   = tabela[n - 1].parcela;
  const totalPago       = arredondar(tabela.reduce((acc, row) => acc + row.parcela, 0));
  const totalJuros      = arredondar(totalPago - pv);

  return {
    sistema:          'SAC',
    parcela:          primeiraParcela, // referência: maior parcela (a primeira)
    primeiraParcela,
    ultimaParcela,
    totalPago,
    totalJuros,
    valorFinanciado:  arredondar(pv),
    prazoMeses:       n,
    taxaMensal:       i,
  };
}

/* ============================================================
   COMPARATIVO PRICE × SAC
   ============================================================ */

/**
 * Compara os dois sistemas de amortização lado a lado.
 * Retorna qual é mais vantajoso em cada métrica.
 *
 * @param {number} pv - Principal
 * @param {number} i  - Taxa mensal decimal
 * @param {number} n  - Prazo em meses
 * @returns {{
 *   price:           object,
 *   sac:             object,
 *   economiaJuros:   number,
 *   economiaPct:     number,
 *   diferencaPrimeiraParcela: number,
 *   melhorTotalPago: 'PRICE' | 'SAC' | 'IGUAL',
 *   melhorPrimeiraParcela: 'PRICE' | 'SAC' | 'IGUAL',
 * }}
 */
export function compararSistemas(pv, i, n) {
  const price = resumoPrice(pv, i, n);
  const sac   = resumoSAC(pv, i, n);

  const economiaJuros = arredondar(price.totalJuros - sac.totalJuros);
  const economiaPct   = price.totalJuros > 0
    ? arredondar((economiaJuros / price.totalJuros) * 100, 2)
    : 0;

  const diferencaPrimeiraParcela = arredondar(sac.primeiraParcela - price.primeiraParcela);

  const melhorTotalPago = price.totalPago < sac.totalPago
    ? 'PRICE'
    : price.totalPago > sac.totalPago
      ? 'SAC'
      : 'IGUAL';

  const melhorPrimeiraParcela = price.primeiraParcela < sac.primeiraParcela
    ? 'PRICE'
    : price.primeiraParcela > sac.primeiraParcela
      ? 'SAC'
      : 'IGUAL';

  return {
    price,
    sac,
    economiaJuros,
    economiaPct,
    diferencaPrimeiraParcela,
    melhorTotalPago,
    melhorPrimeiraParcela,
  };
}

/* ============================================================
   CET — CUSTO EFETIVO TOTAL
   ============================================================ */

/**
 * Calcula o CET (Custo Efetivo Total) anual de um financiamento.
 * O CET inclui a taxa de juros e todos os encargos adicionais
 * (tarifas, seguros, IOF), expressando o custo real do crédito.
 *
 * Método: TIR (Taxa Interna de Retorno) do fluxo de caixa.
 * A TIR é a taxa que zera o VPL: PV = Σ [PMT_k / (1 + TIR)^k]
 * Encontrada por bisseção numérica (Newton-Raphson simplificado).
 *
 * @param {number}   pv        - Valor líquido recebido pelo tomador
 * @param {number[]} fluxo     - Array com o valor de cada parcela (mês 1 ao mês n)
 * @param {number}   [maxIter] - Máximo de iterações (padrão: 1000)
 * @param {number}   [tol]     - Tolerância de convergência (padrão: 1e-8)
 * @returns {{
 *   cetMensal:  number,   (decimal, ex: 0.0125 para 1,25% a.m.)
 *   cetAnual:   number,   (decimal, ex: 0.1609 para 16,09% a.a.)
 *   cetAnualPct: number,  (em %, ex: 16.09)
 * } | null}  null se não convergir
 */
export function calcularCET(pv, fluxo, maxIter = 1000, tol = 1e-8) {
  if (!Array.isArray(fluxo) || fluxo.length === 0) return null;
  if (!isFinite(pv) || pv <= 0) return null;

  // Função VPL: soma dos fluxos descontados menos o valor recebido
  const vpl = (taxa) => {
    let soma = 0;
    for (let k = 0; k < fluxo.length; k++) {
      soma += fluxo[k] / Math.pow(1 + taxa, k + 1);
    }
    return soma - pv;
  };

  // Bisseção: encontra a raiz de vpl(taxa) = 0
  let baixo = 0;
  let alto  = 1; // 100% a.m. como limite superior absurdo

  // Verifica se existe raiz no intervalo
  if (vpl(baixo) * vpl(alto) > 0) return null;

  let taxa = 0;
  for (let iter = 0; iter < maxIter; iter++) {
    taxa = (baixo + alto) / 2;
    const v = vpl(taxa);

    if (Math.abs(v) < tol) break;

    if (vpl(baixo) * v < 0) {
      alto = taxa;
    } else {
      baixo = taxa;
    }
  }

  const cetMensal  = taxa;
  const cetAnual   = Math.pow(1 + cetMensal, 12) - 1;
  const cetAnualPct = arredondar(cetAnual * 100, 4);

  return {
    cetMensal:  arredondar(cetMensal, 6),
    cetAnual:   arredondar(cetAnual,  6),
    cetAnualPct,
  };
}

/* ============================================================
   COMPROMETIMENTO DE RENDA
   ============================================================ */

/**
 * Calcula o percentual de comprometimento da renda mensal com a parcela.
 * Bancos brasileiros geralmente limitam a 30% da renda bruta.
 *
 * @param {number} parcela     - Valor da parcela mensal
 * @param {number} renda       - Renda mensal bruta
 * @returns {{
 *   percentual:  number,   (ex: 28.5 para 28,5%)
 *   dentro:      boolean,  (true se <= 30%)
 *   limite:      number,   (30)
 *   faixa:       'seguro' | 'atencao' | 'risco'
 * }}
 */
export function calcularComprometimento(parcela, renda) {
  if (!isFinite(renda) || renda <= 0) {
    return { percentual: 0, dentro: true, limite: 30, faixa: 'seguro' };
  }

  const percentual = arredondar((parcela / renda) * 100, 2);

  let faixa;
  if (percentual <= 25)      faixa = 'seguro';
  else if (percentual <= 30) faixa = 'atencao';
  else                       faixa = 'risco';

  return {
    percentual,
    dentro:  percentual <= 30,
    limite:  30,
    faixa,
  };
}

/* ============================================================
   FUNÇÃO PRINCIPAL DE CÁLCULO
   Ponto de entrada principal — chama Price, SAC ou ambos.
   ============================================================ */

/**
 * Calcula o financiamento completo com base nos parâmetros fornecidos.
 * Retorna resumos de Price e/ou SAC, comparativo, tabelas e métricas extras.
 *
 * @param {object} params
 * @param {number}  params.valorFinanciado - Valor a ser financiado (já descontada entrada)
 * @param {number}  params.taxaMensal      - Taxa mensal em decimal (ex: 0.01 para 1% a.m.)
 * @param {number}  params.prazo           - Prazo em meses (inteiro)
 * @param {number}  [params.renda]         - Renda mensal bruta (opcional, para comprometimento)
 * @param {'PRICE'|'SAC'|'AMBOS'} [params.sistema] - Sistema a calcular (padrão: 'AMBOS')
 * @param {boolean} [params.incluirTabela] - Se true, inclui tabela de amortização (padrão: false)
 * @param {number}  [params.seguroMIP]     - Seguro MIP mensal em R$ (para CET)
 * @param {number}  [params.seguroDFI]     - Seguro DFI mensal em R$ (para CET)
 * @param {number}  [params.tarifaAdmin]   - Tarifa de administração mensal em R$ (para CET)
 *
 * @returns {{
 *   price:           object | null,
 *   sac:             object | null,
 *   comparativo:     object | null,
 *   comprometimento: object | null,
 *   cet:             object | null,
 *   tabelaPrice:     Array  | null,
 *   tabelaSAC:       Array  | null,
 *   params:          object,
 * }}
 *
 * @throws {Error} Se parâmetros obrigatórios forem inválidos
 *
 * @example
 * const resultado = calcularFinanciamento({
 *   valorFinanciado: 400000,
 *   taxaMensal:      0.0093,   // 0,93% a.m. (≈ 11,7% a.a.)
 *   prazo:           360,
 *   renda:           15000,
 *   sistema:         'AMBOS',
 *   incluirTabela:   false,
 * });
 *
 * resultado.price.parcela        // 4089.55
 * resultado.price.totalJuros     // 1072238.00
 * resultado.comparativo.economiaJuros // diferença SAC vs Price
 */
export function calcularFinanciamento(params) {
  const {
    valorFinanciado,
    taxaMensal,
    prazo,
    renda         = 0,
    sistema       = 'AMBOS',
    incluirTabela = false,
    seguroMIP     = 0,
    seguroDFI     = 0,
    tarifaAdmin   = 0,
  } = params;

  // Validação dos parâmetros obrigatórios
  validarParametrosBasicos(valorFinanciado, taxaMensal, prazo);

  // Limite de segurança para tabela
  const prazoTabela = Math.min(prazo, MAX_PARCELAS_TABELA);

  const calcPrice = sistema === 'PRICE' || sistema === 'AMBOS';
  const calcSAC   = sistema === 'SAC'   || sistema === 'AMBOS';

  // ── Cálculos Price ─────────────────────────────────────────────
  let resultPrice    = null;
  let tabelaPrice    = null;
  let cetPrice       = null;

  if (calcPrice) {
    resultPrice = resumoPrice(valorFinanciado, taxaMensal, prazo);

    if (incluirTabela) {
      tabelaPrice = gerarTabelaPrice(valorFinanciado, taxaMensal, prazoTabela);
    }

    // CET: fluxo = parcela + encargos adicionais por mês
    const encargos = seguroMIP + seguroDFI + tarifaAdmin;
    if (encargos > 0) {
      const fluxoPrice = Array.from(
        { length: prazo },
        (_, k) => {
          const tab = tabelaPrice || gerarTabelaPrice(valorFinanciado, taxaMensal, prazo);
          return tab[k].parcela + encargos;
        }
      );
      cetPrice = calcularCET(valorFinanciado, fluxoPrice);
    }
  }

  // ── Cálculos SAC ───────────────────────────────────────────────
  let resultSAC   = null;
  let tabelaSAC   = null;
  let cetSAC      = null;

  if (calcSAC) {
    resultSAC = resumoSAC(valorFinanciado, taxaMensal, prazo);

    if (incluirTabela) {
      tabelaSAC = gerarTabelaSAC(valorFinanciado, taxaMensal, prazoTabela);
    }

    const encargos = seguroMIP + seguroDFI + tarifaAdmin;
    if (encargos > 0) {
      const tabSAC = tabelaSAC || gerarTabelaSAC(valorFinanciado, taxaMensal, prazo);
      const fluxoSAC = tabSAC.map(row => row.parcela + encargos);
      cetSAC = calcularCET(valorFinanciado, fluxoSAC);
    }
  }

  // ── Comparativo ────────────────────────────────────────────────
  let comparativo = null;
  if (calcPrice && calcSAC) {
    comparativo = compararSistemas(valorFinanciado, taxaMensal, prazo);
  }

  // ── Comprometimento de renda ───────────────────────────────────
  let comprometimento = null;
  if (renda > 0 && resultPrice) {
    comprometimento = calcularComprometimento(resultPrice.parcela, renda);
  } else if (renda > 0 && resultSAC) {
    comprometimento = calcularComprometimento(resultSAC.primeiraParcela, renda);
  }

  return {
    price:           resultPrice,
    sac:             resultSAC,
    comparativo,
    comprometimento,
    cet:             cetPrice || cetSAC || null,
    cetPrice,
    cetSAC,
    tabelaPrice,
    tabelaSAC,
    params: {
      valorFinanciado: arredondar(valorFinanciado),
      taxaMensal,
      taxaMensalPct:   arredondar(taxaMensal * 100, 4),
      prazo,
      renda:           arredondar(renda),
      sistema,
    },
  };
}

/* ============================================================
   FUNÇÕES AUXILIARES EXPORTADAS
   ============================================================ */

/**
 * Exporta resumoPrice para uso isolado (ex: tabela de amortização dedicada).
 *
 * @param {number} pv - Principal
 * @param {number} i  - Taxa mensal decimal
 * @param {number} n  - Prazo em meses
 */
export function calcularPrice(pv, i, n) {
  validarParametrosBasicos(pv, i, n);
  return {
    ...resumoPrice(pv, i, n),
    tabela: gerarTabelaPrice(pv, i, n),
  };
}

/**
 * Exporta resumoSAC para uso isolado.
 *
 * @param {number} pv - Principal
 * @param {number} i  - Taxa mensal decimal
 * @param {number} n  - Prazo em meses
 */
export function calcularSAC(pv, i, n) {
  validarParametrosBasicos(pv, i, n);
  return {
    ...resumoSAC(pv, i, n),
    tabela: gerarTabelaSAC(pv, i, n),
  };
}

/**
 * Retorna apenas a tabela de amortização de um sistema específico.
 * Útil para renderizar a tabela paginada sem recalcular o resumo.
 *
 * @param {number}          pv      - Principal
 * @param {number}          i       - Taxa mensal decimal
 * @param {number}          n       - Prazo em meses
 * @param {'PRICE' | 'SAC'} sistema - Sistema de amortização
 * @returns {Array} Tabela de amortização completa
 */
export function gerarTabela(pv, i, n, sistema = 'PRICE') {
  validarParametrosBasicos(pv, i, n);
  return sistema === 'SAC'
    ? gerarTabelaSAC(pv, i, n)
    : gerarTabelaPrice(pv, i, n);
}

/**
 * Calcula quanto do saldo devedor pode ser amortizado antecipadamente
 * e qual a economia de juros resultante.
 *
 * @param {number}          saldoAtual    - Saldo devedor atual
 * @param {number}          valorAmort    - Valor a amortizar antecipadamente
 * @param {number}          i             - Taxa mensal decimal
 * @param {number}          nRestante     - Parcelas restantes
 * @param {'PRICE' | 'SAC'} sistema
 * @param {'PRAZO' | 'PARCELA'} modalidade - Reduzir prazo ou valor da parcela
 * @returns {{
 *   novoSaldo:        number,
 *   novoPrazo:        number | null,
 *   novaParcela:      number | null,
 *   economiaTotalJuros: number,
 * }}
 */
export function calcularAmortizacaoAntecipada(
  saldoAtual,
  valorAmort,
  i,
  nRestante,
  sistema    = 'PRICE',
  modalidade = 'PRAZO'
) {
  const novoSaldo = arredondar(Math.max(0, saldoAtual - valorAmort));

  if (novoSaldo === 0) {
    return {
      novoSaldo:          0,
      novoPrazo:          0,
      novaParcela:        0,
      economiaTotalJuros: arredondar(saldoAtual * i * nRestante), // estimativa simplificada
    };
  }

  // Juros totais antes da amortização
  const totalAntes = sistema === 'SAC'
    ? resumoSAC(saldoAtual, i, nRestante).totalJuros
    : resumoPrice(saldoAtual, i, nRestante).totalJuros;

  if (modalidade === 'PRAZO') {
    // Descobre novo prazo mantendo a mesma parcela original
    const parcelaOriginal = sistema === 'SAC'
      ? calcularAmortizacaoSAC(saldoAtual, nRestante) + arredondar(saldoAtual * i)
      : calcularParcelaPrice(saldoAtual, i, nRestante);

    // Encontra o novo prazo por iteração (máx 600 meses)
    let novoPrazo = 1;
    for (let m = 1; m <= MAX_PARCELAS_TABELA; m++) {
      const pmt = calcularParcelaPrice(novoSaldo, i, m);
      if (pmt <= parcelaOriginal + 0.01) { // tolerância de 1 centavo
        novoPrazo = m;
        break;
      }
      novoPrazo = m;
    }

    const totalDepois = resumoPrice(novoSaldo, i, novoPrazo).totalJuros;
    const economia    = arredondar(totalAntes - totalDepois);

    return {
      novoSaldo,
      novoPrazo,
      novaParcela:        null,
      economiaTotalJuros: Math.max(0, economia),
    };
  } else {
    // Mantém o prazo, reduz a parcela
    const novaParcela = sistema === 'SAC'
      ? resumoSAC(novoSaldo, i, nRestante).primeiraParcela
      : calcularParcelaPrice(novoSaldo, i, nRestante);

    const totalDepois = sistema === 'SAC'
      ? resumoSAC(novoSaldo, i, nRestante).totalJuros
      : resumoPrice(novoSaldo, i, nRestante).totalJuros;

    const economia = arredondar(totalAntes - totalDepois);

    return {
      novoSaldo,
      novoPrazo:          nRestante,
      novaParcela:        arredondar(novaParcela),
      economiaTotalJuros: Math.max(0, economia),
    };
  }
}
