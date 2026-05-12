/**
 * @file validators.js
 * @description Validação e sanitização de inputs do projeto FinCalc.
 *              Todas as funções são puras — sem efeitos colaterais, sem DOM.
 *              Devem ser chamadas ANTES de qualquer cálculo financeiro.
 *              Nenhum dado do usuário chega aos calculators sem passar por aqui.
 *
 * @module Validators
 *
 * DEPENDÊNCIAS: nenhuma
 *
 * USO:
 *   import { validateFinanciamento, sanitizeNumber } from '../utils/validators.js';
 */

'use strict';

/* ============================================================
   CONSTANTES DE LIMITES — REGRAS DE NEGÓCIO
   Alterar aqui reflete em toda a validação do projeto.
   ============================================================ */

/** Limites gerais de valores financiados */
const LIMITS = {
  VALOR_MIN:          1_000,       // R$ 1.000 — mínimo financiável
  VALOR_MAX:          50_000_000,  // R$ 50 milhões — máximo financiável
  ENTRADA_MIN_PCT:    0,           // 0% — entrada opcional
  ENTRADA_MAX_PCT:    99,          // 99% — entrada não pode ser o valor total
  TAXA_MENSAL_MIN:    0.01,        // 0,01% a.m. — taxa mínima aceita
  TAXA_MENSAL_MAX:    30,          // 30% a.m. — limite absurdo, proteção
  TAXA_ANUAL_MIN:     0.1,         // 0,1% a.a.
  TAXA_ANUAL_MAX:     360,         // 360% a.a.
  PRAZO_MIN_MESES:    1,           // 1 mês
  PRAZO_MAX_MESES:    600,         // 50 anos — máximo absoluto
  PRAZO_FINANC_MAX:   420,         // 35 anos — máximo para financiamento imobiliário
  PRAZO_CONSORCIO_MAX:240,         // 20 anos — máximo para consórcio
  RENDA_MIN:          0,
  RENDA_MAX:          10_000_000,  // R$ 10 milhões de renda mensal
  TAXA_ADM_MIN:       0,           // 0% — taxa adm consórcio
  TAXA_ADM_MAX:       30,          // 30% — máximo taxa adm
  FGTS_MIN:           0,
  FGTS_MAX:           5_000_000,   // R$ 5 milhões FGTS
  LANCE_MIN_PCT:      0,
  LANCE_MAX_PCT:      99,
};

/* ============================================================
   TIPOS DE RESULTADO DE VALIDAÇÃO
   ============================================================ */

/**
 * Cria um resultado de validação de sucesso.
 * @param {*} value - Valor sanitizado e validado
 * @returns {{ valid: true, value: *, error: null }}
 */
function ok(value) {
  return { valid: true, value, error: null };
}

/**
 * Cria um resultado de validação de erro.
 * @param {string} message - Mensagem de erro legível pelo usuário
 * @param {string} [field]  - Nome do campo com erro
 * @returns {{ valid: false, value: null, error: string, field: string|undefined }}
 */
function fail(message, field) {
  return { valid: false, value: null, error: message, field };
}

/* ============================================================
   SANITIZADORES PRIMITIVOS
   Limpam o valor bruto antes de validar.
   ============================================================ */

/**
 * Sanitiza e converte para número qualquer valor de input.
 * Aceita formatos pt-BR (vírgula como decimal, ponto como milhar).
 *
 * @param {string|number} value - Valor bruto do input
 * @returns {number} Número limpo, ou NaN se inválido
 *
 * @example
 * sanitizeNumber('R$ 1.250,50') // 1250.5
 * sanitizeNumber('1,25')        // 1.25
 * sanitizeNumber('abc')         // NaN
 * sanitizeNumber(1250)          // 1250
 */
