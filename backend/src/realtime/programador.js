'use strict';

/**
 * Programador de subastas: temporizadores en memoria para el INICIO y el
 * CIERRE exacto de cada subasta (sin consultar la BD cada segundo).
 *  - Al arrancar: cierra las vencidas y programa las abiertas.
 *  - Al publicar/editar: reprograma ese vehículo.
 * Aunque el servidor se reinicie, el estado mostrado siempre se calcula con
 * las fechas, así que nunca se acepta una puja fuera de tiempo.
 */
const MAX_TIMEOUT = 2_147_000_000; // ~24.8 días (límite de setTimeout)

function crearProgramador({ repo, subastaService, eventos, log = console }) {
  const timers = new Map(); // id -> { inicio, cierre }

  function cancelar(id) {
    const t = timers.get(id);
    if (t) {
      clearTimeout(t.inicio);
      clearTimeout(t.cierre);
      timers.delete(id);
    }
  }

  function enMomento(fecha, fn) {
    const espera = new Date(fecha).getTime() - Date.now();
    if (espera > MAX_TIMEOUT) return setTimeout(() => enMomento(fecha, fn), MAX_TIMEOUT);
    return setTimeout(fn, Math.max(0, espera));
  }

  function programar({ id, fechaInicio, fechaCierre }) {
    cancelar(id);
    const t = {};
    if (new Date(fechaInicio).getTime() > Date.now()) {
      t.inicio = enMomento(fechaInicio, () => eventos.emit('subasta:iniciada', { vehiculoId: id }));
    }
    t.cierre = enMomento(fechaCierre, async () => {
      timers.delete(id);
      try {
        await subastaService.cerrarVencidas(id);
      } catch (err) {
        log.error?.(`[programador] No se pudo cerrar la subasta ${id}: ${err.message}. Reintento en 30 s.`);
        setTimeout(() => subastaService.cerrarVencidas(id).catch(() => {}), 30_000);
      }
    });
    timers.set(id, t);
  }

  async function iniciar() {
    try {
      const cerradas = await subastaService.cerrarVencidas();
      const abiertas = await repo.subastasAbiertas();
      abiertas.forEach(programar);
      log.log?.(`[programador] ${abiertas.length} subastas programadas; ${cerradas.length} cerradas al iniciar.`);
    } catch (err) {
      log.warn?.(`[programador] BD no disponible (${err.message}). Reintento en 30 s.`);
      setTimeout(iniciar, 30_000).unref?.();
    }
  }

  function detener() {
    for (const id of [...timers.keys()]) cancelar(id);
  }

  return { programar, cancelar, iniciar, detener, _timers: timers };
}

module.exports = { crearProgramador };
