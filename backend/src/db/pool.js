'use strict';

const sql = require('mssql');
const config = require('../config');

/**
 * Pool de conexiones único y perezoso. Si la conexión falla se descarta la
 * promesa para reintentar en la siguiente petición. Incluye reintentos para
 * errores transitorios (p. ej. Azure SQL "serverless" reanudándose: 40613).
 */
let poolPromise = null;
const TRANSITORIOS = new Set([40613, 40197, 40501, 49918, 49919, 49920, 4060, 10928, 10929]);

function crearConfiguracion() {
  const { db } = config;
  return {
    server: db.server,
    port: db.port,
    database: db.database,
    user: db.user,
    password: db.password,
    connectionTimeout: db.connectionTimeout,
    requestTimeout: db.requestTimeout,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    options: {
      encrypt: db.encrypt,
      trustServerCertificate: db.trustServerCertificate,
      enableArithAbort: true,
      appName: 'autopuja-api'
    }
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function conectarConReintentos(intentos = 4) {
  let ultimo;
  for (let i = 1; i <= intentos; i++) {
    const pool = new sql.ConnectionPool(crearConfiguracion());
    pool.on('error', (err) => console.error('[BD] Error en el pool:', err.message));
    try {
      return await pool.connect();
    } catch (err) {
      ultimo = err;
      const numero = err?.number ?? err?.originalError?.number ?? err?.originalError?.info?.number;
      const transitorio = TRANSITORIOS.has(numero) || ['ETIMEOUT', 'ESOCKET'].includes(err?.code);
      if (!transitorio || i === intentos) break;
      console.warn(`[BD] Conexión fallida (intento ${i}/${intentos}): ${err.message}. Reintentando…`);
      await esperar(3000 * i);
    }
  }
  throw ultimo;
}

function getPool() {
  if (!config.db.configurada) {
    return Promise.reject(
      Object.assign(new Error('Faltan variables de entorno de la base de datos (DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD).'), {
        code: 'ECONFIG'
      })
    );
  }
  if (!poolPromise) {
    poolPromise = conectarConReintentos().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

async function cerrarPool() {
  if (!poolPromise) return;
  try {
    (await poolPromise).close();
  } catch {
    /* ya cerrado */
  } finally {
    poolPromise = null;
  }
}

module.exports = { sql, getPool, cerrarPool };
