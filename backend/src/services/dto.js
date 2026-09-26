'use strict';

/**
 * Transforma el vehículo interno en la respuesta pública de la API.
 * PRIVACIDAD: nunca se exponen los IDs del publicador ni del postor líder;
 * cada usuario solo recibe banderas sobre sí mismo (esPropietario, miEstado).
 */
const { estadoSubasta, resultadoSubasta, minimoSiguiente, INCREMENTO_PCT, estadoParaUsuario } = require('../domain/reglasSubasta');

const urlFoto = (id) => (id ? `/api/fotos/${id}` : null);
const iso = (f) => (f ? new Date(f).toISOString() : null);

function subastaDto(v, ahora) {
  const estado = estadoSubasta(v, ahora);
  return {
    precioBase: v.precioBase,
    montoActual: v.totalPujas > 0 ? v.montoActual : null,
    totalPujas: v.totalPujas,
    minimoSiguiente: estado === 'cerrada' ? null : minimoSiguiente(v),
    incrementoMinimoPct: INCREMENTO_PCT,
    fechaInicio: iso(v.fechaInicio),
    fechaCierre: iso(v.fechaCierre),
    estado,
    resultado: resultadoSubasta(v, ahora)
  };
}

function vehiculoDto(v, { ahora = new Date(), usuarioId = null, haOfertado = false, detalle = false } = {}) {
  const dto = {
    id: v.id,
    titulo: `${v.anio} ${v.marca.nombre} ${v.modelo}`,
    anio: v.anio,
    tipoArticulo: v.tipoArticulo,
    marca: v.marca,
    modelo: v.modelo,
    motor: v.motor,
    transmision: v.transmision,
    combustible: v.combustible,
    trenManejo: v.trenManejo,
    cilindros: v.cilindros,
    danio: v.danio,
    color: v.color,
    kilometraje: v.kilometraje,
    fotoPortada: urlFoto(v.fotoPortadaId),
    totalFotos: v.totalFotos ?? (v.fotos ? v.fotos.length : 0),
    subasta: subastaDto(v, ahora),
    fechaPublicacion: iso(v.fechaCreacion)
  };
  if (usuarioId) {
    dto.esPropietario = Number(v.usuarioId) === Number(usuarioId);
    dto.miEstado = dto.esPropietario ? null : estadoParaUsuario({ vehiculo: v, usuarioId, haOfertado, ahora });
  }
  if (detalle) {
    dto.descripcion = v.descripcion;
    dto.fotos = (v.fotos || []).map((id) => ({ id, url: urlFoto(id) }));
    dto.fechaActualizacion = iso(v.fechaActualizacion);
  }
  return dto;
}

module.exports = { vehiculoDto, subastaDto, urlFoto };
