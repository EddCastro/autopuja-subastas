'use strict';

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { errores } = require('../utils/errors');
const { autenticar, autenticacionOpcional } = require('../middleware/auth');
const { REGLAS_PASSWORD } = require('../validators/authValidator');
const pkg = require('../../package.json');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Lee el campo "datos" (JSON) de un formulario multipart. */
function leerDatos(req) {
  const raw = req.body?.datos;
  if (typeof raw !== 'string') throw errores.validacion([{ campo: 'datos', mensaje: 'Envíe la ficha técnica en el campo "datos" (JSON).' }]);
  try {
    return JSON.parse(raw);
  } catch {
    throw errores.validacion([{ campo: 'datos', mensaje: 'El campo "datos" no es un JSON válido.' }]);
  }
}

function crearRutasApi({ config, repo, authService, catalogoService, vehiculoService, subastaService }) {
  const r = express.Router();
  const requerido = autenticar(authService);
  const opcional = autenticacionOpcional(authService);
  const idUsuario = (req) => req.usuario?.id ?? null;

  const subida = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.fotos.tamanoMaximoBytes, files: config.fotos.maximo, fields: 5, fieldSize: 200 * 1024 }
  }).array('fotos', config.fotos.maximo);

  const limite = (max, ventanaMin, mensaje, porUsuario = false) =>
    rateLimit({
      windowMs: ventanaMin * 60_000,
      limit: max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      ...(porUsuario ? { keyGenerator: (req) => `u:${req.usuario?.id}`, validate: { keyGeneratorIpFallback: false } } : {}),
      handler: (req, res) => res.status(429).json({ ok: false, error: { codigo: 'DEMASIADAS_PETICIONES', mensaje } })
    });
  const limiteAuth = limite(30, 15, 'Demasiados intentos. Espere unos minutos e intente de nuevo.');
  const limitePujas = limite(40, 1, 'Está enviando ofertas demasiado rápido. Espere un momento.', true);

  // ---------------- Sistema ----------------
  r.get('/', (req, res) =>
    res.json({
      ok: true,
      nombre: 'AutoPuja API — Subastas de vehículos en tiempo real',
      version: pkg.version,
      tiempoReal: 'Socket.IO en el mismo host (ruta /socket.io)',
      endpoints: [
        'POST /api/auth/registro', 'POST /api/auth/login', 'GET /api/auth/yo',
        'GET /api/catalogos', 'GET /api/catalogos/modelos?marcaId=',
        'GET /api/vehiculos?q=&anioMin=&anioMax=&marca=&modelo=&tipo=&combustible=&transmision=&tren=&cilindros=&danio=&precioMin=&precioMax=&estado=&orden=&pagina=',
        'GET /api/vehiculos/mios', 'GET /api/vehiculos/:id', 'POST /api/vehiculos (multipart)', 'PUT /api/vehiculos/:id (multipart)',
        'GET /api/vehiculos/:id/pujas', 'POST /api/vehiculos/:id/pujas', 'GET /api/pujas/mias', 'GET /api/fotos/:id', 'GET /api/health'
      ]
    })
  );

  r.get(
    '/health',
    ah(async (req, res) => {
      const salida = { ok: true, api: 'ok', ahora: new Date().toISOString() };
      if (req.query.db !== undefined) {
        try {
          await repo.ping();
          salida.baseDatos = 'ok';
        } catch {
          salida.baseDatos = 'error';
        }
      }
      res.json(salida);
    })
  );

  r.get('/hora', (req, res) => res.json({ ok: true, ahora: Date.now() }));

  // ---------------- Autenticación ----------------
  r.get('/auth/reglas-password', (req, res) => res.json({ ok: true, data: REGLAS_PASSWORD.map(({ id, texto }) => ({ id, texto })) }));

  r.post(
    '/auth/registro',
    limiteAuth,
    ah(async (req, res) => res.status(201).json({ ok: true, ...(await authService.registrar(req.body)) }))
  );

  r.post(
    '/auth/login',
    limiteAuth,
    ah(async (req, res) => res.json({ ok: true, ...(await authService.login(req.body)) }))
  );

  r.get(
    '/auth/yo',
    requerido,
    ah(async (req, res) => res.json({ ok: true, usuario: await authService.perfil(req.usuario.id) }))
  );

  // ---------------- Catálogos ----------------
  r.get(
    '/catalogos',
    ah(async (req, res) => res.json({ ok: true, data: await catalogoService.catalogos() }))
  );
  r.get(
    '/catalogos/modelos',
    ah(async (req, res) => res.json({ ok: true, data: await catalogoService.modelos(req.query.marcaId) }))
  );

  // ---------------- Vehículos ----------------
  r.get(
    '/vehiculos',
    opcional,
    ah(async (req, res) => res.json({ ok: true, ...(await vehiculoService.listar(req.query, idUsuario(req))) }))
  );

  r.get(
    '/vehiculos/mios',
    requerido,
    ah(async (req, res) => res.json({ ok: true, ...(await vehiculoService.misVehiculos(req.usuario.id, req.query)) }))
  );

  r.get(
    '/vehiculos/:id',
    opcional,
    ah(async (req, res) => res.json({ ok: true, data: await vehiculoService.detalle(req.params.id, idUsuario(req)) }))
  );

  r.post(
    '/vehiculos',
    requerido,
    subida,
    ah(async (req, res) => {
      const data = await vehiculoService.publicar(req.usuario.id, leerDatos(req), req.files || []);
      res.status(201).json({ ok: true, mensaje: 'Vehículo publicado correctamente.', data });
    })
  );

  r.put(
    '/vehiculos/:id',
    requerido,
    subida,
    ah(async (req, res) => {
      const data = await vehiculoService.actualizar(req.usuario.id, Number(req.params.id), leerDatos(req), req.files || []);
      res.json({ ok: true, mensaje: 'Publicación actualizada correctamente.', data });
    })
  );

  // ---------------- Pujas ----------------
  r.get(
    '/vehiculos/:id/pujas',
    opcional,
    ah(async (req, res) => res.json({ ok: true, data: await subastaService.historial(req.params.id, idUsuario(req)) }))
  );

  r.post(
    '/vehiculos/:id/pujas',
    requerido,
    limitePujas,
    ah(async (req, res) => res.status(201).json({ ok: true, ...(await subastaService.ofertar(req.usuario.id, req.params.id, req.body)) }))
  );

  r.get(
    '/pujas/mias',
    requerido,
    ah(async (req, res) => res.json({ ok: true, data: await subastaService.misOfertas(req.usuario.id) }))
  );

  // ---------------- Fotos ----------------
  r.get(
    '/fotos/:id',
    ah(async (req, res) => {
      const f = await vehiculoService.foto(req.params.id);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.type(f.mime).send(Buffer.from(f.datos));
    })
  );

  return r;
}

module.exports = { crearRutasApi };
