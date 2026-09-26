'use strict';

/**
 * Repositorio EN MEMORIA con la misma interfaz que el de SQL Server.
 * Uso: pruebas automáticas y modo demo (npm run demo). Emula PK, UNIQUE,
 * FK, ON DELETE CASCADE, ROLLBACK y el bloqueo de filas (las transacciones
 * se ejecutan en serie, como con UPDLOCK en SQL Server).
 * En producción siempre se usa sqlServerRepository.
 */
const base = require('../db/catalogosBase');

function crearCatalogos() {
  const conId = (arr, map) => arr.map((x, i) => ({ id: i + 1, ...map(x) }));
  return {
    tiposArticulo: conId(base.tiposArticulo, (n) => ({ nombre: n })),
    marcas: conId(base.marcas, (n) => ({ nombre: n })),
    combustibles: conId(base.combustibles, (n) => ({ nombre: n })),
    transmisiones: conId(base.transmisiones, (n) => ({ nombre: n })),
    trenesManejo: conId(base.trenesManejo, (t) => ({ codigo: t.codigo, descripcion: t.descripcion })),
    nivelesDanio: conId(base.nivelesDanio, (d) => ({ codigo: d.codigo, nombre: d.nombre, descripcion: d.descripcion, color: d.color }))
  };
}

const ms = (f) => new Date(f).getTime();
const contiene = (texto, q) => String(texto ?? '').toLowerCase().includes(String(q).toLowerCase());
const precioVigente = (v) => (v.montoActual ?? v.precioBase);

