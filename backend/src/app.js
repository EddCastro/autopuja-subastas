'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const configPorDefecto = require('./config');
const { crearAuthService } = require('./services/authService');
const { crearCatalogoService } = require('./services/catalogoService');
const { crearVehiculoService } = require('./services/vehiculoService');
const { crearSubastaService } = require('./services/subastaService');
const { crearRutasApi } = require('./routes/api');
const { rutaNoEncontrada, manejadorErrores } = require('./middleware/errorHandler');

/** Opciones CORS compartidas por Express y Socket.IO. */
function opcionesCors(config) {
  const o = config.cors.origenes;
  return { origin: o.includes('*') ? '*' : o, methods: ['GET', 'POST', 'PUT', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], exposedHeaders: ['X-Hora-Servidor'] };
}

/**
 * Construye la aplicación. El repositorio se inyecta (SQL Server en
 * producción, memoria en pruebas/demo). Devuelve también los servicios y el
 * bus de eventos para conectar Socket.IO y el programador de cierres.
 */
function crearApp({ repo, config = configPorDefecto, registrarPeticiones = true, carpetaFrontend = null } = {}) {
  if (!repo) throw new Error('crearApp requiere un repositorio.');

  const eventos = new EventEmitter();
  eventos.setMaxListeners(50);
  const authService = crearAuthService(repo, config);
  const catalogoService = crearCatalogoService(repo);
  const subastaService = crearSubastaService({ repo, eventos });
  const servicios = { authService, catalogoService, subastaService, vehiculoService: null };
  // El programador se asigna después (necesita el servicio de subastas)
  const puente = { programar: (v) => servicios.programador?.programar(v) };
  servicios.vehiculoService = crearVehiculoService({ repo, catalogoService, eventos, programador: puente });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('json spaces', 2);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:', 'https:']
        }
      }
    })
  );
  app.use(cors(opcionesCors(config)));
  app.use(express.json({ limit: '200kb' }));
  app.use((req, res, next) => {
    res.set('X-Hora-Servidor', String(Date.now()));
    next();
  });

  if (registrarPeticiones) {
    app.use((req, res, next) => {
      const t0 = Date.now();
      res.on('finish', () => {
        if (req.path.startsWith('/api') && !req.path.startsWith('/api/fotos')) {
          console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t0} ms)`);
        }
      });
      next();
    });
  }

  app.use('/api', crearRutasApi({ config, repo, ...servicios }));
  app.use('/api', rutaNoEncontrada);

  // Opcional: servir el frontend compilado (modo demo / respaldo).
  if (carpetaFrontend && fs.existsSync(path.join(carpetaFrontend, 'index.html'))) {
    carpetaFrontend = path.resolve(carpetaFrontend);
    app.use(express.static(carpetaFrontend, { maxAge: '1h', index: false }));
    app.get('*', (req, res) => res.sendFile(path.join(carpetaFrontend, 'index.html')));
  }

  app.use(manejadorErrores);
  return { app, eventos, servicios };
}

module.exports = { crearApp, opcionesCors };
