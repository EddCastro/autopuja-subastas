'use strict';

/**
 * Carga los datos de prueba (idempotente): crea/actualiza los 3 usuarios,
 * elimina los vehículos de demostración anteriores y los vuelve a crear con
 * fechas relativas a "ahora" (así las subastas quedan vigentes al evaluar).
 */
const { usuarios, vehiculos } = require('./datosSemilla');
const { fotoPlaceholder } = require('./placeholder');
const { detectarMime } = require('../validators/vehiculoValidator');

async function descargarFoto(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (AutoPuja seed)', Accept: 'image/jpeg,image/*' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const mime = detectarMime(buffer);
    if (!mime) throw new Error('no es una imagen');
    return { mime, buffer };
  } finally {
    clearTimeout(t);
  }
}

async function sembrar({ repo, authService, descargar = true, log = console.log }) {
  // 1) Usuarios de prueba
  const ids = {};
  for (const u of usuarios) {
    const creado = await authService.asegurarUsuario(u);
    ids[u.clave] = creado.id;
  }
  log(`  ✔ ${usuarios.length} usuarios de prueba listos`);

  // 2) Catálogos → mapas nombre/código → id
  const cat = await repo.listarCatalogos();
  const buscar = (lista, campo, valor) => {
    const x = cat[lista].find((c) => c[campo] === valor);
    if (!x) throw new Error(`Catálogo ${lista} sin "${valor}". Ejecute primero la migración.`);
    return x.id;
  };

  // 3) Vehículos de demostración
  await repo.eliminarVehiculosDemo();
  const ahora = Date.now();
  let descargadas = 0;
  let respaldo = 0;

  for (const v of vehiculos) {
    const titulo = `${v.anio} ${v.marca} ${v.modelo}`;
    const fotos = [];
    for (let i = 0; i < v.fotos.length; i++) {
      let foto = null;
      if (descargar) {
        try {
          foto = await descargarFoto(v.fotos[i].url);
          descargadas++;
        } catch (err) {
          log(`    · No se pudo descargar la foto ${v.fotos[i].id} (${err.message}); se usa imagen de respaldo.`);
        }
      }
      if (!foto) {
        foto = fotoPlaceholder({ titulo, color: v.color, indice: i + 1, total: v.fotos.length });
        respaldo++;
      }
      fotos.push(foto);
    }

    const datos = {
      anio: v.anio,
      tipoArticuloId: buscar('tiposArticulo', 'nombre', v.tipo),
      marcaId: buscar('marcas', 'nombre', v.marca),
      modelo: v.modelo,
      motor: v.motor,
      transmisionId: buscar('transmisiones', 'nombre', v.transmision),
      combustibleId: buscar('combustibles', 'nombre', v.combustible),
      trenManejoId: buscar('trenesManejo', 'codigo', v.tren),
      cilindros: v.cilindros,
      nivelDanioId: buscar('nivelesDanio', 'codigo', v.danio),
      color: v.color,
      kilometraje: v.kilometraje,
      descripcion: v.descripcion,
      precioBase: v.precioBase,
      fechaInicio: new Date(ahora + v.inicio),
      fechaCierre: new Date(ahora + v.cierre)
    };

    const id = await repo.transaccion(async (ops) => {
      const nuevoId = await ops.insertarVehiculo(datos, ids[v.propietario], true);
      for (let i = 0; i < fotos.length; i++) await ops.insertarFoto(nuevoId, i + 1, fotos[i]);
      for (const [postor, monto, desfase] of v.pujas) {
        await ops.insertarPuja(nuevoId, ids[postor], monto, new Date(ahora + desfase));
        await ops.registrarLider(nuevoId, monto, ids[postor]);
      }
      return nuevoId;
    });
    if (v.cierre <= 0) await repo.cerrarVencidas(new Date(), id);
    log(`  ✔ ${titulo} (id ${id})`);
  }
  log(`  ✔ ${vehiculos.length} vehículos de demostración (${descargadas} fotos descargadas${respaldo ? `, ${respaldo} de respaldo` : ''})`);
  return { usuarios: ids };
}

module.exports = { sembrar, usuariosPrueba: usuarios };
