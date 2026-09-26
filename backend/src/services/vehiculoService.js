'use strict';

const { errores } = require('../utils/errors');
const { validarVehiculo, validarArchivos, validarCantidadFotos } = require('../validators/vehiculoValidator');
const { validarFiltros } = require('../validators/filtrosValidator');
const { estadoSubasta } = require('../domain/reglasSubasta');
const { vehiculoDto } = require('./dto');

/**
 * Orden final de la galería al editar. `fotosOrden` (opcional) mezcla fotos
 * existentes y nuevas: ["e:12", "n:0", "e:9", …]. Sin él: existentes y luego nuevas.
 */
function ordenFinal(fotosOrden, conservar, totalNuevas) {
  if (!Array.isArray(fotosOrden)) return [...conservar.map((x) => ['e', x]), ...Array.from({ length: totalNuevas }, (_, i) => ['n', i])];
  const orden = fotosOrden.map((t) => {
    const m = /^(e|n):(\d+)$/.exec(String(t));
    return m ? [m[1], Number(m[2])] : null;
  });
  const e = orden.filter((x) => x?.[0] === 'e').map((x) => x[1]);
  const n = orden.filter((x) => x?.[0] === 'n').map((x) => x[1]);
  const valido =
    orden.every(Boolean) &&
    e.length === conservar.length && conservar.every((id) => e.includes(id)) &&
    n.length === totalNuevas && n.every((i) => i < totalNuevas) && new Set(n).size === n.length;
  if (!valido) throw errores.validacion([{ campo: 'fotosOrden', mensaje: 'El orden de las fotografías no es válido.' }]);
  return orden;
}

/** Publicación, edición, inventario con filtros y detalle de vehículos. */
function crearVehiculoService({ repo, catalogoService, eventos, programador = null }) {
  async function publicar(usuarioId, datosRaw, archivos, { esDemo = false } = {}) {
    const catalogos = await catalogoService.catalogos();
    const datos = validarVehiculo(datosRaw, { catalogos, ahora: new Date() });
    const fotos = validarArchivos(archivos);
    validarCantidadFotos(fotos.length);

    const id = await repo.transaccion(async (ops) => {
      const nuevoId = await ops.insertarVehiculo(datos, usuarioId, esDemo);
      for (let i = 0; i < fotos.length; i++) await ops.insertarFoto(nuevoId, i + 1, fotos[i]);
      return nuevoId;
    });

    programador?.programar({ id, fechaInicio: datos.fechaInicio, fechaCierre: datos.fechaCierre });
    catalogoService.invalidar?.();
    eventos.emit('vehiculo:nuevo', { vehiculoId: id });
    return detalle(id, usuarioId);
  }

  async function actualizar(usuarioId, id, datosRaw, archivos) {
    const catalogos = await catalogoService.catalogos();
    const nuevas = validarArchivos(archivos);
    const conservar = Array.isArray(datosRaw?.fotosConservar) ? datosRaw.fotosConservar.map(Number) : null;
    if (!conservar || conservar.some((x) => !Number.isInteger(x))) {
      throw errores.validacion([{ campo: 'fotosConservar', mensaje: 'Indique las fotografías actuales que desea conservar (lista de IDs).' }]);
    }

    const ahora = new Date();
    const datos = await repo.transaccion(async (ops) => {
      const actual = await ops.obtenerVehiculoBloqueado(id);
      if (!actual) throw errores.noEncontrado('El vehículo no existe.');
      if (Number(actual.usuarioId) !== Number(usuarioId)) throw errores.prohibido('Solo el publicador puede editar este vehículo.');
      if (estadoSubasta(actual, ahora) === 'cerrada') {
        throw errores.conflicto('La subasta ya cerró; la publicación no se puede editar.', 'SUBASTA_CERRADA_NO_EDITABLE');
      }

      const d = validarVehiculo(datosRaw, { catalogos, ahora, original: actual });

      if (actual.totalPujas > 0) {
        const cambio =
          Math.round(d.precioBase * 100) !== Math.round(actual.precioBase * 100) ||
          Math.abs(d.fechaInicio - new Date(actual.fechaInicio)) >= 1000 ||
          Math.abs(d.fechaCierre - new Date(actual.fechaCierre)) >= 1000;
        if (cambio) {
          throw errores.conflicto(
            'La subasta ya tiene ofertas: el precio base y las fechas no se pueden modificar.',
            'PARAMETROS_BLOQUEADOS'
          );
        }
      }

      const existentes = await ops.listarIdsFotos(id);
      const ajenas = conservar.filter((f) => !existentes.includes(f));
      if (ajenas.length) throw errores.validacion([{ campo: 'fotosConservar', mensaje: `Las fotos ${ajenas.join(', ')} no pertenecen a este vehículo.` }]);
      const unicas = [...new Set(conservar)];
      validarCantidadFotos(unicas.length + nuevas.length);
      const orden = ordenFinal(datosRaw.fotosOrden, unicas, nuevas.length);

      await ops.actualizarVehiculo(id, d);
      await ops.eliminarFotos(id, existentes.filter((f) => !unicas.includes(f)));
      let n = 1;
      for (const [tipo, valor] of orden) {
        if (tipo === 'e') await ops.ordenarFoto(valor, n++);
        else await ops.insertarFoto(id, n++, nuevas[valor]);
      }
      return d;
    });

    programador?.programar({ id, fechaInicio: datos.fechaInicio, fechaCierre: datos.fechaCierre });
    catalogoService.invalidar?.();
    eventos.emit('vehiculo:actualizado', { vehiculoId: id });
    return detalle(id, usuarioId);
  }

  async function listar(query, usuarioId = null) {
    const f = validarFiltros(query);
    const ahora = new Date();
    const { total, data } = await repo.listarVehiculos(f, ahora);
    return {
      total,
      pagina: f.pagina,
      tamano: f.tamano,
      paginas: Math.max(1, Math.ceil(total / f.tamano)),
      data: data.map((v) => vehiculoDto(v, { ahora, usuarioId }))
    };
  }

  async function misVehiculos(usuarioId, query) {
    const f = validarFiltros(query, { estadoPorDefecto: 'todas', ordenPorDefecto: 'recientes' });
    f.usuarioId = usuarioId;
    f.tamano = Math.max(f.tamano, 48);
    const ahora = new Date();
    const { total, data } = await repo.listarVehiculos(f, ahora);
    return { total, data: data.map((v) => vehiculoDto(v, { ahora, usuarioId })) };
  }

  async function detalle(id, usuarioId = null) {
    const vid = Number(id);
    if (!Number.isInteger(vid) || vid <= 0) throw errores.noEncontrado('El vehículo no existe.');
    const v = await repo.obtenerVehiculo(vid);
    if (!v) throw errores.noEncontrado('El vehículo no existe.');
    const haOfertado = usuarioId ? await repo.haOfertado(vid, usuarioId) : false;
    return vehiculoDto(v, { ahora: new Date(), usuarioId, haOfertado, detalle: true });
  }

  async function foto(id) {
    const fid = Number(id);
    if (!Number.isInteger(fid) || fid <= 0) throw errores.noEncontrado('La foto no existe.');
    const f = await repo.obtenerFoto(fid);
    if (!f) throw errores.noEncontrado('La foto no existe.');
    return f;
  }

  return { publicar, actualizar, listar, misVehiculos, detalle, foto };
}

module.exports = { crearVehiculoService };
