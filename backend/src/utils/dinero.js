'use strict';

/**
 * Los montos se manejan internamente en CENTAVOS (enteros) para evitar
 * errores de punto flotante (0.1 + 0.2 ≠ 0.3).
 */
const aCentavos = (monto) => Math.round(Number(monto) * 100);
const deCentavos = (centavos) => Math.round(centavos) / 100;

/** Formato de presentación en quetzales: Q 20,000.00 */
const formatoQ = (monto) =>
  `Q ${Number(monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** ¿Tiene como máximo 2 decimales? */
const esMontoValido = (monto) =>
  typeof monto === 'number' && Number.isFinite(monto) && monto > 0 && monto <= 999_999_999.99 && Math.abs(monto * 100 - Math.round(monto * 100)) < 1e-6;

module.exports = { aCentavos, deCentavos, formatoQ, esMontoValido };
