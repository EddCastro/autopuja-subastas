'use strict';
/**
 * MODO DEMO: API + tiempo real + tablero con datos en MEMORIA (sin SQL Server).
 *   npm run demo            → http://localhost:3000/api
 * Si existe ../frontend/dist (npm run build en frontend), también sirve la SPA.
 */
const path = require('path');
const config = require('../src/config');
const { crearServidor } = require('../src/servidor');
const { crearRepositorioMemoria } = require('../src/repositories/memoryRepository');
const { sembrar } = require('../src/db/sembrar');

const repo = crearRepositorioMemoria();
const carpetaFrontend = path.resolve(process.env.FRONTEND_DIST || path.join(__dirname, '..', '..', 'frontend', 'dist'));
const s = crearServidor({ repo, config, carpetaFrontend, registrarPeticiones: process.env.DEMO_LOG !== '0' });

(async () => {
  await sembrar({ repo, authService: s.servicios.authService, descargar: process.env.DEMO_DESCARGAR === '1', log: () => {} });
  s.servidor.listen(config.port, () => {
    console.log(`MODO DEMO (datos en memoria) en http://localhost:${config.port}`);
    s.programador.iniciar();
  });
})();