function crearRepositorioMemoria() {
  const cat = crearCatalogos();
  const porId = (lista, id) => lista.find((x) => x.id === Number(id));
  let s = { usuarios: [], vehiculos: [], fotos: [], pujas: [], seq: { u: 1, v: 1, f: 1, p: 1 } };
  const datosFotos = new Map(); // FotoID -> { mime, datos } (inmutable)
  let cola = Promise.resolve(); // serializa transacciones (emula bloqueos)

  const fkError = (msg) => Object.assign(new Error(msg), { number: 547 });

  function mapVehiculo(v, st = s) {
    const fotos = st.fotos.filter((f) => f.vehiculoId === v.id).sort((a, b) => a.orden - b.orden || a.id - b.id);
    const tipo = porId(cat.tiposArticulo, v.tipoArticuloId);
    const marca = porId(cat.marcas, v.marcaId);
    const tr = porId(cat.transmisiones, v.transmisionId);
    const co = porId(cat.combustibles, v.combustibleId);
    const tm = porId(cat.trenesManejo, v.trenManejoId);
    const nd = porId(cat.nivelesDanio, v.nivelDanioId);
    return {
      id: v.id,
      usuarioId: v.usuarioId,
      anio: v.anio,
      tipoArticulo: { id: tipo.id, nombre: tipo.nombre },
      marca: { id: marca.id, nombre: marca.nombre },
      modelo: v.modelo,
      motor: v.motor,
      transmision: { id: tr.id, nombre: tr.nombre },
      combustible: { id: co.id, nombre: co.nombre },
      trenManejo: { id: tm.id, codigo: tm.codigo, descripcion: tm.descripcion },
      cilindros: v.cilindros,
      danio: { ...nd },
      color: v.color ?? null,
      kilometraje: v.kilometraje ?? null,
      descripcion: v.descripcion ?? null,
      precioBase: v.precioBase,
      fechaInicio: new Date(v.fechaInicio),
      fechaCierre: new Date(v.fechaCierre),
      montoActual: v.montoActual ?? null,
      totalPujas: v.totalPujas,
      liderUsuarioId: v.liderUsuarioId ?? null,
      resultado: v.resultado ?? null,
      fechaCierreReal: v.fechaCierreReal ?? null,
      fechaCreacion: new Date(v.fechaCreacion),
      fechaActualizacion: new Date(v.fechaActualizacion),
      fotoPortadaId: fotos[0]?.id ?? null,
      totalFotos: fotos.length
    };
  }

  function cumpleEstado(v, estado, ahora) {
    const t = ms(ahora);
    const abierta = !v.resultado;
    switch (estado) {
      case 'activa':
        return abierta && ms(v.fechaInicio) <= t && ms(v.fechaCierre) > t;
      case 'proxima':
        return abierta && ms(v.fechaInicio) > t;
      case 'cerrada':
        return !abierta || ms(v.fechaCierre) <= t;
      case 'disponibles':
        return abierta && ms(v.fechaCierre) > t;
      default:
        return true;
    }
  }

  function filtrar(f, ahora) {
    return s.vehiculos.filter((v) => {
      const m = mapVehiculo(v);
      if (f.usuarioId && v.usuarioId !== f.usuarioId) return false;
      if (f.q && ![m.marca.nombre, m.modelo, m.motor, m.tipoArticulo.nombre, m.color, String(m.anio)].some((x) => contiene(x, f.q))) return false;
      if (f.anioMin != null && v.anio < f.anioMin) return false;
      if (f.anioMax != null && v.anio > f.anioMax) return false;
      if (f.marcas?.length && !f.marcas.includes(v.marcaId)) return false;
      if (f.modelo && !contiene(v.modelo, f.modelo)) return false;
      if (f.tipos?.length && !f.tipos.includes(v.tipoArticuloId)) return false;
      if (f.combustibles?.length && !f.combustibles.includes(v.combustibleId)) return false;
      if (f.transmisiones?.length && !f.transmisiones.includes(v.transmisionId)) return false;
      if (f.trenes?.length && !f.trenes.includes(v.trenManejoId)) return false;
      if (f.cilindros?.length && !f.cilindros.includes(v.cilindros)) return false;
      if (f.danios?.length && !f.danios.includes(m.danio.codigo)) return false;
      if (f.precioMin != null && precioVigente(v) < f.precioMin) return false;
      if (f.precioMax != null && precioVigente(v) > f.precioMax) return false;
      if (f.estado && !cumpleEstado(v, f.estado, ahora)) return false;
      return true;
    });
  }

  function comparador(orden, ahora) {
    const t = ms(ahora);
    const porCierre = (a, b) => {
      const g = (v) => (!v.resultado && ms(v.fechaCierre) > t ? 0 : 1);
      const h = (v) => (ms(v.fechaInicio) <= t ? 0 : 1);
      return g(a) - g(b) || h(a) - h(b) || ms(a.fechaCierre) - ms(b.fechaCierre);
    };
    const c = {
      cierre: porCierre,
      recientes: (a, b) => ms(b.fechaCreacion) - ms(a.fechaCreacion),
      precio_asc: (a, b) => precioVigente(a) - precioVigente(b),
      precio_desc: (a, b) => precioVigente(b) - precioVigente(a),
      anio_desc: (a, b) => b.anio - a.anio,
      anio_asc: (a, b) => a.anio - b.anio,
      populares: (a, b) => b.totalPujas - a.totalPujas
    }[orden] || porCierre;
    return (a, b) => c(a, b) || b.id - a.id;
  }

  function operaciones(st) {
    const validarFks = (d) => {
      const checks = [
        [cat.tiposArticulo, d.tipoArticuloId],
        [cat.marcas, d.marcaId],
        [cat.transmisiones, d.transmisionId],
        [cat.combustibles, d.combustibleId],
        [cat.trenesManejo, d.trenManejoId],
        [cat.nivelesDanio, d.nivelDanioId]
      ];
      if (checks.some(([l, id]) => !porId(l, id))) throw fkError('FK de catálogo inválida');
    };
    return {
      async obtenerVehiculoBloqueado(id) {
        const v = st.vehiculos.find((x) => x.id === Number(id));
        return v
          ? {
              id: v.id,
              usuarioId: v.usuarioId,
              precioBase: v.precioBase,
              fechaInicio: new Date(v.fechaInicio),
              fechaCierre: new Date(v.fechaCierre),
              montoActual: v.montoActual ?? null,
              totalPujas: v.totalPujas,
              liderUsuarioId: v.liderUsuarioId ?? null,
              resultado: v.resultado ?? null
            }
          : null;
      },
      async insertarPuja(vehiculoId, usuarioId, monto, fecha) {
        const p = { id: st.seq.p++, vehiculoId, usuarioId, monto, fecha: new Date(fecha) };
        st.pujas.push(p);
        return { id: p.id, fecha: p.fecha };
      },
      async registrarLider(vehiculoId, monto, usuarioId) {
        const v = st.vehiculos.find((x) => x.id === vehiculoId);
        v.montoActual = monto;
        v.totalPujas += 1;
        v.liderUsuarioId = usuarioId;
      },
      async insertarVehiculo(d, usuarioId, esDemo = false) {
        validarFks(d);
        if (!st.usuarios.some((u) => u.id === usuarioId)) throw fkError('Usuario inexistente');
        const ahora = new Date();
        const v = {
          ...d,
          id: st.seq.v++,
          usuarioId,
          esDemo,
          montoActual: null,
          totalPujas: 0,
          liderUsuarioId: null,
          resultado: null,
          fechaCreacion: ahora,
          fechaActualizacion: ahora
        };
        st.vehiculos.push(v);
        return v.id;
      },
      async actualizarVehiculo(id, d) {
        validarFks(d);
        const v = st.vehiculos.find((x) => x.id === id);
        Object.assign(v, d, { fechaActualizacion: new Date() });
      },
      async listarIdsFotos(vehiculoId) {
        return st.fotos.filter((f) => f.vehiculoId === vehiculoId).sort((a, b) => a.orden - b.orden || a.id - b.id).map((f) => f.id);
      },
      async eliminarFotos(vehiculoId, ids) {
        st.fotos = st.fotos.filter((f) => !(f.vehiculoId === vehiculoId && ids.includes(f.id)));
      },
      async ordenarFoto(fotoId, orden) {
        const f = st.fotos.find((x) => x.id === fotoId);
        if (f) f.orden = orden;
      },
      async insertarFoto(vehiculoId, orden, foto) {
        const id = st.seq.f++;
        datosFotos.set(id, { mime: foto.mime, datos: Buffer.from(foto.buffer) });
        st.fotos.push({ id, vehiculoId, orden, tamano: foto.buffer.length });
        return id;
      }
    };
  }

  return {
    nombre: 'memoria',
    async ping() {
      return true;
    },

    async listarCatalogos() {
      return structuredClone({ ...cat, marcas: [...cat.marcas].sort((a, b) => a.nombre.localeCompare(b.nombre)) });
    },
    async listarModelos({ marcaId } = {}) {
      const set = new Set(s.vehiculos.filter((v) => !marcaId || v.marcaId === Number(marcaId)).map((v) => v.modelo));
      return [...set].sort((a, b) => a.localeCompare(b));
    },

    async crearUsuario(u) {
      if (s.usuarios.some((x) => x.correo.toLowerCase() === u.correo.toLowerCase())) {
        throw Object.assign(new Error('Correo duplicado'), { codigo: 'CORREO_DUPLICADO' });
      }
      const nuevo = { ...u, id: s.seq.u++, fechaRegistro: new Date() };
      s.usuarios.push(nuevo);
      const { passwordHash, ...publico } = nuevo;
      return publico;
    },
    async actualizarPasswordUsuario(id, passwordHash, datos) {
      Object.assign(s.usuarios.find((x) => x.id === id), { passwordHash, ...datos });
    },
    async buscarUsuarioPorCorreo(correo) {
      const u = s.usuarios.find((x) => x.correo.toLowerCase() === String(correo).toLowerCase());
      return u ? { ...u } : null;
    },
    async obtenerUsuario(id) {
      const u = s.usuarios.find((x) => x.id === Number(id));
      if (!u) return null;
      const { passwordHash, ...publico } = u;
      return publico;
    },

    async listarVehiculos(f, ahora) {
      const lista = filtrar(f, ahora).sort(comparador(f.orden, ahora));
      const inicio = (f.pagina - 1) * f.tamano;
      return { total: lista.length, data: lista.slice(inicio, inicio + f.tamano).map((v) => mapVehiculo(v)) };
    },
    async obtenerVehiculo(id) {
      const v = s.vehiculos.find((x) => x.id === Number(id));
      if (!v) return null;
      const fotos = s.fotos.filter((f) => f.vehiculoId === v.id).sort((a, b) => a.orden - b.orden || a.id - b.id).map((f) => f.id);
      return { ...mapVehiculo(v), fotos };
    },
    async obtenerFoto(id) {
      if (!s.fotos.some((f) => f.id === Number(id))) return null;
      return datosFotos.get(Number(id)) || null;
    },

    async listarPujas(vehiculoId, limite = 50) {
      return s.pujas
        .filter((p) => p.vehiculoId === Number(vehiculoId))
        .sort((a, b) => b.monto - a.monto || b.id - a.id)
        .slice(0, limite)
        .map((p) => ({ id: p.id, usuarioId: p.usuarioId, monto: p.monto, fecha: new Date(p.fecha) }));
    },
    async haOfertado(vehiculoId, usuarioId) {
      return s.pujas.some((p) => p.vehiculoId === Number(vehiculoId) && p.usuarioId === Number(usuarioId));
    },
    async listarPostores(vehiculoId) {
      return [...new Set(s.pujas.filter((p) => p.vehiculoId === Number(vehiculoId)).map((p) => p.usuarioId))];
    },
    async misOfertas(usuarioId) {
      const mias = s.pujas.filter((p) => p.usuarioId === Number(usuarioId));
      const ids = [...new Set(mias.map((p) => p.vehiculoId))];
      return ids
        .map((id) => {
          const propias = mias.filter((p) => p.vehiculoId === id);
          return {
            ...mapVehiculo(s.vehiculos.find((v) => v.id === id)),
            miMaximo: Math.max(...propias.map((p) => p.monto)),
            misPujas: propias.length,
            miUltimaPuja: new Date(Math.max(...propias.map((p) => ms(p.fecha))))
          };
        })
        .sort((a, b) => ms(b.miUltimaPuja) - ms(a.miUltimaPuja));
    },

    async subastasAbiertas() {
      return s.vehiculos.filter((v) => !v.resultado).map((v) => ({ id: v.id, fechaInicio: new Date(v.fechaInicio), fechaCierre: new Date(v.fechaCierre) }));
    },
    async cerrarVencidas(ahora, id = null) {
      const cerradas = [];
      for (const v of s.vehiculos) {
        if (v.resultado || ms(v.fechaCierre) > ms(ahora) || (id != null && v.id !== Number(id))) continue;
        v.resultado = v.totalPujas > 0 ? 'vendida' : 'desierta';
        v.fechaCierreReal = new Date(ahora);
        cerradas.push({ id: v.id, resultado: v.resultado, montoFinal: v.montoActual ?? null, liderUsuarioId: v.liderUsuarioId ?? null, totalPujas: v.totalPujas });
      }
      return cerradas;
    },

    async eliminarVehiculosDemo() {
      const ids = s.vehiculos.filter((v) => v.esDemo).map((v) => v.id);
      s.vehiculos = s.vehiculos.filter((v) => !ids.includes(v.id));
      s.fotos = s.fotos.filter((f) => !ids.includes(f.vehiculoId));
      s.pujas = s.pujas.filter((p) => !ids.includes(p.vehiculoId));
    },

    async transaccion(trabajo) {
      const ejecutar = async () => {
        const copia = structuredClone(s); // BEGIN TRAN
        const r = await trabajo(operaciones(copia));
        s = copia; // COMMIT (si hubo excepción, la copia se descarta = ROLLBACK)
        return r;
      };
      const resultado = cola.then(ejecutar, ejecutar);
      cola = resultado.catch(() => {});
      return resultado;
    },

    // --- utilidades solo para pruebas ---
    _estado: () => s,
    _catalogos: () => cat
  };
}

module.exports = { crearRepositorioMemoria };
