'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/domain/reglasSubasta');

const ahora = new Date('2026-10-01T12:00:00Z');
const base = (sobre = {}) => ({
  usuarioId: 1,
  precioBase: 20000,
  montoActual: null,
  totalPujas: 0,
  liderUsuarioId: null,
  resultado: null,
  fechaInicio: new Date('2026-10-01T10:00:00Z'),
  fechaCierre: new Date('2026-10-01T14:00:00Z'),
  ...sobre
});
const codigo = (fn) => {
  try {
    fn();
    return 'OK';
  } catch (e) {
    return e.codigo;
  }
};
const pujar = (v, usuarioId, monto, t = ahora) => codigo(() => R.validarPuja({ vehiculo: v, usuarioId, monto, ahora: t }));

describe('Reglas de puja (servidor)', () => {
  test('la primera oferta puede ser igual al monto base, nunca menor', () => {
    assert.equal(pujar(base(), 2, 19999.99), 'MONTO_MENOR_BASE');
    assert.equal(pujar(base(), 2, 20000), 'OK');
    assert.equal(pujar(base(), 2, 25000), 'OK');
  });

  test('no se acepta una oferta menor o igual a la actual', () => {
    const v = base({ montoActual: 22000, totalPujas: 1, liderUsuarioId: 3 });
    assert.equal(pujar(v, 2, 22000), 'MONTO_NO_SUPERA_ACTUAL');
    assert.equal(pujar(v, 2, 21000), 'MONTO_NO_SUPERA_ACTUAL');
  });

  test('incremento mínimo del 10 % sobre la oferta actual', () => {
    const v = base({ montoActual: 22000, totalPujas: 1, liderUsuarioId: 3 });
    assert.equal(R.minimoSiguiente(v), 24200);
    assert.equal(pujar(v, 2, 24199.99), 'INCREMENTO_INSUFICIENTE');
    assert.equal(pujar(v, 2, 24200), 'OK');
  });

  test('el mínimo siguiente redondea hacia arriba al centavo', () => {
    assert.equal(R.minimoSiguiente(base({ montoActual: 12345.67, totalPujas: 1 })), 13580.24); // 13580.237 → 13580.24
    assert.equal(R.minimoSiguiente(base()), 20000);
  });

  test('respeta la hora de inicio y de cierre', () => {
    assert.equal(pujar(base(), 2, 20000, new Date('2026-10-01T09:59:59Z')), 'SUBASTA_NO_INICIADA');
    assert.equal(pujar(base(), 2, 20000, new Date('2026-10-01T14:00:00Z')), 'SUBASTA_CERRADA');
    assert.equal(pujar(base({ resultado: 'desierta' }), 2, 20000), 'SUBASTA_CERRADA');
  });

  test('el publicador no puede ofertar y el líder no puede superarse a sí mismo', () => {
    assert.equal(pujar(base(), 1, 20000), 'PROPIETARIO_NO_PUEDE_OFERTAR');
    assert.equal(pujar(base({ montoActual: 20000, totalPujas: 1, liderUsuarioId: 2 }), 2, 30000), 'YA_ERES_LIDER');
  });

  test('montos inválidos', () => {
    for (const m of [0, -5, 'abc', NaN, 100.123, null]) assert.equal(pujar(base(), 2, m), 'VALIDACION');
  });

  test('estado y resultado de la subasta', () => {
    assert.equal(R.estadoSubasta(base(), new Date('2026-10-01T09:00:00Z')), 'proxima');
    assert.equal(R.estadoSubasta(base(), ahora), 'activa');
    assert.equal(R.estadoSubasta(base(), new Date('2026-10-01T15:00:00Z')), 'cerrada');
    assert.equal(R.resultadoSubasta(base(), new Date('2026-10-01T15:00:00Z')), 'desierta');
    assert.equal(R.resultadoSubasta(base({ totalPujas: 2, montoActual: 30000 }), new Date('2026-10-01T15:00:00Z')), 'vendida');
    assert.equal(R.resultadoSubasta(base(), ahora), null);
  });

  test('indicador por usuario: ganando / superado / ganada / perdida', () => {
    const v = base({ montoActual: 22000, totalPujas: 2, liderUsuarioId: 5 });
    assert.equal(R.estadoParaUsuario({ vehiculo: v, usuarioId: 5, haOfertado: true, ahora }), 'ganando');
    assert.equal(R.estadoParaUsuario({ vehiculo: v, usuarioId: 6, haOfertado: true, ahora }), 'superado');
    assert.equal(R.estadoParaUsuario({ vehiculo: v, usuarioId: 7, haOfertado: false, ahora }), null);
    const fin = new Date('2026-10-01T15:00:00Z');
    assert.equal(R.estadoParaUsuario({ vehiculo: v, usuarioId: 5, haOfertado: true, ahora: fin }), 'ganada');
    assert.equal(R.estadoParaUsuario({ vehiculo: v, usuarioId: 6, haOfertado: true, ahora: fin }), 'perdida');
  });
});
