'use strict';

const http = require('http');
const { Server } = require('socket.io');
const { crearApp, opcionesCors } = require('./app');
const { configurarTiempoReal } = require('./realtime/socket');
const { crearProgramador } = require('./realtime/programador');

/**
 * Crea el servidor HTTP + WebSocket (Socket.IO) + programador de cierres.
 * Lo usan server.js (producción), scripts/demo.js y las pruebas.
 */
function crearServidor({ repo, config, registrarPeticiones = true, carpetaFrontend = null, log = console }) {
  const { app, eventos, servicios } = crearApp({ repo, config, registrarPeticiones, carpetaFrontend });
  const servidor = http.createServer(app);
  const io = new Server(servidor, { cors: opcionesCors(config), pingInterval: 20_000, pingTimeout: 20_000 });
  configurarTiempoReal(io, { eventos, authService: servicios.authService });

  const programador = crearProgramador({ repo, subastaService: servicios.subastaService, eventos, log });
  servicios.programador = programador;

  async function cerrar() {
    programador.detener();
    io.close();
    await new Promise((r) => servidor.close(() => r()));
  }

  return { app, servidor, io, eventos, servicios, programador, cerrar };
}

module.exports = { crearServidor };
