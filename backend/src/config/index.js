'use strict';

/**
 * Configuración centralizada (variables de entorno).
 * Las credenciales NUNCA se escriben en el código: van en .env (local)
 * o en las variables de entorno del hosting (producción).
 */
require('dotenv').config({ quiet: true });

const bool = (v, def) => (v === undefined || v === '' ? def : ['1', 'true', 'yes', 'si', 'sí'].includes(String(v).toLowerCase()));
const int = (v, def) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  produccion: env === 'production',
  port: int(process.env.PORT, 3000),

  db: {
    server: process.env.DB_SERVER || '',
    port: int(process.env.DB_PORT, 1433),
    database: process.env.DB_DATABASE || '',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    encrypt: bool(process.env.DB_ENCRYPT, true),
    trustServerCertificate: bool(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
    // Prefijo opcional para las tablas (útil si la BD es compartida con otros proyectos).
    esquema: process.env.DB_SCHEMA || 'dbo',
    prefijo: process.env.DB_TABLE_PREFIX || '',
    connectionTimeout: int(process.env.DB_CONNECTION_TIMEOUT, 30000),
    requestTimeout: int(process.env.DB_REQUEST_TIMEOUT, 30000)
  },

  jwt: {
    secreto: process.env.JWT_SECRET || 'solo-para-desarrollo-cambie-este-secreto',
    expiracion: process.env.JWT_EXPIRES_IN || '8h'
  },

  cors: {
    origenes: (process.env.CORS_ORIGINS || '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
  },

  subastas: {
    incrementoMinimoPct: 10, // cada puja debe superar la actual en al menos 10 %
    duracionMinimaMin: int(process.env.SUBASTA_DURACION_MIN_MINUTOS, 2),
    duracionMaximaDias: 60,
    toleranciaInicioMin: 5 // la fecha de inicio puede estar hasta 5 min en el pasado ("iniciar ahora")
  },

  fotos: {
    minimo: 5,
    maximo: 12,
    tamanoMaximoBytes: int(process.env.FOTO_MAX_BYTES, 3 * 1024 * 1024)
  }
};

config.db.configurada = Boolean(config.db.server && config.db.database && config.db.user && config.db.password);

if (config.produccion && config.jwt.secreto.startsWith('solo-para-desarrollo')) {
  console.warn('⚠ JWT_SECRET no está configurado: defina una clave segura en las variables de entorno.');
}

module.exports = config;
