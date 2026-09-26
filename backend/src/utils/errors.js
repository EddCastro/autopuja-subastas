'use strict';

/**
 * Error de aplicación con código HTTP y código funcional estable.
 * Respuesta estándar: { ok: false, error: { codigo, mensaje, detalles? } }
 */
class AppError extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    if (detalles !== undefined) this.detalles = detalles;
  }
}

const errores = {
  validacion: (detalles, mensaje = 'Los datos enviados no son válidos.') => new AppError(400, 'VALIDACION', mensaje, detalles),
  noAutenticado: (mensaje = 'Debe iniciar sesión para realizar esta acción.') => new AppError(401, 'NO_AUTENTICADO', mensaje),
  credenciales: () => new AppError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.'),
  prohibido: (mensaje = 'No tiene permiso para realizar esta acción.') => new AppError(403, 'PROHIBIDO', mensaje),
  noEncontrado: (mensaje = 'El recurso solicitado no existe.') => new AppError(404, 'NO_ENCONTRADO', mensaje),
  conflicto: (mensaje, codigo = 'CONFLICTO', detalles) => new AppError(409, codigo, mensaje, detalles),
  puja: (codigo, mensaje, detalles) => new AppError(422, codigo, mensaje, detalles),
  referencia: (mensaje, detalles) => new AppError(422, 'REFERENCIA_INVALIDA', mensaje, detalles),
  bdNoDisponible: () => new AppError(503, 'BD_NO_DISPONIBLE', 'No fue posible conectar con la base de datos. Intente de nuevo en unos segundos.')
};

module.exports = { AppError, errores };
