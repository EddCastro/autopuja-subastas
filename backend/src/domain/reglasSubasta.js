'use strict';

/**
 * REGLAS DE NEGOCIO DE LA SUBASTA (funciones puras, sin BD).
 * Se ejecutan SIEMPRE en el servidor, dentro de la transacción que bloquea
 * el vehículo, de modo que dos pujas simultáneas se evalúan en orden.
 *
 *  1. No se puede ofertar antes del inicio ni después del cierre.
 *  2. Ninguna oferta puede ser menor al monto base.
 *  3. Ninguna oferta puede ser menor o igual a la puja más alta actual.
 *  4. Incremento mínimo: cada nueva puja supera la actual en al menos 10 %.
 *  5. El publicador no puede ofertar por su propio vehículo.
 *  6. Quien ya tiene la oferta más alta no puede superarse a sí mismo.
 *  7. Al cierre: con al menos una puja → VENDIDA; sin pujas → DESIERTA.
 */
const { errores } = require('../utils/errors');
const { aCentavos, deCentavos, formatoQ, esMontoValido } = require('../utils/dinero');

const INCREMENTO_PCT = 10;

const ms = (f) => (f instanceof Date ? f.getTime() : new Date(f).getTime());

function estadoSubasta(v, ahora = new Date()) {
  const t = ms(ahora);
  if (v.resultado) return 'cerrada';
  if (t < ms(v.fechaInicio)) return 'proxima';
  if (t >= ms(v.fechaCierre)) return 'cerrada';
  return 'activa';
}

function resultadoSubasta(v, ahora = new Date()) {
  if (v.resultado) return String(v.resultado).toLowerCase();
  if (estadoSubasta(v, ahora) !== 'cerrada') return null;
  return v.totalPujas > 0 ? 'vendida' : 'desierta';
}

/** Oferta mínima aceptable en este momento (en centavos). */
function minimoSiguienteCentavos(v) {
  if (!v.totalPujas || v.montoActual == null) return aCentavos(v.precioBase);
  const actual = aCentavos(v.montoActual);
  // actual × 1.10 redondeado hacia arriba al centavo (aritmética entera)
  return Math.ceil((actual * (100 + INCREMENTO_PCT)) / 100);
}

const minimoSiguiente = (v) => deCentavos(minimoSiguienteCentavos(v));

/**
 * Valida una puja. Lanza AppError 422 con un código específico si no cumple.
 * @returns {{ montoCentavos:number }}
 */
function validarPuja({ vehiculo: v, usuarioId, monto, ahora = new Date() }) {
  if (!esMontoValido(monto)) {
    throw errores.validacion([{ campo: 'monto', mensaje: 'Ingrese un monto numérico mayor a 0 con máximo 2 decimales.' }], 'Monto inválido.');
  }

  const estado = estadoSubasta(v, ahora);
  if (estado === 'proxima') {
    throw errores.puja('SUBASTA_NO_INICIADA', 'La subasta aún no ha iniciado; todavía no se aceptan ofertas.', {
      fechaInicio: new Date(ms(v.fechaInicio)).toISOString()
    });
  }
  if (estado === 'cerrada') {
    throw errores.puja('SUBASTA_CERRADA', 'Oferta cerrada: el tiempo de la subasta terminó y ya no se aceptan ofertas.');
  }
  if (Number(v.usuarioId) === Number(usuarioId)) {
    throw errores.puja('PROPIETARIO_NO_PUEDE_OFERTAR', 'No puede ofertar por un vehículo que usted publicó.');
  }
  if (v.totalPujas > 0 && Number(v.liderUsuarioId) === Number(usuarioId)) {
    throw errores.puja('YA_ERES_LIDER', 'Ya tiene la oferta más alta en esta subasta.');
  }

  const montoC = aCentavos(monto);
  const baseC = aCentavos(v.precioBase);
  const minimoC = minimoSiguienteCentavos(v);
  const detalles = {
    precioBase: deCentavos(baseC),
    montoActual: v.totalPujas > 0 ? Number(v.montoActual) : null,
    minimo: deCentavos(minimoC)
  };

  if (montoC < baseC) {
    throw errores.puja('MONTO_MENOR_BASE', `La oferta no puede ser menor al monto base (${formatoQ(detalles.precioBase)}).`, detalles);
  }
  if (v.totalPujas > 0) {
    const actualC = aCentavos(v.montoActual);
    if (montoC <= actualC) {
      throw errores.puja(
        'MONTO_NO_SUPERA_ACTUAL',
        `La oferta debe ser mayor a la oferta actual (${formatoQ(detalles.montoActual)}). Mínimo: ${formatoQ(detalles.minimo)}.`,
        detalles
      );
    }
    if (montoC < minimoC) {
      throw errores.puja(
        'INCREMENTO_INSUFICIENTE',
        `Cada nueva puja debe superar la oferta actual en al menos ${INCREMENTO_PCT} %. Oferta mínima: ${formatoQ(detalles.minimo)}.`,
        detalles
      );
    }
  }
  return { montoCentavos: montoC };
}

/** Estado de la puja para un usuario concreto (indicador visual). */
function estadoParaUsuario({ vehiculo: v, usuarioId, haOfertado, ahora = new Date() }) {
  if (!usuarioId) return null;
  const esLider = v.totalPujas > 0 && Number(v.liderUsuarioId) === Number(usuarioId);
  const cerrada = estadoSubasta(v, ahora) === 'cerrada';
  if (esLider) return cerrada ? 'ganada' : 'ganando';
  if (haOfertado) return cerrada ? 'perdida' : 'superado';
  return null;
}

module.exports = {
  INCREMENTO_PCT,
  estadoSubasta,
  resultadoSubasta,
  minimoSiguiente,
  minimoSiguienteCentavos,
  validarPuja,
  estadoParaUsuario
};
