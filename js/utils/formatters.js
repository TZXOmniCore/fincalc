/**
 * @file formatters.js
 * @description Funções de formatação e apresentação de dados para o projeto FinCalc.
 *              Todas as funções são puras — recebem um valor e retornam uma string
 *              formatada. Nenhuma função manipula o DOM ou possui efeitos colaterais.
 *              Padrão de localização: pt-BR (Real brasileiro, vírgula decimal).
 *
 * @module Formatters
 *
 * ORDEM DE IMPORTAÇÃO:
 *   Este arquivo não possui dependências internas.
 *   Deve ser importado antes de qualquer módulo que precise formatar dados.
 *
 * USO:
 *   import { formatCurrency, formatPercent, formatNumber } from '../utils/formatters.js';
 */

'use strict';

/* ============================================================
   CONFIGURAÇÕES GLOBAIS DE LOCALIZAÇÃO
   ============================================================ */

/** Locale padrão do projeto — Português do Brasil */
const LOCALE = 'pt-BR';

/** Moeda padrão do projeto */
const CURRENCY = 'BRL';

/* ============================================================
   FORMATADORES DE MOEDA
   ============================================================ */

/**
 * Formata um número como moeda em Real Brasileiro (R$).
 *
 * @param {number} value - Valor numérico a formatar
 * @param {object} [options={}] - Opções adicionais
 * @param {boolean} [options.showSymbol=true] - Exibir símbolo "R$"
 * @param {number}  [options.decimals=2] - Número de casas decimais
 * @param {boolean} [options.compact=false] - Formato compacto (R$ 1,5 Mi)
 * @returns {string} Valor formatado. Ex: "R$ 1.250,00"
 *
 * @example
 * formatCurrency(1250)        // "R$ 1.250,00"
 * formatCurrency(1250, { showSymbol: false }) // "1.250,00"
 * formatCurrency(0)           // "R$ 0,00"
 * formatCurrency(-500)        // "-R$ 500,00"
 * formatCurrency(1500000, { compact: true }) // "R$ 1,5 Mi"
 */
