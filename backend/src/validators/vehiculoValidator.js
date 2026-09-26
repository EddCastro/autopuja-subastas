'use strict';

const { errores } = require('../utils/errors');
const { esMontoValido } = require('../utils/dinero');
const base = require('../db/catalogosBase');
const config = require('../config');

const MIN = 60 * 1000;
const DIA = 24 * 60 * MIN;

const texto = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v);
const entero = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const opcional = (v) => v === undefined || v === null || v === '';

/**
 * Valida la ficha técnica y los parámetros de la subasta.
 * @param {object} raw           Datos enviados por el cliente.
 * @param {object} ctx.catalogos Catálogos vigentes.
 * @param {Date}   ctx.ahora     Hora del servidor.
 * @param {object} [ctx.original] Vehículo actual (solo en edición).
 */
function validarVehiculo(raw, { catalogos, ahora = new Date(), original = null }) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const d = [];
  const add = (campo, mensaje) => d.push({ campo, mensaje });
  const out = {};

  // --- Año ---
  const anio = entero(b.anio);
  const anioMax = ahora.getFullYear() + 1;
  if (!Number.isInteger(anio) || anio < 1950 || anio > anioMax) add('anio', `El año es obligatorio (1950 a ${anioMax}).`);
  out.anio = anio;

  // --- Catálogos ---
  const refs = [
    ['tipoArticuloId', 'tiposArticulo', 'Seleccione el tipo de artículo.'],
    ['marcaId', 'marcas', 'Seleccione la marca.'],
    ['transmisionId', 'transmisiones', 'Seleccione la transmisión.'],
    ['combustibleId', 'combustibles', 'Seleccione el tipo de combustible.'],
    ['trenManejoId', 'trenesManejo', 'Seleccione el tren de manejo (AWD, FWD, RWD o 4WD).'],
    ['nivelDanioId', 'nivelesDanio', 'Seleccione el estado de daño (Verde, Amarillo o Rojo).']
  ];
  for (const [campo, lista, mensaje] of refs) {
    const id = entero(b[campo]);
    if (!Number.isInteger(id) || !catalogos[lista].some((x) => x.id === id)) add(campo, mensaje);
    out[campo] = id;
  }

  // --- Textos ---
  const modelo = texto(b.modelo);
  if (typeof modelo !== 'string' || modelo.length < 1) add('modelo', 'El modelo es obligatorio.');
  else if (modelo.length > 80) add('modelo', 'El modelo no puede superar 80 caracteres.');
  out.modelo = modelo;

  const motor = texto(b.motor);
  if (typeof motor !== 'string' || motor.length < 2) add('motor', 'El motor es obligatorio (ej. 2.0L I4 Turbo).');
  else if (motor.length > 80) add('motor', 'El motor no puede superar 80 caracteres.');
  out.motor = motor;

  // --- Cilindros (coherentes con el combustible) ---
  const cilindros = entero(b.cilindros);
  const electrico = catalogos.combustibles.find((c) => c.id === out.combustibleId)?.nombre === 'Eléctrico';
  if (!Number.isInteger(cilindros) || !base.cilindros.includes(cilindros)) {
    add('cilindros', `Seleccione el número de cilindros (${base.cilindros.join(', ')}).`);
  } else if (electrico && cilindros !== 0) {
    add('cilindros', 'Un vehículo eléctrico debe registrar 0 cilindros.');
  } else if (!electrico && cilindros === 0 && Number.isInteger(out.combustibleId)) {
    add('cilindros', 'Solo los vehículos eléctricos pueden tener 0 cilindros.');
  }
  out.cilindros = cilindros;

  // --- Opcionales ---
  out.color = opcional(b.color) ? null : texto(b.color);
  if (out.color && out.color.length > 40) add('color', 'El color no puede superar 40 caracteres.');
  out.kilometraje = opcional(b.kilometraje) ? null : entero(b.kilometraje);
  if (out.kilometraje !== null && (!Number.isInteger(out.kilometraje) || out.kilometraje < 0 || out.kilometraje > 2_000_000)) {
    add('kilometraje', 'El kilometraje debe ser un entero entre 0 y 2,000,000.');
  }
  out.descripcion = opcional(b.descripcion) ? null : String(b.descripcion).trim();
  if (out.descripcion && out.descripcion.length > 1000) add('descripcion', 'La descripción no puede superar 1000 caracteres.');

  // --- Parámetros de la subasta ---
  const precioBase = typeof b.precioBase === 'string' ? Number(b.precioBase) : b.precioBase;
  if (!esMontoValido(precioBase) || precioBase < 100) add('precioBase', 'El precio base es obligatorio (mínimo Q 100.00, máximo 2 decimales).');
  out.precioBase = precioBase;

  const inicio = new Date(b.fechaInicio);
  const cierre = new Date(b.fechaCierre);
  const { toleranciaInicioMin, duracionMinimaMin, duracionMaximaDias } = config.subastas;
  const inicioSinCambio = original && Math.abs(inicio.getTime() - new Date(original.fechaInicio).getTime()) < 1000;

  if (!b.fechaInicio || Number.isNaN(inicio.getTime())) add('fechaInicio', 'La fecha y hora de inicio es obligatoria.');
  else if (!inicioSinCambio && inicio.getTime() < ahora.getTime() - toleranciaInicioMin * MIN) {
    add('fechaInicio', 'La fecha de inicio no puede estar en el pasado.');
  }
  if (!b.fechaCierre || Number.isNaN(cierre.getTime())) add('fechaCierre', 'La fecha y hora de cierre es obligatoria.');
  else if (!Number.isNaN(inicio.getTime())) {
    const duracion = cierre.getTime() - inicio.getTime();
    if (duracion < duracionMinimaMin * MIN) add('fechaCierre', `El cierre debe ser al menos ${duracionMinimaMin} minutos posterior al inicio.`);
    else if (duracion > duracionMaximaDias * DIA) add('fechaCierre', `La subasta no puede durar más de ${duracionMaximaDias} días.`);
    else if (cierre.getTime() <= ahora.getTime() + MIN) add('fechaCierre', 'La fecha de cierre debe ser futura.');
  }
  out.fechaInicio = inicio;
  out.fechaCierre = cierre;

  if (d.length) throw errores.validacion(d, 'Revise los datos del vehículo.');
  return out;
}

/** Detecta el tipo real del archivo por su firma (no confía en la extensión). */
function detectarMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

/** Valida los archivos subidos y devuelve [{ mime, buffer }]. */
function validarArchivos(archivos = []) {
  const d = [];
  const fotos = [];
  archivos.forEach((a, i) => {
    const mime = detectarMime(a.buffer);
    if (!mime) d.push({ campo: `fotos[${i}]`, mensaje: `"${a.originalname}" no es una imagen JPG, PNG o WEBP válida.` });
    else fotos.push({ mime, buffer: a.buffer, nombre: a.originalname });
  });
  if (d.length) throw errores.validacion(d, 'Una o más fotografías no son válidas.');
  return fotos;
}

function validarCantidadFotos(total) {
  const { minimo, maximo } = config.fotos;
  if (total < minimo) throw errores.validacion([{ campo: 'fotos', mensaje: `Se requieren al menos ${minimo} fotografías (tiene ${total}).` }], 'Galería incompleta.');
  if (total > maximo) throw errores.validacion([{ campo: 'fotos', mensaje: `Se permiten como máximo ${maximo} fotografías (tiene ${total}).` }], 'Demasiadas fotografías.');
}

module.exports = { validarVehiculo, validarArchivos, validarCantidadFotos, detectarMime };
