'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { errores } = require('../utils/errors');
const { validarRegistro, validarLogin } = require('../validators/authValidator');

const COSTO_BCRYPT = 10;
// Hash ficticio para igualar el tiempo de respuesta cuando el correo no existe.
const HASH_FICTICIO = bcrypt.hashSync('contraseña-ficticia-para-tiempo-constante', COSTO_BCRYPT);

const publico = (u) => ({ id: u.id, nombre: u.nombre, apellido: u.apellido, correo: u.correo, telefono: u.telefono });

function crearAuthService(repo, config) {
  function firmarToken(u) {
    return jwt.sign({ nombre: u.nombre, apellido: u.apellido }, config.jwt.secreto, {
      subject: String(u.id),
      expiresIn: config.jwt.expiracion,
      issuer: 'autopuja'
    });
  }

  /** Devuelve { id, nombre } o lanza 401. */
  function verificarToken(token) {
    try {
      const p = jwt.verify(token, config.jwt.secreto, { issuer: 'autopuja' });
      return { id: Number(p.sub), nombre: p.nombre, apellido: p.apellido };
    } catch (err) {
      throw errores.noAutenticado(err.name === 'TokenExpiredError' ? 'Su sesión expiró. Inicie sesión nuevamente.' : 'Sesión inválida. Inicie sesión nuevamente.');
    }
  }

  async function registrar(body) {
    const datos = validarRegistro(body);
    if (await repo.buscarUsuarioPorCorreo(datos.correo)) {
      throw errores.conflicto('Ya existe una cuenta registrada con ese correo.', 'CORREO_REGISTRADO', [
        { campo: 'correo', mensaje: 'Este correo ya está registrado. Inicie sesión.' }
      ]);
    }
    const passwordHash = await bcrypt.hash(datos.password, COSTO_BCRYPT);
    let usuario;
    try {
      usuario = await repo.crearUsuario({ ...datos, passwordHash });
    } catch (err) {
      if (err.codigo === 'CORREO_DUPLICADO') {
        throw errores.conflicto('Ya existe una cuenta registrada con ese correo.', 'CORREO_REGISTRADO', [{ campo: 'correo', mensaje: 'Este correo ya está registrado.' }]);
      }
      throw err;
    }
    return { token: firmarToken(usuario), usuario: publico(usuario) };
  }

  async function login(body) {
    const { correo, password } = validarLogin(body);
    const u = await repo.buscarUsuarioPorCorreo(correo);
    const ok = await bcrypt.compare(password, u?.passwordHash || HASH_FICTICIO);
    if (!u || !ok) throw errores.credenciales();
    return { token: firmarToken(u), usuario: publico(u) };
  }

  async function perfil(id) {
    const u = await repo.obtenerUsuario(id);
    if (!u) throw errores.noAutenticado('La cuenta ya no existe.');
    return publico(u);
  }

  /** Crea o actualiza un usuario de prueba (usado por la semilla). */
  async function asegurarUsuario(datos) {
    const passwordHash = await bcrypt.hash(datos.password, COSTO_BCRYPT);
    const existente = await repo.buscarUsuarioPorCorreo(datos.correo);
    if (existente) {
      await repo.actualizarPasswordUsuario(existente.id, passwordHash, datos);
      return { ...existente, ...datos };
    }
    return repo.crearUsuario({ ...datos, passwordHash });
  }

  return { registrar, login, perfil, firmarToken, verificarToken, asegurarUsuario };
}

module.exports = { crearAuthService };
