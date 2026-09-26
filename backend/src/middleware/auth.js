'use strict';

const { errores } = require('../utils/errors');

const extraerToken = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
};

/** Exige sesión iniciada (401 si no hay token válido). */
const autenticar = (authService) => (req, res, next) => {
  const token = extraerToken(req);
  if (!token) return next(errores.noAutenticado());
  try {
    req.usuario = authService.verificarToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

/** Si hay token válido identifica al usuario; si no, continúa como anónimo. */
const autenticacionOpcional = (authService) => (req, res, next) => {
  const token = extraerToken(req);
  if (token) {
    try {
      req.usuario = authService.verificarToken(token);
    } catch {
      req.usuario = null;
    }
  }
  next();
};

module.exports = { autenticar, autenticacionOpcional };
