'use strict';

/**
 * Capa de TIEMPO REAL (Socket.IO / WebSocket).
 *
 * Eventos que recibe el navegador:
 *  - hora                → { ahora } hora del servidor para sincronizar temporizadores
 *  - puja:nueva          → { vehiculoId, montoActual, totalPujas, minimoSiguiente, fecha }  (a TODOS, sin identidad del postor)
 *  - puja:estado         → { vehiculoId, estado: 'ganando'|'superado'|'ganada'|'perdida', montoActual } (solo al usuario afectado)
 *  - subasta:iniciada    → { vehiculoId }
 *  - subasta:cerrada     → { vehiculoId, resultado: 'vendida'|'desierta', montoFinal }
 *  - vehiculo:nuevo / vehiculo:actualizado → { vehiculoId }
 *
 * Cada usuario autenticado se une a la sala privada `u:<id>`; así los
 * indicadores "Vas ganando / Tu oferta ha sido superada" llegan solo a él
 * (en todas sus pestañas) y nadie conoce la identidad de los demás postores.
 */
function configurarTiempoReal(io, { eventos, authService }) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        socket.data.usuario = authService.verificarToken(token);
      } catch {
        socket.data.usuario = null; // token inválido: se conecta como anónimo (solo lectura)
      }
    }
    next();
  });

  io.on('connection', (socket) => {
    const u = socket.data.usuario;
    if (u) socket.join(`u:${u.id}`);
    socket.emit('hora', { ahora: Date.now() });
    socket.on('hora', (ack) => typeof ack === 'function' && ack({ ahora: Date.now() }));
  });

  const aUsuario = (id, evento, datos) => id && io.to(`u:${id}`).emit(evento, datos);

  eventos.on('puja:nueva', (e) => {
    const publico = { vehiculoId: e.vehiculoId, montoActual: e.montoActual, totalPujas: e.totalPujas, minimoSiguiente: e.minimoSiguiente, fecha: e.fecha };
    io.emit('puja:nueva', publico);
    aUsuario(e.liderUsuarioId, 'puja:estado', { vehiculoId: e.vehiculoId, estado: 'ganando', montoActual: e.montoActual });
    if (e.liderAnteriorId && Number(e.liderAnteriorId) !== Number(e.liderUsuarioId)) {
      aUsuario(e.liderAnteriorId, 'puja:estado', {
        vehiculoId: e.vehiculoId,
        estado: 'superado',
        montoActual: e.montoActual,
        minimoSiguiente: e.minimoSiguiente
      });
    }
  });

  eventos.on('subasta:cerrada', (e) => {
    io.emit('subasta:cerrada', { vehiculoId: e.vehiculoId, resultado: e.resultado, montoFinal: e.montoFinal });
    for (const postor of e.postores || []) {
      aUsuario(postor, 'puja:estado', {
        vehiculoId: e.vehiculoId,
        estado: Number(postor) === Number(e.liderUsuarioId) ? 'ganada' : 'perdida',
        montoActual: e.montoFinal
      });
    }
  });

  eventos.on('subasta:iniciada', (e) => io.emit('subasta:iniciada', { vehiculoId: e.vehiculoId }));
  eventos.on('vehiculo:nuevo', (e) => io.emit('vehiculo:nuevo', { vehiculoId: e.vehiculoId }));
  eventos.on('vehiculo:actualizado', (e) => io.emit('vehiculo:actualizado', { vehiculoId: e.vehiculoId }));
}

module.exports = { configurarTiempoReal };
