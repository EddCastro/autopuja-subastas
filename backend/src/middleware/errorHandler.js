'use strict';

const { AppError } = require('../utils/errors');
const { numeroErrorSql, esErrorDeConexion, SQL } = require('../utils/sqlErrors');

function rutaNoEncontrada(req, res) {
  res.status(404).json({
    ok: false,
    error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: `No existe la ruta ${req.method} ${req.originalUrl}.` }
  });
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, _next) {
  let e = err;
  if (!(err instanceof AppError)) {
    const n = numeroErrorSql(err);
    if (err?.type === 'entity.parse.failed') e = new AppError(400, 'JSON_INVALIDO', 'El cuerpo de la petición no es un JSON válido.');
    else if (err?.type === 'entity.too.large') e = new AppError(413, 'CARGA_DEMASIADO_GRANDE', 'La petición supera el tamaño permitido.');
    else if (err?.name === 'MulterError') {
      const m = {
        LIMIT_FILE_SIZE: [413, 'FOTO_DEMASIADO_GRANDE', 'Cada fotografía debe pesar como máximo 3 MB.'],
        LIMIT_FILE_COUNT: [400, 'DEMASIADAS_FOTOS', 'Se permiten como máximo 12 fotografías.'],
        LIMIT_UNEXPECTED_FILE: [400, 'CAMPO_INESPERADO', 'Envíe las fotografías en el campo "fotos".']
      }[err.code] || [400, 'CARGA_INVALIDA', 'No se pudieron procesar los archivos enviados.'];
      e = new AppError(...m);
    } else if (n === SQL.UNIQUE_CONSTRAINT || n === SQL.UNIQUE_INDEX) e = new AppError(409, 'CONFLICTO', 'Ya existe un registro con esos datos.');
    else if (n === SQL.FOREIGN_KEY) e = new AppError(422, 'REFERENCIA_INVALIDA', 'Uno de los valores seleccionados no existe en el catálogo.');
    else if (n === SQL.DEADLOCK) e = new AppError(503, 'BD_OCUPADA', 'Hay mucha actividad en este momento. Intente de nuevo.');
    else if (esErrorDeConexion(err)) e = new AppError(503, 'BD_NO_DISPONIBLE', 'No fue posible conectar con la base de datos. Intente de nuevo en unos segundos.');
    else e = new AppError(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado en el servidor.');
  }
  if (e.status >= 500) console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ->`, err?.stack || err);
  const cuerpo = { ok: false, error: { codigo: e.codigo, mensaje: e.message } };
  if (e.detalles !== undefined) cuerpo.error.detalles = e.detalles;
  res.status(e.status).json(cuerpo);
}

module.exports = { rutaNoEncontrada, manejadorErrores };
