'use strict';

const request = require('supertest');
const { io: cliente } = require('socket.io-client');
const config = require('../src/config');
const { crearServidor } = require('../src/servidor');
const { crearRepositorioMemoria } = require('../src/repositories/memoryRepository');

const silencio = { log() {}, warn() {}, error() {} };

/**
 * Servidor completo (HTTP + Socket.IO). Por defecto usa el repositorio en
 * memoria; con TEST_REPO=sqlserver usa SQL Server real (CI con contenedor).
 */
async function crearRepo() {
  if (process.env.TEST_REPO !== 'sqlserver') return crearRepositorioMemoria();
  const { getPool } = require('../src/db/pool');
  const { migrar } = require('../src/db/migrar');
  const { T } = require('../src/db/esquema');
  const { crearRepositorioSqlServer } = require('../src/repositories/sqlServerRepository');
  const pool = await getPool();
  await migrar(pool, { log: () => {} });
  await pool.request().batch(`DELETE FROM ${T.Pujas}; DELETE FROM ${T.Fotos}; DELETE FROM ${T.Vehiculos}; DELETE FROM ${T.Usuarios};`);
  return crearRepositorioSqlServer();
}

async function levantar() {
  const repo = await crearRepo();
  const s = crearServidor({ repo, config, registrarPeticiones: false, log: silencio });
  await new Promise((r) => s.servidor.listen(0, r));
  const url = `http://127.0.0.1:${s.servidor.address().port}`;
  const cerrar = async () => {
    await s.cerrar();
    if (process.env.TEST_REPO === 'sqlserver') await require('../src/db/pool').cerrarPool();
  };
  return { ...s, cerrar, repo, url, http: request(s.app) };
}

let n = 0;
async function registrar(http, extra = {}) {
  n++;
  const res = await http.post('/api/auth/registro').send({
    nombre: 'Usuario',
    apellido: `Prueba${String.fromCharCode(65 + (n % 26))}`,
    correo: `u${n}_${Date.now()}@prueba.gt`,
    telefono: '5555-1234',
    password: 'Segura#2026',
    ...extra
  });
  if (res.status !== 201) throw new Error(`registro falló: ${JSON.stringify(res.body)}`);
  return { token: res.body.token, usuario: res.body.usuario };
}

/** JPEG mínimo válido por firma (el servidor no decodifica la imagen). */
const jpeg = (i = 0) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]), Buffer.alloc(64, i)]);
const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

const MIN = 60_000;
function datosVehiculo(sobre = {}) {
  const ahora = Date.now();
  return {
    anio: 2021,
    tipoArticuloId: 5, // SUV
    marcaId: 34, // Toyota
    modelo: 'RAV4 XLE',
    motor: '2.5L I4',
    transmisionId: 1, // Automática
    combustibleId: 1, // Gasolina
    trenManejoId: 1, // AWD
    cilindros: 4,
    nivelDanioId: 1, // Verde
    color: 'Rojo',
    kilometraje: 25000,
    descripcion: 'Vehículo de prueba',
    precioBase: 20000,
    fechaInicio: new Date(ahora - MIN).toISOString(),
    fechaCierre: new Date(ahora + 60 * MIN).toISOString(),
    ...sobre
  };
}

/** Publica un vehículo vía API (multipart) con N fotos. */
function publicar(http, token, datos = datosVehiculo(), nFotos = 5) {
  let req = http.post('/api/vehiculos').set('Authorization', `Bearer ${token}`).field('datos', JSON.stringify(datos));
  for (let i = 0; i < nFotos; i++) req = req.attach('fotos', jpeg(i), { filename: `foto${i}.jpg`, contentType: 'image/jpeg' });
  return req;
}

function conectar(url, token) {
  return new Promise((resolve, reject) => {
    const s = cliente(url, { auth: token ? { token } : {}, transports: ['websocket'], forceNew: true });
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

/** Espera un evento que cumpla el predicado (o falla por tiempo). */
function esperarEvento(socket, evento, pred = () => true, ms = 2000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.off(evento, h);
      reject(new Error(`Tiempo agotado esperando "${evento}"`));
    }, ms);
    function h(data) {
      if (!pred(data)) return;
      clearTimeout(t);
      socket.off(evento, h);
      resolve(data);
    }
    socket.on(evento, h);
  });
}

/** Comprueba que un evento NO llegue en el tiempo indicado. */
function noRecibe(socket, evento, pred = () => true, ms = 300) {
  return new Promise((resolve, reject) => {
    const h = (d) => pred(d) && reject(new Error(`No debía recibir "${evento}": ${JSON.stringify(d)}`));
    socket.on(evento, h);
    setTimeout(() => (socket.off(evento, h), resolve()), ms);
  });
}

module.exports = { levantar, registrar, publicar, datosVehiculo, jpeg, png, conectar, esperarEvento, noRecibe, MIN };
