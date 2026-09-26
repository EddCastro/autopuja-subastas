'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { levantar, registrar, publicar, datosVehiculo, conectar, esperarEvento, noRecibe } = require('./helpers');

let s, vendedor, ana, beto, anonimo, sAna, sBeto, sAnon, v;
const auth = (t) => ({ Authorization: `Bearer ${t}` });

before(async () => {
  s = await levantar();
  [vendedor, ana, beto] = [await registrar(s.http), await registrar(s.http), await registrar(s.http)];
  v = (await publicar(s.http, vendedor.token, datosVehiculo({ precioBase: 20000 }))).body.data;
  [sAna, sBeto, sAnon] = await Promise.all([conectar(s.url, ana.token), conectar(s.url, beto.token), conectar(s.url)]);
});
after(async () => {
  for (const c of [sAna, sBeto, sAnon]) c?.close();
  await s.cerrar();
});

describe('S3.1 Tiempo real (Socket.IO)', () => {
  test('al conectarse se recibe la hora del servidor (sincroniza el reloj)', async () => {
    const c = await conectar(s.url);
    const h = await new Promise((r) => c.emit('hora', r));
    assert.ok(Math.abs(h.ahora - Date.now()) < 2000);
    c.close();
  });

  test('una puja llega al instante a TODOS (incluso anónimos) sin revelar al postor', async () => {
    const esperaAnon = esperarEvento(sAnon, 'puja:nueva', (e) => e.vehiculoId === v.id);
    const esperaBeto = esperarEvento(sBeto, 'puja:nueva', (e) => e.vehiculoId === v.id);
    const estadoAna = esperarEvento(sAna, 'puja:estado', (e) => e.vehiculoId === v.id);
    await s.http.post(`/api/vehiculos/${v.id}/pujas`).set(auth(ana.token)).send({ monto: 20000 }).expect(201);

    const e = await esperaAnon;
    assert.deepEqual(Object.keys(e).sort(), ['fecha', 'minimoSiguiente', 'montoActual', 'totalPujas', 'vehiculoId']);
    assert.equal(e.montoActual, 20000);
    assert.equal(e.minimoSiguiente, 22000);
    assert.equal((await esperaBeto).totalPujas, 1);
    assert.deepEqual(await estadoAna, { vehiculoId: v.id, estado: 'ganando', montoActual: 20000 });
  });

  test('si otro supera la oferta: Beto recibe "ganando" y Ana "superado" (solo ellos)', async () => {
    const anaSuperada = esperarEvento(sAna, 'puja:estado', (e) => e.estado === 'superado');
    const betoGanando = esperarEvento(sBeto, 'puja:estado', (e) => e.estado === 'ganando');
    const anonNoRecibe = noRecibe(sAnon, 'puja:estado');
    await s.http.post(`/api/vehiculos/${v.id}/pujas`).set(auth(beto.token)).send({ monto: 22000 }).expect(201);

    const sup = await anaSuperada;
    assert.equal(sup.montoActual, 22000);
    assert.equal(sup.minimoSiguiente, 24200);
    assert.equal((await betoGanando).estado, 'ganando');
    await anonNoRecibe;
  });

  test('una puja rechazada no emite eventos', async () => {
    const nada = noRecibe(sAnon, 'puja:nueva', (e) => e.vehiculoId === v.id);
    await s.http.post(`/api/vehiculos/${v.id}/pujas`).set(auth(ana.token)).send({ monto: 22500 }).expect(422);
    await nada;
  });

  test('cierre automático: se anuncia a todos y cada postor recibe ganada / perdida', async () => {
    const t = Date.now();
    const id = await s.repo.transaccion(async (ops) => {
      const nuevo = await ops.insertarVehiculo({ ...datosVehiculo(), fechaInicio: new Date(t - 60_000), fechaCierre: new Date(t + 700) }, vendedor.usuario.id);
      await ops.insertarPuja(nuevo, ana.usuario.id, 20000, new Date(t - 30_000));
      await ops.registrarLider(nuevo, 20000, ana.usuario.id);
      await ops.insertarPuja(nuevo, beto.usuario.id, 25000, new Date(t - 20_000));
      await ops.registrarLider(nuevo, 25000, beto.usuario.id);
      return nuevo;
    });
    s.programador.programar({ id, fechaInicio: new Date(t - 60_000), fechaCierre: new Date(t + 700) });

    const [cerrada, anaPierde, betoGana] = await Promise.all([
      esperarEvento(sAnon, 'subasta:cerrada', (e) => e.vehiculoId === id, 3000),
      esperarEvento(sAna, 'puja:estado', (e) => e.vehiculoId === id, 3000),
      esperarEvento(sBeto, 'puja:estado', (e) => e.vehiculoId === id, 3000)
    ]);
    assert.deepEqual(cerrada, { vehiculoId: id, resultado: 'vendida', montoFinal: 25000 });
    assert.equal(anaPierde.estado, 'perdida');
    assert.equal(betoGana.estado, 'ganada');
  });

  test('sin ofertas al llegar la hora de cierre → subasta desierta', async () => {
    const t = Date.now();
    const id = await s.repo.transaccion((ops) =>
      ops.insertarVehiculo({ ...datosVehiculo(), fechaInicio: new Date(t - 60_000), fechaCierre: new Date(t + 500) }, vendedor.usuario.id)
    );
    s.programador.programar({ id, fechaInicio: new Date(t - 60_000), fechaCierre: new Date(t + 500) });
    const e = await esperarEvento(sAnon, 'subasta:cerrada', (x) => x.vehiculoId === id, 3000);
    assert.equal(e.resultado, 'desierta');
    const det = (await s.http.get(`/api/vehiculos/${id}`)).body.data;
    assert.equal(det.subasta.resultado, 'desierta');
  });

  test('inicio programado y vehículo nuevo se anuncian en vivo', async () => {
    const t = Date.now();
    const nuevo = esperarEvento(sAnon, 'vehiculo:nuevo');
    const d = datosVehiculo({ fechaInicio: new Date(t + 2 * 60_000).toISOString(), fechaCierre: new Date(t + 10 * 60_000).toISOString() });
    const creado = (await publicar(s.http, vendedor.token, d)).body.data;
    assert.equal((await nuevo).vehiculoId, creado.id);
    const inicio = esperarEvento(sAnon, 'subasta:iniciada', (e) => e.vehiculoId === creado.id, 2000);
    s.programador.programar({ id: creado.id, fechaInicio: new Date(Date.now() + 300), fechaCierre: new Date(t + 10 * 60_000) });
    assert.equal((await inicio).vehiculoId, creado.id);
  });
});
