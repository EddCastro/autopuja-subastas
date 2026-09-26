'use strict';

const { errores } = require('../utils/errors');

const ESTADOS = ['disponibles', 'activa', 'proxima', 'cerrada', 'todas'];
const ORDENES = ['cierre', 'recientes', 'precio_asc', 'precio_desc', 'anio_desc', 'anio_asc', 'populares'];
const DANIOS = ['VERDE', 'AMARILLO', 'ROJO'];

/**
 * Convierte los parámetros de la URL en un objeto de filtros normalizado.
 * Todos los filtros son combinables ("multitarea"). Las listas aceptan
 * varios valores separados por coma: ?marca=10,18&danio=verde,amarillo
 */
function validarFiltros(q = {}, { estadoPorDefecto = 'disponibles', ordenPorDefecto = 'cierre' } = {}) {
  const d = [];
  const str = (k, max) => {
    const v = typeof q[k] === 'string' ? q[k].trim() : '';
    if (v.length > max) d.push({ campo: k, mensaje: `Máximo ${max} caracteres.` });
    return v || null;
  };
  const ent = (k, min, max) => {
    if (q[k] === undefined || q[k] === '') return null;
    const n = Number(q[k]);
    if (!Number.isInteger(n) || n < min || n > max) {
      d.push({ campo: k, mensaje: `Debe ser un entero entre ${min} y ${max}.` });
      return null;
    }
    return n;
  };
  const dec = (k) => {
    if (q[k] === undefined || q[k] === '') return null;
    const n = Number(q[k]);
    if (!Number.isFinite(n) || n < 0) {
      d.push({ campo: k, mensaje: 'Debe ser un número positivo.' });
      return null;
    }
    return n;
  };
  const listaEnteros = (k) => {
    if (q[k] === undefined || q[k] === '') return [];
    const partes = String(q[k]).split(',').map((x) => x.trim()).filter(Boolean);
    const nums = partes.map(Number);
    if (partes.length > 50 || nums.some((n) => !Number.isInteger(n) || n < 0 || n > 1_000_000)) {
      d.push({ campo: k, mensaje: 'Lista de valores inválida.' });
      return [];
    }
    return [...new Set(nums)];
  };

  const f = {
    q: str('q', 100),
    anioMin: ent('anioMin', 1900, 2100),
    anioMax: ent('anioMax', 1900, 2100),
    marcas: listaEnteros('marca'),
    modelo: str('modelo', 80),
    tipos: listaEnteros('tipo'),
    combustibles: listaEnteros('combustible'),
    transmisiones: listaEnteros('transmision'),
    trenes: listaEnteros('tren'),
    cilindros: listaEnteros('cilindros'),
    danios: [],
    precioMin: dec('precioMin'),
    precioMax: dec('precioMax'),
    estado: (q.estado || estadoPorDefecto).toString().toLowerCase(),
    orden: (q.orden || ordenPorDefecto).toString().toLowerCase(),
    pagina: ent('pagina', 1, 10_000) ?? 1,
    tamano: ent('tamano', 1, 48) ?? 12
  };

  if (q.danio) {
    const codigos = String(q.danio).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
    if (codigos.some((c) => !DANIOS.includes(c))) d.push({ campo: 'danio', mensaje: `Valores permitidos: ${DANIOS.join(', ').toLowerCase()}.` });
    else f.danios = [...new Set(codigos)];
  }
  if (!ESTADOS.includes(f.estado)) d.push({ campo: 'estado', mensaje: `Valores permitidos: ${ESTADOS.join(', ')}.` });
  if (!ORDENES.includes(f.orden)) d.push({ campo: 'orden', mensaje: `Valores permitidos: ${ORDENES.join(', ')}.` });
  if (f.anioMin != null && f.anioMax != null && f.anioMin > f.anioMax) d.push({ campo: 'anioMin', mensaje: 'El año mínimo no puede ser mayor al máximo.' });
  if (f.precioMin != null && f.precioMax != null && f.precioMin > f.precioMax) d.push({ campo: 'precioMin', mensaje: 'El precio mínimo no puede ser mayor al máximo.' });

  if (d.length) throw errores.validacion(d, 'Filtros inválidos.');
  if (f.estado === 'todas') f.estado = null;
  return f;
}

module.exports = { validarFiltros, ESTADOS, ORDENES };
