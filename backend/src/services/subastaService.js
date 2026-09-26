'use strict';

const { errores } = require('../utils/errors');
const { validarPuja, minimoSiguiente, estadoParaUsuario } = require('../domain/reglasSubasta');
const { vehiculoDto } = require('./dto');

/**
 * Motor de subastas: registra pujas (validadas en el servidor dentro de una
 * transacción con bloqueo del vehículo) y publica los eventos en tiempo real.
 */
function crearSubastaService({ repo, eventos }) {
  async function ofertar(usuarioId, vehiculoId, body) {
    const vid = Number(vehiculoId);
    if (!Number.isInteger(vid) || vid <= 0) throw errores.noEncontrado('El vehículo no existe.');
    const monto = typeof body?.monto === 'string' && body.monto.trim() !== '' ? Number(body.monto) : body?.monto;

    const r = await repo.transaccion(async (ops) => {
      const v = await ops.obtenerVehiculoBloqueado(vid); // bloquea la fila hasta el COMMIT
      if (!v) throw errores.noEncontrado('El vehículo no existe.');
      const ahora = new Date(); // la hora se toma DESPUÉS de obtener el bloqueo
      validarPuja({ vehiculo: v, usuarioId, monto, ahora });
      const puja = await ops.insertarPuja(vid, usuarioId, monto, ahora);
      await ops.registrarLider(vid, monto, usuarioId);
      return {
        puja,
        liderAnteriorId: v.totalPujas > 0 ? v.liderUsuarioId : null,
        nuevo: { ...v, montoActual: monto, totalPujas: v.totalPujas + 1, liderUsuarioId: usuarioId }
      };
    });

    const evento = {
      vehiculoId: vid,
      montoActual: monto,
      totalPujas: r.nuevo.totalPujas,
      minimoSiguiente: minimoSiguiente(r.nuevo),
      fecha: new Date(r.puja.fecha).toISOString(),
      liderUsuarioId: usuarioId,
      liderAnteriorId: r.liderAnteriorId
    };
    eventos.emit('puja:nueva', evento);

    return {
      mensaje: '¡Oferta registrada! Vas ganando esta subasta.',
      puja: { monto, fecha: evento.fecha },
      subasta: { montoActual: monto, totalPujas: evento.totalPujas, minimoSiguiente: evento.minimoSiguiente },
      miEstado: 'ganando'
    };
  }

  /** Historial anónimo: solo montos y fechas (y si la puja es del propio usuario). */
  async function historial(vehiculoId, usuarioId = null) {
    const vid = Number(vehiculoId);
    if (!Number.isInteger(vid) || vid <= 0 || !(await repo.obtenerVehiculo(vid))) throw errores.noEncontrado('El vehículo no existe.');
    const pujas = await repo.listarPujas(vid, 50);
    return pujas.map((p) => ({
      id: p.id,
      monto: p.monto,
      fecha: new Date(p.fecha).toISOString(),
      esMia: usuarioId ? Number(p.usuarioId) === Number(usuarioId) : false
    }));
  }

  async function misOfertas(usuarioId) {
    const ahora = new Date();
    const lista = await repo.misOfertas(usuarioId);
    return lista.map((v) => ({
      ...vehiculoDto(v, { ahora, usuarioId, haOfertado: true }),
      miMaximo: v.miMaximo,
      misPujas: v.misPujas,
      miUltimaPuja: new Date(v.miUltimaPuja).toISOString(),
      miEstado: estadoParaUsuario({ vehiculo: v, usuarioId, haOfertado: true, ahora })
    }));
  }

  /** Cierra subastas vencidas (una o todas) y notifica el resultado. */
  async function cerrarVencidas(id = null) {
    const cerradas = await repo.cerrarVencidas(new Date(), id);
    for (const c of cerradas) {
      const postores = c.totalPujas > 0 ? await repo.listarPostores(c.id) : [];
      eventos.emit('subasta:cerrada', { vehiculoId: c.id, resultado: c.resultado, montoFinal: c.montoFinal, liderUsuarioId: c.liderUsuarioId, postores });
    }
    return cerradas;
  }

  return { ofertar, historial, misOfertas, cerrarVencidas };
}

module.exports = { crearSubastaService };