export function formatCurrency(value, options = {}) {
  const {
    showSymbol = true,
    decimals   = 2,
    compact    = false,
  } = options;

  const num = Number(value);

  if (!isFinite(num)) return showSymbol ? 'R$ 0,00' : '0,00';

  if (compact && Math.abs(num) >= 1_000_000) {
    const millions  = num / 1_000_000;
    const formatted = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(millions);
    return showSymbol ? `R$ ${formatted} Mi` : `${formatted} Mi`;
  }

  if (compact && Math.abs(num) >= 1_000) {
    const thousands = num / 1_000;
    const formatted = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(thousands);
    return showSymbol ? `R$ ${formatted} Mil` : `${formatted} Mil`;
  }

  const formatted = new Intl.NumberFormat(LOCALE, {
    style:                 showSymbol ? 'currency' : 'decimal',
    currency:              CURRENCY,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);

  return formatted;
}

/**
 * Formata um valor como diferença monetária, com sinal explícito.
 * Usado para comparativos (economia, diferença entre sistemas).
 *
 * @param {number} value - Valor da diferença
 * @returns {string} Valor formatado com sinal. Ex: "+R$ 350,00" ou "-R$ 350,00"
 *
 * @example
 * formatCurrencyDiff(350)   // "+R$ 350,00"
 * formatCurrencyDiff(-350)  // "-R$ 350,00"
 * formatCurrencyDiff(0)     // "R$ 0,00"
 */
export function formatCurrencyDiff(value) {
  const num = Number(value);
  if (!isFinite(num) || num === 0) return formatCurrency(0);
  const sign = num > 0 ? '+' : '';
  return `${sign}${formatCurrency(num)}`;
}

/* ============================================================
   FORMATADORES DE PORCENTAGEM
   ============================================================ */

/**
 * Formata um número como porcentagem em pt-BR.
 *
 * @param {number} value    - Valor em decimal (0.01 = 1%) ou inteiro (1 = 1%)
 * @param {object} [options={}]
 * @param {boolean} [options.isDecimal=false] - Se true, multiplica por 100 antes de formatar
 * @param {number}  [options.decimals=2] - Casas decimais
 * @param {boolean} [options.showSymbol=true] - Exibir símbolo "%"
 * @returns {string} Porcentagem formatada. Ex: "1,25%"
 *
 * @example
 * formatPercent(1.25)                        // "1,25%"
 * formatPercent(0.0125, { isDecimal: true }) // "1,25%"
 * formatPercent(12)                          // "12,00%"
 * formatPercent(0.5, { decimals: 0 })        // "0%"  (isDecimal: false)
 */
export function formatPercent(value, options = {}) {
  const {
    isDecimal  = false,
    decimals   = 2,
    showSymbol = true,
  } = options;

  const num = Number(value);

  if (!isFinite(num)) return showSymbol ? '0,00%' : '0,00';

  const display = isDecimal ? num * 100 : num;

  const formatted = new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(display);

  return showSymbol ? `${formatted}%` : formatted;
}

/**
 * Converte taxa anual para mensal equivalente (juros compostos).
 * Retorna o valor decimal já pronto para cálculo (ex: 0.01 para 1% a.m.).
 *
 * @param {number} annualRate - Taxa anual em porcentagem (ex: 12 para 12% a.a.)
 * @returns {number} Taxa mensal equivalente em decimal
 *
 * @example
 * annualToMonthlyRate(12)  // ≈ 0.009489 (0,9489% a.m.)
 * annualToMonthlyRate(0)   // 0
 */
export function annualToMonthlyRate(annualRate) {
  const num = Number(annualRate);
  if (!isFinite(num) || num <= 0) return 0;
  return Math.pow(1 + num / 100, 1 / 12) - 1;
}

/**
 * Converte taxa mensal para anual equivalente (juros compostos).
 *
 * @param {number} monthlyRate - Taxa mensal em porcentagem (ex: 1 para 1% a.m.)
 * @returns {number} Taxa anual equivalente em porcentagem
 *
 * @example
 * monthlyToAnnualRate(1)   // ≈ 12.68 (12,68% a.a.)
 */
export function monthlyToAnnualRate(monthlyRate) {
  const num = Number(monthlyRate);
  if (!isFinite(num) || num <= 0) return 0;
  return (Math.pow(1 + num / 100, 12) - 1) * 100;
}

/* ============================================================
   FORMATADORES NUMÉRICOS
   ============================================================ */

/**
 * Formata um número com separadores de milhar em pt-BR.
 *
 * @param {number} value
 * @param {number} [decimals=2] - Casas decimais
 * @returns {string} Ex: "1.250,50"
 *
 * @example
 * formatNumber(1250.5)     // "1.250,50"
 * formatNumber(1250.5, 0) // "1.251"
 */
export function formatNumber(value, decimals = 2) {
  const num = Number(value);
  if (!isFinite(num)) return '0';
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formata um número inteiro sem casas decimais e com separador de milhar.
 *
 * @param {number} value
 * @returns {string} Ex: "1.250"
 *
 * @example
 * formatInteger(1250) // "1.250"
 * formatInteger(42)   // "42"
 */
export function formatInteger(value) {
  return formatNumber(value, 0);
}

/* ============================================================
   FORMATADORES DE TEMPO / PRAZO
   ============================================================ */

/**
 * Formata um prazo em meses para string legível em português.
 *
 * @param {number} months - Número de meses
 * @param {object} [options={}]
 * @param {boolean} [options.short=false] - Formato abreviado
 * @returns {string} Ex: "360 meses (30 anos)"
 *
 * @example
 * formatPrazo(360)              // "360 meses (30 anos)"
 * formatPrazo(18)               // "18 meses (1 ano e 6 meses)"
 * formatPrazo(12)               // "12 meses (1 ano)"
 * formatPrazo(6)                // "6 meses"
 * formatPrazo(360, { short: true }) // "360 meses"
 */
export function formatPrazo(months, options = {}) {
  const { short = false } = options;
  const n = Math.round(Number(months));

  if (!isFinite(n) || n <= 0) return '0 meses';

  const mesesLabel = n === 1 ? 'mês' : 'meses';
  const base = `${n} ${mesesLabel}`;

  if (short) return base;

  const anos    = Math.floor(n / 12);
  const meses   = n % 12;

  if (anos === 0) return base;

  const anosLabel  = anos  === 1 ? 'ano'  : 'anos';
  const mesesPart  = meses === 0 ? '' : ` e ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  const anosStr    = `${anos} ${anosLabel}${mesesPart}`;

  return `${base} (${anosStr})`;
}

/**
 * Formata uma data no formato brasileiro (DD/MM/AAAA).
 *
 * @param {Date|string|number} date - Data a formatar
 * @returns {string} Data formatada. Ex: "15/03/2025"
 *
 * @example
 * formatDate(new Date())         // "12/05/2026"
 * formatDate('2025-03-15')       // "15/03/2025"
 */
export function formatDate(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(LOCALE, {
      day:   '2-digit',
      month: '2-digit',
      year:  'numeric',
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Retorna o mês e ano no formato "Jan/2025".
 *
 * @param {Date|string|number} date
 * @returns {string} Ex: "Mar/2025"
 */
export function formatMonthYear(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    const mes = new Intl.DateTimeFormat(LOCALE, { month: 'short' }).format(d);
    const ano = d.getFullYear();
    // Capitaliza primeira letra e remove ponto final que alguns browsers adicionam
    const mesFormatado = mes.charAt(0).toUpperCase() + mes.slice(1).replace('.', '');
    return `${mesFormatado}/${ano}`;
  } catch {
    return '—';
  }
}

/**
 * Calcula a data de término de um financiamento dado o início e o prazo.
 *
 * @param {Date|string} startDate - Data de início (primeira parcela)
 * @param {number} months         - Prazo em meses
 * @returns {string} Data de término formatada. Ex: "Mai/2056"
 *
 * @example
 * calcEndDate('2026-05-01', 360) // "Mai/2056"
 */
export function calcEndDate(startDate, months) {
  try {
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return '—';
    d.setMonth(d.getMonth() + Math.round(Number(months)));
    return formatMonthYear(d);
  } catch {
    return '—';
  }
}

/* ============================================================
   FORMATADORES DE INPUT (máscaras)
   Usadas em event listeners de inputs do formulário.
   Retornam o valor formatado para exibir no campo.
   ============================================================ */

/**
 * Aplica máscara de moeda brasileira em tempo real enquanto o usuário digita.
 * Remove tudo que não é dígito e formata como "R$ 1.250,00".
 *
 * @param {string} rawValue - Valor bruto do input (event.target.value)
 * @returns {string} Valor mascarado. Ex: "R$ 1.250,00"
 *
 * @example
 * maskCurrency('125000')    // "R$ 1.250,00"
 * maskCurrency('1250,50')   // "R$ 1.250,50"
 * maskCurrency('')          // ""
 */
export function maskCurrency(rawValue) {
  // Remove tudo que não é dígito
  const digits = String(rawValue).replace(/\D/g, '');

  if (digits === '' || digits === '0' || digits === '00') return '';

  // Converte para centavos e formata
  const cents = parseInt(digits, 10);
  const reais = cents / 100;

  return formatCurrency(reais);
}

/**
 * Aplica máscara de porcentagem em tempo real.
 * Limita a 2 casas decimais e ao range 0–100.
 *
 * @param {string} rawValue - Valor bruto do input
 * @returns {string} Valor mascarado. Ex: "1,25"
 *
 * @example
 * maskPercent('125')   // "1,25"
 * maskPercent('1250')  // "12,50"
 * maskPercent('abc')   // ""
 */
export function maskPercent(rawValue) {
  const digits = String(rawValue).replace(/\D/g, '');

  if (digits === '' || digits === '0' || digits === '00') return '';

  const num = parseInt(digits, 10);
  const value = num / 100;

  // Limite máximo de 99,99%
  const clamped = Math.min(value, 99.99);

  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(clamped);
}

/**
 * Aplica máscara de número inteiro positivo em tempo real.
 * Remove zeros à esquerda e caracteres não numéricos.
 *
 * @param {string} rawValue - Valor bruto do input
 * @param {number} [max]    - Valor máximo permitido
 * @returns {string} Valor mascarado. Ex: "360"
 *
 * @example
 * maskInteger('0360')   // "360"
 * maskInteger('abc')    // ""
 * maskInteger('500', 420) // "420"
 */
export function maskInteger(rawValue, max) {
  const digits = String(rawValue).replace(/\D/g, '');
  if (digits === '') return '';

  let num = parseInt(digits, 10);
  if (isNaN(num)) return '';
  if (max !== undefined && num > max) num = max;

  return String(num);
}

/* ============================================================
   PARSERS — CONVERTER VALOR FORMATADO DE VOLTA PARA NÚMERO
   Necessários para ler o valor de inputs mascarados.
   ============================================================ */

/**
 * Converte um valor formatado em pt-BR de volta para número.
 * Funciona com moeda, porcentagem e números formatados.
 *
 * @param {string} formattedValue - Valor formatado. Ex: "R$ 1.250,00" ou "1,25"
 * @returns {number} Número puro. Ex: 1250.00 ou 1.25
 *
 * @example
 * parseFormattedNumber('R$ 1.250,00') // 1250
 * parseFormattedNumber('1,25%')       // 1.25
 * parseFormattedNumber('360')         // 360
 * parseFormattedNumber('')            // 0
 */
export function parseFormattedNumber(formattedValue) {
  if (!formattedValue && formattedValue !== 0) return 0;

  const str = String(formattedValue)
    .replace(/R\$\s?/g, '')   // remove símbolo R$
    .replace(/%/g, '')         // remove símbolo %
    .replace(/\./g, '')        // remove pontos de milhar
    .replace(',', '.')         // substitui vírgula decimal por ponto
    .trim();

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Alias semântico de parseFormattedNumber para valores de moeda.
 *
 * @param {string} formattedValue - Ex: "R$ 1.250,00"
 * @returns {number} Ex: 1250
 */
export function parseCurrency(formattedValue) {
  return parseFormattedNumber(formattedValue);
}

/**
 * Alias semântico de parseFormattedNumber para valores de porcentagem.
 *
 * @param {string} formattedValue - Ex: "1,25"
 * @returns {number} Ex: 1.25 (não em decimal — retorna 1.25, não 0.0125)
 */
export function parsePercent(formattedValue) {
  return parseFormattedNumber(formattedValue);
}

/* ============================================================
   FORMATADORES DE RESULTADO — APRESENTAÇÃO NAS CALCULADORAS
   ============================================================ */

/**
 * Formata o resumo de um financiamento para exibição no card de resultado.
 * Retorna um objeto com todos os valores já formatados como string.
 *
 * @param {object} result - Objeto resultado do cálculo
 * @param {number} result.parcela          - Valor da parcela (Price) ou 1ª parcela (SAC)
 * @param {number} result.totalPago        - Total pago ao longo do financiamento
 * @param {number} result.totalJuros       - Total de juros pagos
 * @param {number} result.valorFinanciado  - Valor principal financiado
 * @param {number} result.prazoMeses       - Prazo em meses
 * @param {number} [result.taxaMensal]     - Taxa mensal usada no cálculo
 * @param {number} [result.cet]            - CET anual calculado
 * @returns {object} Mesmo objeto com campos "_fmt" adicionados (strings formatadas)
 *
 * @example
 * const r = formatResultado({ parcela: 1250.50, totalPago: 450180, ... });
 * r.parcela_fmt    // "R$ 1.250,50"
 * r.totalPago_fmt  // "R$ 450.180,00"
 */
export function formatResultado(result) {
  if (!result || typeof result !== 'object') return {};

  return {
    ...result,
    parcela_fmt:         formatCurrency(result.parcela         ?? 0),
    totalPago_fmt:       formatCurrency(result.totalPago       ?? 0),
    totalJuros_fmt:      formatCurrency(result.totalJuros      ?? 0),
    valorFinanciado_fmt: formatCurrency(result.valorFinanciado ?? 0),
    prazo_fmt:           formatPrazo(result.prazoMeses         ?? 0),
    taxaMensal_fmt:      result.taxaMensal != null
                           ? formatPercent(result.taxaMensal * 100)
                           : null,
    cet_fmt:             result.cet != null
                           ? formatPercent(result.cet)
                           : null,
  };
}

/* ============================================================
   UTILITÁRIOS DE TEXTO
   ============================================================ */

/**
 * Trunca um texto longo adicionando reticências no final.
 *
 * @param {string} text    - Texto a truncar
 * @param {number} maxLength - Comprimento máximo (incluindo "...")
 * @returns {string}
 *
 * @example
 * truncate('Calculadora de Financiamento Imobiliário', 30)
 * // "Calculadora de Financiamento..."
 */
export function truncate(text, maxLength) {
  const str = String(text);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Converte string para slug URL-friendly (sem acentos, minúsculas, hífens).
 *
 * @param {string} text
 * @returns {string}
 *
 * @example
 * toSlug('Financiamento Imobiliário 2025') // "financiamento-imobiliario-2025"
 */
export function toSlug(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos (acentos)
    .replace(/[^a-z0-9\s-]/g, '')   // remove caracteres especiais
    .replace(/\s+/g, '-')           // espaços por hífens
    .replace(/-+/g, '-')            // múltiplos hífens por um
    .replace(/^-|-$/g, '');         // remove hífens no início/fim
}

/**
 * Capitaliza a primeira letra de cada palavra.
 *
 * @param {string} text
 * @returns {string}
 *
 * @example
 * toTitleCase('calculadora de financiamento') // "Calculadora De Financiamento"
 */
export function toTitleCase(text) {
  return String(text)
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}