export function sanitizeNumber(value) {
  if (value === null || value === undefined || value === '') return NaN;
  if (typeof value === 'number') return isFinite(value) ? value : NaN;

  const str = String(value)
    .replace(/R\$\s?/g, '')   // remove símbolo R$
    .replace(/%/g, '')         // remove %
    .replace(/\s/g, '')        // remove espaços
    .replace(/\./g, '')        // remove pontos de milhar (pt-BR)
    .replace(',', '.');        // vírgula decimal → ponto

  const num = parseFloat(str);
  return isNaN(num) ? NaN : num;
}

/**
 * Sanitiza string removendo caracteres potencialmente perigosos.
 * Uso: campos de texto livre (comentários, nomes).
 *
 * @param {string} value
 * @param {number} [maxLength=200]
 * @returns {string}
 */
export function sanitizeText(value, maxLength = 200) {
  return String(value ?? '')
    .trim()
    .slice(0, maxLength)
    .replace(/[<>"'`\\]/g, ''); // remove caracteres de injeção
}

/**
 * Garante que um número esteja dentro de um intervalo [min, max].
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

/* ============================================================
   VALIDADORES PRIMITIVOS
   ============================================================ */

/**
 * Valida que o valor é um número finito dentro de um intervalo.
 *
 * @param {*} value
 * @param {number} min
 * @param {number} max
 * @param {string} fieldLabel - Nome legível do campo para mensagem de erro
 * @param {string} [field]    - Chave do campo para referência no objeto de erros
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateRange(value, min, max, fieldLabel, field) {
  const num = sanitizeNumber(value);

  if (isNaN(num)) {
    return fail(`${fieldLabel} deve ser um número válido.`, field);
  }

  if (num < min) {
    return fail(
      `${fieldLabel} deve ser no mínimo ${min.toLocaleString('pt-BR')}.`,
      field
    );
  }

  if (num > max) {
    return fail(
      `${fieldLabel} deve ser no máximo ${max.toLocaleString('pt-BR')}.`,
      field
    );
  }

  return ok(num);
}

/**
 * Valida que o valor é um número positivo (maior que zero).
 *
 * @param {*} value
 * @param {string} fieldLabel
 * @param {string} [field]
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validatePositive(value, fieldLabel, field) {
  const num = sanitizeNumber(value);

  if (isNaN(num)) {
    return fail(`${fieldLabel} deve ser um número válido.`, field);
  }

  if (num <= 0) {
    return fail(`${fieldLabel} deve ser maior que zero.`, field);
  }

  return ok(num);
}

/* ============================================================
   VALIDADORES DE CAMPOS ESPECÍFICOS
   Cada função valida UM campo do formulário.
   ============================================================ */

/**
 * Valida o valor do imóvel / bem financiado.
 *
 * @param {*} value
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateValorImovel(value) {
  return validateRange(
    value,
    LIMITS.VALOR_MIN,
    LIMITS.VALOR_MAX,
    'O valor do imóvel',
    'valorImovel'
  );
}

/**
 * Valida o valor de entrada (down payment).
 * A entrada não pode ser maior ou igual ao valor do imóvel.
 *
 * @param {*} entrada        - Valor da entrada
 * @param {*} valorImovel    - Valor total do imóvel (já validado)
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateEntrada(entrada, valorImovel) {
  const numEntrada = sanitizeNumber(entrada);
  const numImovel  = sanitizeNumber(valorImovel);

  if (isNaN(numEntrada)) {
    return fail('A entrada deve ser um número válido.', 'entrada');
  }

  if (numEntrada < 0) {
    return fail('A entrada não pode ser negativa.', 'entrada');
  }

  if (!isNaN(numImovel) && numImovel > 0) {
    if (numEntrada >= numImovel) {
      return fail(
        'A entrada deve ser menor que o valor total do imóvel.',
        'entrada'
      );
    }
    const pct = (numEntrada / numImovel) * 100;
    if (pct > LIMITS.ENTRADA_MAX_PCT) {
      return fail(
        `A entrada não pode ultrapassar ${LIMITS.ENTRADA_MAX_PCT}% do valor do imóvel.`,
        'entrada'
      );
    }
  }

  return ok(numEntrada);
}

/**
 * Valida a taxa de juros mensal (em porcentagem, não decimal).
 *
 * @param {*} value - Ex: 1.25 para 1,25% a.m.
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateTaxaMensal(value) {
  return validateRange(
    value,
    LIMITS.TAXA_MENSAL_MIN,
    LIMITS.TAXA_MENSAL_MAX,
    'A taxa de juros mensal',
    'taxaMensal'
  );
}

/**
 * Valida a taxa de juros anual (em porcentagem, não decimal).
 *
 * @param {*} value - Ex: 12 para 12% a.a.
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateTaxaAnual(value) {
  return validateRange(
    value,
    LIMITS.TAXA_ANUAL_MIN,
    LIMITS.TAXA_ANUAL_MAX,
    'A taxa de juros anual',
    'taxaAnual'
  );
}

/**
 * Valida o prazo em meses para financiamento imobiliário.
 *
 * @param {*} value - Número de meses
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validatePrazoFinanciamento(value) {
  const result = validateRange(
    value,
    LIMITS.PRAZO_MIN_MESES,
    LIMITS.PRAZO_FINANC_MAX,
    'O prazo',
    'prazo'
  );

  if (!result.valid) return result;

  // Prazo deve ser inteiro
  return ok(Math.round(result.value));
}

/**
 * Valida o prazo em meses para consórcio.
 *
 * @param {*} value - Número de meses
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validatePrazoConsorcio(value) {
  const result = validateRange(
    value,
    LIMITS.PRAZO_MIN_MESES,
    LIMITS.PRAZO_CONSORCIO_MAX,
    'O prazo do consórcio',
    'prazo'
  );

  if (!result.valid) return result;
  return ok(Math.round(result.value));
}

/**
 * Valida a taxa de administração do consórcio (em porcentagem total, não mensal).
 *
 * @param {*} value - Ex: 18 para 18% total
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateTaxaAdm(value) {
  return validateRange(
    value,
    LIMITS.TAXA_ADM_MIN,
    LIMITS.TAXA_ADM_MAX,
    'A taxa de administração',
    'taxaAdm'
  );
}

/**
 * Valida o percentual de lance no consórcio.
 *
 * @param {*} value - Ex: 20 para 20% de lance
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateLance(value) {
  return validateRange(
    value,
    LIMITS.LANCE_MIN_PCT,
    LIMITS.LANCE_MAX_PCT,
    'O percentual de lance',
    'lance'
  );
}

/**
 * Valida o valor do FGTS a utilizar.
 *
 * @param {*} value
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateFGTS(value) {
  const num = sanitizeNumber(value);

  if (isNaN(num) || num < 0) {
    return fail('O valor do FGTS deve ser zero ou positivo.', 'fgts');
  }

  if (num > LIMITS.FGTS_MAX) {
    return fail(
      `O valor do FGTS não pode ultrapassar R$ ${LIMITS.FGTS_MAX.toLocaleString('pt-BR')}.`,
      'fgts'
    );
  }

  return ok(num);
}

/**
 * Valida a renda mensal bruta.
 *
 * @param {*} value
 * @returns {{ valid: boolean, value: number|null, error: string|null }}
 */
export function validateRenda(value) {
  return validateRange(
    value,
    LIMITS.RENDA_MIN,
    LIMITS.RENDA_MAX,
    'A renda mensal',
    'renda'
  );
}

/* ============================================================
   VALIDADORES DE FORMULÁRIO COMPLETO
   Validam todos os campos de uma vez e retornam um mapa de erros.
   ============================================================ */

/**
 * Valida todos os campos do formulário de financiamento.
 * Retorna os dados sanitizados ou um mapa de erros por campo.
 *
 * @param {object} fields
 * @param {*} fields.valorImovel    - Valor do imóvel
 * @param {*} fields.entrada        - Valor de entrada
 * @param {*} fields.taxaMensal     - Taxa de juros mensal (%)
 * @param {*} fields.prazo          - Prazo em meses
 * @param {*} [fields.fgts]         - FGTS (opcional)
 * @param {*} [fields.renda]        - Renda mensal (opcional, para cálculo de comprometimento)
 *
 * @returns {{
 *   valid: boolean,
 *   data: object|null,
 *   errors: object
 * }}
 *
 * @example
 * const result = validateFinanciamento({
 *   valorImovel: 'R$ 500.000,00',
 *   entrada: 'R$ 100.000,00',
 *   taxaMensal: '1,25',
 *   prazo: '360',
 * });
 *
 * if (result.valid) {
 *   calcularFinanciamento(result.data);
 * } else {
 *   exibirErros(result.errors);
 * }
 */
export function validateFinanciamento(fields) {
  const errors = {};

  // 1. Valor do imóvel
  const vImovel = validateValorImovel(fields.valorImovel);
  if (!vImovel.valid) errors.valorImovel = vImovel.error;

  // 2. Entrada
  const vEntrada = validateEntrada(fields.entrada, fields.valorImovel);
  if (!vEntrada.valid) errors.entrada = vEntrada.error;

  // 3. Taxa mensal
  const vTaxa = validateTaxaMensal(fields.taxaMensal);
  if (!vTaxa.valid) errors.taxaMensal = vTaxa.error;

  // 4. Prazo
  const vPrazo = validatePrazoFinanciamento(fields.prazo);
  if (!vPrazo.valid) errors.prazo = vPrazo.error;

  // 5. FGTS (opcional)
  let vFGTS = ok(0);
  if (fields.fgts !== undefined && fields.fgts !== '' && fields.fgts !== null) {
    vFGTS = validateFGTS(fields.fgts);
    if (!vFGTS.valid) errors.fgts = vFGTS.error;
  }

  // 6. Renda (opcional)
  let vRenda = ok(0);
  if (fields.renda !== undefined && fields.renda !== '' && fields.renda !== null) {
    vRenda = validateRenda(fields.renda);
    if (!vRenda.valid) errors.renda = vRenda.error;
  }

  // 7. Validação cruzada: FGTS não pode superar a entrada
  if (vFGTS.valid && vEntrada.valid && vFGTS.value > vEntrada.value) {
    errors.fgts = 'O FGTS não pode ser maior que o valor de entrada.';
  }

  const isValid = Object.keys(errors).length === 0;

  if (!isValid) {
    return { valid: false, data: null, errors };
  }

  // Monta objeto de dados sanitizados para os calculators
  const valorImovel    = vImovel.value;
  const entrada        = vEntrada.value;
  const fgts           = vFGTS.value;
  const valorFinanciado = valorImovel - entrada;

  return {
    valid: true,
    errors: {},
    data: {
      valorImovel,
      entrada,
      fgts,
      valorFinanciado,
      taxaMensal:   vTaxa.value / 100,  // convertido para decimal (ex: 0.0125)
      taxaMensalPct: vTaxa.value,        // mantido em % para exibição
      prazo:        vPrazo.value,
      renda:        vRenda.value,
    },
  };
}

/**
 * Valida todos os campos do formulário de consórcio.
 *
 * @param {object} fields
 * @param {*} fields.valorBem    - Valor do bem (carta de crédito)
 * @param {*} fields.taxaAdm    - Taxa de administração total (%)
 * @param {*} fields.prazo      - Prazo em meses
 * @param {*} [fields.lance]    - Percentual de lance (%)
 * @param {*} [fields.fgts]     - FGTS para lance (opcional)
 *
 * @returns {{ valid: boolean, data: object|null, errors: object }}
 */
export function validateConsorcio(fields) {
  const errors = {};

  // 1. Valor do bem
  const vBem = validateRange(
    fields.valorBem,
    LIMITS.VALOR_MIN,
    LIMITS.VALOR_MAX,
    'O valor do bem',
    'valorBem'
  );
  if (!vBem.valid) errors.valorBem = vBem.error;

  // 2. Taxa de administração
  const vTaxaAdm = validateTaxaAdm(fields.taxaAdm);
  if (!vTaxaAdm.valid) errors.taxaAdm = vTaxaAdm.error;

  // 3. Prazo
  const vPrazo = validatePrazoConsorcio(fields.prazo);
  if (!vPrazo.valid) errors.prazo = vPrazo.error;

  // 4. Lance (opcional)
  let vLance = ok(0);
  if (fields.lance !== undefined && fields.lance !== '' && fields.lance !== null) {
    vLance = validateLance(fields.lance);
    if (!vLance.valid) errors.lance = vLance.error;
  }

  // 5. FGTS (opcional)
  let vFGTS = ok(0);
  if (fields.fgts !== undefined && fields.fgts !== '' && fields.fgts !== null) {
    vFGTS = validateFGTS(fields.fgts);
    if (!vFGTS.valid) errors.fgts = vFGTS.error;
  }

  const isValid = Object.keys(errors).length === 0;

  if (!isValid) {
    return { valid: false, data: null, errors };
  }

  const valorBem = vBem.value;
  const lancePct = vLance.value;
  const valorLance = (lancePct / 100) * valorBem;

  return {
    valid: true,
    errors: {},
    data: {
      valorBem,
      taxaAdm:      vTaxaAdm.value,
      taxaAdmDecimal: vTaxaAdm.value / 100,
      prazo:        vPrazo.value,
      lancePct,
      valorLance,
      fgts:         vFGTS.value,
    },
  };
}

/* ============================================================
   HELPERS DE EXIBIÇÃO DE ERROS
   Usados pelo calculator-ui.js para mostrar erros na tela.
   ============================================================ */

/**
 * Verifica se um mapa de erros possui algum erro.
 *
 * @param {object} errors - Objeto retornado por validateFinanciamento / validateConsorcio
 * @returns {boolean}
 */
export function hasErrors(errors) {
  return errors && Object.keys(errors).length > 0;
}

/**
 * Retorna o primeiro erro de um mapa de erros (para exibir mensagem única).
 *
 * @param {object} errors
 * @returns {string|null}
 */
export function firstError(errors) {
  if (!hasErrors(errors)) return null;
  return Object.values(errors)[0];
}

/**
 * Retorna a lista de erros como array de strings.
 *
 * @param {object} errors
 * @returns {string[]}
 */
export function errorsToArray(errors) {
  if (!hasErrors(errors)) return [];
  return Object.values(errors);
}

/* ============================================================
   VALIDADORES DE SEGURANÇA GERAL
   ============================================================ */

/**
 * Verifica se uma string é uma URL válida e segura (HTTPS).
 * Nunca usada para redirect — apenas para validar campos de URL.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isValidHttpsUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Verifica se um valor é um número inteiro positivo.
 *
 * @param {*} value
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

/**
 * Verifica se o comprometimento de renda está dentro do limite seguro.
 * Bancos brasileiros geralmente aceitam até 30% da renda bruta.
 *
 * @param {number} parcela        - Valor da parcela mensal
 * @param {number} rendaMensal    - Renda mensal bruta
 * @param {number} [limite=0.30]  - Percentual máximo (padrão 30%)
 * @returns {{ dentro: boolean, percentual: number, limite: number }}
 */
export function verificarComprometimentoRenda(parcela, rendaMensal, limite = 0.30) {
  const p = Number(parcela);
  const r = Number(rendaMensal);

  if (!isFinite(p) || !isFinite(r) || r <= 0) {
    return { dentro: true, percentual: 0, limite };
  }

  const percentual = p / r;

  return {
    dentro:     percentual <= limite,
    percentual: percentual * 100,       // em % para exibição
    limite:     limite * 100,           // em % para exibição
  };
}

/* ============================================================
   EXPORTAÇÃO DE CONSTANTES
   Permite que outros módulos referenciem os limites sem hardcode.
   ============================================================ */

export { LIMITS };
