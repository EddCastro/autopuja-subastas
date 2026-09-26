'use strict';

const { errores } = require('../utils/errors');

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_NOMBRE = /^[\p{L}\p{M}' .-]+$/u;

/** Reglas de contraseña segura (se muestran también en el formulario). */
const REGLAS_PASSWORD = [
  { id: 'largo', texto: 'Entre 8 y 64 caracteres', ok: (p) => p.length >= 8 && p.length <= 64 },
  { id: 'mayuscula', texto: 'Al menos una letra mayúscula', ok: (p) => /\p{Lu}/u.test(p) },
  { id: 'minuscula', texto: 'Al menos una letra minúscula', ok: (p) => /\p{Ll}/u.test(p) },
  { id: 'numero', texto: 'Al menos un número', ok: (p) => /\d/.test(p) },
  { id: 'especial', texto: 'Al menos un carácter especial (!@#$%…)', ok: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
  { id: 'espacios', texto: 'Sin espacios', ok: (p) => !/\s/.test(p) }
];

const texto = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v);

function validarRegistro(body) {
  const b = body && typeof body === 'object' ? body : {};
  const d = [];
  const nombre = texto(b.nombre);
  const apellido = texto(b.apellido);
  const correo = typeof b.correo === 'string' ? b.correo.trim().toLowerCase() : b.correo;
  const telefono = typeof b.telefono === 'string' ? b.telefono.trim() : b.telefono;
  const password = b.password;

  for (const [campo, valor, etiqueta] of [
    ['nombre', nombre, 'El nombre'],
    ['apellido', apellido, 'El apellido']
  ]) {
    if (typeof valor !== 'string' || valor.length < 2) d.push({ campo, mensaje: `${etiqueta} es obligatorio (mínimo 2 letras).` });
    else if (valor.length > 80) d.push({ campo, mensaje: `${etiqueta} no puede superar 80 caracteres.` });
    else if (!REGEX_NOMBRE.test(valor)) d.push({ campo, mensaje: `${etiqueta} solo puede contener letras, espacios, apóstrofes o guiones.` });
  }

  if (typeof correo !== 'string' || !correo) d.push({ campo: 'correo', mensaje: 'El correo electrónico es obligatorio.' });
  else if (correo.length > 150 || !REGEX_CORREO.test(correo)) d.push({ campo: 'correo', mensaje: 'Ingrese un correo electrónico válido.' });

  const digitos = typeof telefono === 'string' ? telefono.replace(/\D/g, '') : '';
  if (typeof telefono !== 'string' || !telefono) d.push({ campo: 'telefono', mensaje: 'El teléfono es obligatorio.' });
  else if (!/^\+?[\d\s()-]{8,20}$/.test(telefono) || digitos.length < 8 || digitos.length > 15) {
    d.push({ campo: 'telefono', mensaje: 'Ingrese un teléfono válido (8 a 15 dígitos, ej. 5555-1234 o +502 5555 1234).' });
  }

  if (typeof password !== 'string' || !password) {
    d.push({ campo: 'password', mensaje: 'La contraseña es obligatoria.' });
  } else {
    const fallidas = REGLAS_PASSWORD.filter((r) => !r.ok(password)).map((r) => r.texto);
    if (fallidas.length) d.push({ campo: 'password', mensaje: `La contraseña no es segura: ${fallidas.join('; ')}.` });
  }

  if (d.length) throw errores.validacion(d);
  return { nombre, apellido, correo, telefono, password };
}

function validarLogin(body) {
  const b = body && typeof body === 'object' ? body : {};
  const correo = typeof b.correo === 'string' ? b.correo.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  const d = [];
  if (!correo) d.push({ campo: 'correo', mensaje: 'Ingrese su correo.' });
  if (!password) d.push({ campo: 'password', mensaje: 'Ingrese su contraseña.' });
  if (d.length) throw errores.validacion(d);
  return { correo, password };
}

module.exports = { validarRegistro, validarLogin, REGLAS_PASSWORD };
