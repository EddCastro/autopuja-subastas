'use strict';

/**
 * Acceso a datos en SQL Server. Todas las consultas son parametrizadas.
 * Las operaciones que modifican varias tablas se ejecutan en transacción
 * mediante `transaccion(fn)`, que entrega un objeto `ops` con operaciones
 * atómicas (el repositorio en memoria implementa la misma interfaz).
 */
const { sql, getPool } = require('../db/pool');
const { T } = require('../db/esquema');
const { numeroErrorSql, SQL } = require('../utils/sqlErrors');

// ---------------------------------------------------------------------------
// Consultas base y mapeos
// ---------------------------------------------------------------------------
const SELECT_VEHICULO = `
SELECT v.VehiculoID, v.UsuarioID, v.Anio,
       v.TipoArticuloID, ta.Nombre AS TipoArticulo,
       v.MarcaID, ma.Nombre AS Marca, v.Modelo, v.Motor,
       v.TransmisionID, tr.Nombre AS Transmision,
       v.CombustibleID, co.Nombre AS Combustible,
       v.TrenManejoID, tm.Codigo AS TrenCodigo, tm.Descripcion AS TrenDescripcion,
       v.Cilindros,
       v.NivelDanioID, nd.Codigo AS DanioCodigo, nd.Nombre AS DanioNombre, nd.Descripcion AS DanioDescripcion, nd.ColorHex AS DanioColor,
       v.Color, v.Kilometraje, v.Descripcion,
       v.PrecioBase, v.FechaInicio, v.FechaCierre, v.MontoActual, v.TotalPujas, v.LiderUsuarioID,
       v.Resultado, v.FechaCierreReal, v.FechaCreacion, v.FechaActualizacion,
       fp.FotoID AS FotoPortadaID, fc.TotalFotos
FROM ${T.Vehiculos} AS v
INNER JOIN ${T.TiposArticulo} AS ta ON ta.TipoArticuloID = v.TipoArticuloID
INNER JOIN ${T.Marcas}        AS ma ON ma.MarcaID = v.MarcaID
INNER JOIN ${T.Transmisiones} AS tr ON tr.TransmisionID = v.TransmisionID
INNER JOIN ${T.Combustibles}  AS co ON co.CombustibleID = v.CombustibleID
INNER JOIN ${T.TrenesManejo}  AS tm ON tm.TrenManejoID = v.TrenManejoID
INNER JOIN ${T.NivelesDanio}  AS nd ON nd.NivelDanioID = v.NivelDanioID
OUTER APPLY (SELECT TOP (1) f.FotoID FROM ${T.Fotos} AS f WHERE f.VehiculoID = v.VehiculoID ORDER BY f.Orden, f.FotoID) AS fp
OUTER APPLY (SELECT COUNT(*) AS TotalFotos FROM ${T.Fotos} AS f2 WHERE f2.VehiculoID = v.VehiculoID) AS fc`;

const num = (x) => (x == null ? null : Number(x));

function mapVehiculo(r) {
  return {
    id: r.VehiculoID,
    usuarioId: r.UsuarioID,
    anio: r.Anio,
    tipoArticulo: { id: r.TipoArticuloID, nombre: r.TipoArticulo },
    marca: { id: r.MarcaID, nombre: r.Marca },
    modelo: r.Modelo,
    motor: r.Motor,
    transmision: { id: r.TransmisionID, nombre: r.Transmision },
    combustible: { id: r.CombustibleID, nombre: r.Combustible },
    trenManejo: { id: r.TrenManejoID, codigo: r.TrenCodigo, descripcion: r.TrenDescripcion },
    cilindros: r.Cilindros,
    danio: { id: r.NivelDanioID, codigo: r.DanioCodigo, nombre: r.DanioNombre, descripcion: r.DanioDescripcion, color: r.DanioColor },
    color: r.Color,
    kilometraje: r.Kilometraje,
    descripcion: r.Descripcion,
    precioBase: num(r.PrecioBase),
    fechaInicio: r.FechaInicio,
    fechaCierre: r.FechaCierre,
    montoActual: num(r.MontoActual),
    totalPujas: r.TotalPujas,
    liderUsuarioId: r.LiderUsuarioID,
    resultado: r.Resultado ? r.Resultado.toLowerCase() : null,
    fechaCierreReal: r.FechaCierreReal,
    fechaCreacion: r.FechaCreacion,
    fechaActualizacion: r.FechaActualizacion,
    fotoPortadaId: r.FotoPortadaID ?? null,
    totalFotos: r.TotalFotos ?? 0
  };
}

const mapBloqueado = (r) =>
  r && {
    id: r.VehiculoID,
    usuarioId: r.UsuarioID,
    precioBase: num(r.PrecioBase),
    fechaInicio: r.FechaInicio,
    fechaCierre: r.FechaCierre,
    montoActual: num(r.MontoActual),
    totalPujas: r.TotalPujas,
    liderUsuarioId: r.LiderUsuarioID,
    resultado: r.Resultado ? r.Resultado.toLowerCase() : null
  };

const mapUsuario = (r) =>
  r && {
    id: r.UsuarioID,
    nombre: r.Nombre,
    apellido: r.Apellido,
    correo: r.Correo,
    telefono: r.Telefono,
    fechaRegistro: r.FechaRegistro,
    ...(r.PasswordHash ? { passwordHash: r.PasswordHash } : {})
  };

/** Escapa comodines de LIKE ([, %, _). */
const escLike = (s) => String(s).replace(/[[%_]/g, '[$&]');

/** Agrega parámetros @prefijo0..n y devuelve "(@p0, @p1…)". */
function lista(req, prefijo, valores, tipo) {
  return `(${valores.map((v, i) => (req.input(`${prefijo}${i}`, tipo, v), `@${prefijo}${i}`)).join(', ')})`;
}

const CONDICION_ESTADO = {
  activa: 'v.Resultado IS NULL AND v.FechaInicio <= @ahora AND v.FechaCierre > @ahora',
  proxima: 'v.Resultado IS NULL AND v.FechaInicio > @ahora',
  cerrada: '(v.Resultado IS NOT NULL OR v.FechaCierre <= @ahora)',
  disponibles: 'v.Resultado IS NULL AND v.FechaCierre > @ahora'
};

const ORDEN = {
  cierre:
    'CASE WHEN v.Resultado IS NULL AND v.FechaCierre > @ahora THEN 0 ELSE 1 END, CASE WHEN v.FechaInicio <= @ahora THEN 0 ELSE 1 END, v.FechaCierre ASC',
  recientes: 'v.FechaCreacion DESC',
  precio_asc: 'COALESCE(v.MontoActual, v.PrecioBase) ASC',
  precio_desc: 'COALESCE(v.MontoActual, v.PrecioBase) DESC',
  anio_desc: 'v.Anio DESC',
  anio_asc: 'v.Anio ASC',
  populares: 'v.TotalPujas DESC'
};

/** Construye el WHERE de los filtros multitarea (todos combinables con AND). */
function construirWhere(req, f, ahora) {
  req.input('ahora', sql.DateTime2(3), ahora);
  const c = [];
  if (f.usuarioId) {
    req.input('usuarioId', sql.Int, f.usuarioId);
    c.push('v.UsuarioID = @usuarioId');
  }
  if (f.q) {
    req.input('q', sql.NVarChar(120), `%${escLike(f.q)}%`);
    c.push('(ma.Nombre LIKE @q OR v.Modelo LIKE @q OR v.Motor LIKE @q OR ta.Nombre LIKE @q OR v.Color LIKE @q OR CAST(v.Anio AS VARCHAR(4)) LIKE @q)');
  }
  if (f.anioMin != null) (req.input('anioMin', sql.SmallInt, f.anioMin), c.push('v.Anio >= @anioMin'));
  if (f.anioMax != null) (req.input('anioMax', sql.SmallInt, f.anioMax), c.push('v.Anio <= @anioMax'));
  if (f.marcas?.length) c.push(`v.MarcaID IN ${lista(req, 'ma', f.marcas, sql.Int)}`);
  if (f.modelo) (req.input('modelo', sql.NVarChar(90), `%${escLike(f.modelo)}%`), c.push('v.Modelo LIKE @modelo'));
  if (f.tipos?.length) c.push(`v.TipoArticuloID IN ${lista(req, 'ti', f.tipos, sql.Int)}`);
  if (f.combustibles?.length) c.push(`v.CombustibleID IN ${lista(req, 'co', f.combustibles, sql.Int)}`);
  if (f.transmisiones?.length) c.push(`v.TransmisionID IN ${lista(req, 'tr', f.transmisiones, sql.Int)}`);
  if (f.trenes?.length) c.push(`v.TrenManejoID IN ${lista(req, 'tm', f.trenes, sql.Int)}`);
  if (f.cilindros?.length) c.push(`v.Cilindros IN ${lista(req, 'ci', f.cilindros, sql.TinyInt)}`);
  if (f.danios?.length) c.push(`nd.Codigo IN ${lista(req, 'da', f.danios, sql.VarChar(10))}`);
  if (f.precioMin != null) (req.input('precioMin', sql.Decimal(12, 2), f.precioMin), c.push('COALESCE(v.MontoActual, v.PrecioBase) >= @precioMin'));
  if (f.precioMax != null) (req.input('precioMax', sql.Decimal(12, 2), f.precioMax), c.push('COALESCE(v.MontoActual, v.PrecioBase) <= @precioMax'));
  if (f.estado && CONDICION_ESTADO[f.estado]) c.push(CONDICION_ESTADO[f.estado]);
  return c.length ? `WHERE ${c.join('\n  AND ')}` : '';
}

// ---------------------------------------------------------------------------
// Operaciones dentro de una transacción
// ---------------------------------------------------------------------------
function operaciones(tx) {
  const rq = () => tx.request();
  return {
    async obtenerVehiculoBloqueado(id) {
      const { recordset } = await rq()
        .input('id', sql.Int, id)
        .query(
          `SELECT VehiculoID, UsuarioID, PrecioBase, FechaInicio, FechaCierre, MontoActual, TotalPujas, LiderUsuarioID, Resultado
             FROM ${T.Vehiculos} WITH (UPDLOCK, ROWLOCK)
            WHERE VehiculoID = @id;`
        );
      return mapBloqueado(recordset[0]) || null;
    },

    async insertarPuja(vehiculoId, usuarioId, monto, fecha) {
      const { recordset } = await rq()
        .input('v', sql.Int, vehiculoId)
        .input('u', sql.Int, usuarioId)
        .input('m', sql.Decimal(12, 2), monto)
        .input('f', sql.DateTime2(3), fecha)
        .query(
          `INSERT INTO ${T.Pujas} (VehiculoID, UsuarioID, Monto, Fecha)
           OUTPUT INSERTED.PujaID, INSERTED.Fecha
           VALUES (@v, @u, @m, @f);`
        );
      return { id: recordset[0].PujaID, fecha: recordset[0].Fecha };
    },

    async registrarLider(vehiculoId, monto, usuarioId) {
      await rq()
        .input('v', sql.Int, vehiculoId)
        .input('u', sql.Int, usuarioId)
        .input('m', sql.Decimal(12, 2), monto)
        .query(
          `UPDATE ${T.Vehiculos}
              SET MontoActual = @m, TotalPujas = TotalPujas + 1, LiderUsuarioID = @u
            WHERE VehiculoID = @v;`
        );
    },

    async insertarVehiculo(d, usuarioId, esDemo = false) {
      const { recordset } = await entradasVehiculo(rq(), d)
        .input('usuarioId', sql.Int, usuarioId)
        .input('esDemo', sql.Bit, esDemo)
        .query(
          `INSERT INTO ${T.Vehiculos}
             (UsuarioID, Anio, TipoArticuloID, MarcaID, Modelo, Motor, TransmisionID, CombustibleID, TrenManejoID,
              Cilindros, NivelDanioID, Color, Kilometraje, Descripcion, PrecioBase, FechaInicio, FechaCierre, EsDemo)
           OUTPUT INSERTED.VehiculoID
           VALUES
             (@usuarioId, @anio, @tipoArticuloId, @marcaId, @modelo, @motor, @transmisionId, @combustibleId, @trenManejoId,
              @cilindros, @nivelDanioId, @color, @kilometraje, @descripcion, @precioBase, @fechaInicio, @fechaCierre, @esDemo);`
        );
      return recordset[0].VehiculoID;
    },

    async actualizarVehiculo(id, d) {
      await entradasVehiculo(rq(), d)
        .input('id', sql.Int, id)
        .query(
          `UPDATE ${T.Vehiculos}
              SET Anio = @anio, TipoArticuloID = @tipoArticuloId, MarcaID = @marcaId, Modelo = @modelo, Motor = @motor,
                  TransmisionID = @transmisionId, CombustibleID = @combustibleId, TrenManejoID = @trenManejoId,
                  Cilindros = @cilindros, NivelDanioID = @nivelDanioId, Color = @color, Kilometraje = @kilometraje,
                  Descripcion = @descripcion, PrecioBase = @precioBase, FechaInicio = @fechaInicio, FechaCierre = @fechaCierre,
                  FechaActualizacion = SYSUTCDATETIME()
            WHERE VehiculoID = @id;`
        );
    },

    async listarIdsFotos(vehiculoId) {
      const { recordset } = await rq()
        .input('v', sql.Int, vehiculoId)
        .query(`SELECT FotoID FROM ${T.Fotos} WHERE VehiculoID = @v ORDER BY Orden, FotoID;`);
      return recordset.map((r) => r.FotoID);
    },

    async eliminarFotos(vehiculoId, ids) {
      if (!ids.length) return;
      const r = rq().input('v', sql.Int, vehiculoId);
      await r.query(`DELETE FROM ${T.Fotos} WHERE VehiculoID = @v AND FotoID IN ${lista(r, 'f', ids, sql.Int)};`);
    },

    async ordenarFoto(fotoId, orden) {
      await rq().input('id', sql.Int, fotoId).input('o', sql.TinyInt, orden).query(`UPDATE ${T.Fotos} SET Orden = @o WHERE FotoID = @id;`);
    },

    async insertarFoto(vehiculoId, orden, foto) {
      const { recordset } = await rq()
        .input('v', sql.Int, vehiculoId)
        .input('o', sql.TinyInt, orden)
        .input('mime', sql.VarChar(40), foto.mime)
        .input('datos', sql.VarBinary(sql.MAX), foto.buffer)
        .input('tam', sql.Int, foto.buffer.length)
        .query(
          `INSERT INTO ${T.Fotos} (VehiculoID, Orden, TipoMime, Datos, Tamano)
           OUTPUT INSERTED.FotoID
           VALUES (@v, @o, @mime, @datos, @tam);`
        );
      return recordset[0].FotoID;
    }
  };
}

function entradasVehiculo(r, d) {
  return r
    .input('anio', sql.SmallInt, d.anio)
    .input('tipoArticuloId', sql.Int, d.tipoArticuloId)
    .input('marcaId', sql.Int, d.marcaId)
    .input('modelo', sql.NVarChar(80), d.modelo)
    .input('motor', sql.NVarChar(80), d.motor)
    .input('transmisionId', sql.Int, d.transmisionId)
    .input('combustibleId', sql.Int, d.combustibleId)
    .input('trenManejoId', sql.Int, d.trenManejoId)
    .input('cilindros', sql.TinyInt, d.cilindros)
    .input('nivelDanioId', sql.Int, d.nivelDanioId)
    .input('color', sql.NVarChar(40), d.color ?? null)
    .input('kilometraje', sql.Int, d.kilometraje ?? null)
    .input('descripcion', sql.NVarChar(1000), d.descripcion ?? null)
    .input('precioBase', sql.Decimal(12, 2), d.precioBase)
    .input('fechaInicio', sql.DateTime2(3), d.fechaInicio)
    .input('fechaCierre', sql.DateTime2(3), d.fechaCierre);
}

// ---------------------------------------------------------------------------
// Repositorio
// ---------------------------------------------------------------------------
function crearRepositorioSqlServer() {
  const pool = () => getPool();

  return {
    nombre: 'sqlserver',

    async ping() {
      await (await pool()).request().query('SELECT 1 AS ok;');
      return true;
    },

    // ---------- Catálogos ----------
    async listarCatalogos() {
      const { recordsets } = await (await pool()).request().query(
        `SELECT TipoArticuloID AS id, Nombre AS nombre FROM ${T.TiposArticulo} ORDER BY TipoArticuloID;
         SELECT MarcaID AS id, Nombre AS nombre FROM ${T.Marcas} ORDER BY Nombre;
         SELECT CombustibleID AS id, Nombre AS nombre FROM ${T.Combustibles} ORDER BY CombustibleID;
         SELECT TransmisionID AS id, Nombre AS nombre FROM ${T.Transmisiones} ORDER BY TransmisionID;
         SELECT TrenManejoID AS id, Codigo AS codigo, Descripcion AS descripcion FROM ${T.TrenesManejo} ORDER BY TrenManejoID;
         SELECT NivelDanioID AS id, Codigo AS codigo, Nombre AS nombre, Descripcion AS descripcion, ColorHex AS color FROM ${T.NivelesDanio} ORDER BY Orden;`
      );
      const [tiposArticulo, marcas, combustibles, transmisiones, trenesManejo, nivelesDanio] = recordsets;
      return { tiposArticulo, marcas, combustibles, transmisiones, trenesManejo, nivelesDanio };
    },

    async listarModelos({ marcaId } = {}) {
      const r = (await pool()).request();
      let filtro = '';
      if (marcaId) (r.input('marcaId', sql.Int, marcaId), (filtro = 'WHERE MarcaID = @marcaId'));
      const { recordset } = await r.query(`SELECT DISTINCT TOP (200) Modelo FROM ${T.Vehiculos} ${filtro} ORDER BY Modelo;`);
      return recordset.map((x) => x.Modelo);
    },

    // ---------- Usuarios ----------
    async crearUsuario(u) {
      try {
        const { recordset } = await (await pool())
          .request()
          .input('nombre', sql.NVarChar(80), u.nombre)
          .input('apellido', sql.NVarChar(80), u.apellido)
          .input('correo', sql.NVarChar(150), u.correo)
          .input('telefono', sql.VarChar(20), u.telefono)
          .input('hash', sql.VarChar(100), u.passwordHash)
          .query(
            `INSERT INTO ${T.Usuarios} (Nombre, Apellido, Correo, Telefono, PasswordHash)
             OUTPUT INSERTED.UsuarioID, INSERTED.Nombre, INSERTED.Apellido, INSERTED.Correo, INSERTED.Telefono, INSERTED.FechaRegistro
             VALUES (@nombre, @apellido, @correo, @telefono, @hash);`
          );
        return mapUsuario(recordset[0]);
      } catch (err) {
        const n = numeroErrorSql(err);
        if (n === SQL.UNIQUE_CONSTRAINT || n === SQL.UNIQUE_INDEX) {
          throw Object.assign(new Error('Correo duplicado'), { codigo: 'CORREO_DUPLICADO' });
        }
        throw err;
      }
    },

    async actualizarPasswordUsuario(id, passwordHash, datos) {
      await (await pool())
        .request()
        .input('id', sql.Int, id)
        .input('hash', sql.VarChar(100), passwordHash)
        .input('nombre', sql.NVarChar(80), datos.nombre)
        .input('apellido', sql.NVarChar(80), datos.apellido)
        .input('telefono', sql.VarChar(20), datos.telefono)
        .query(`UPDATE ${T.Usuarios} SET PasswordHash = @hash, Nombre = @nombre, Apellido = @apellido, Telefono = @telefono WHERE UsuarioID = @id;`);
    },

    async buscarUsuarioPorCorreo(correo) {
      const { recordset } = await (await pool())
        .request()
        .input('correo', sql.NVarChar(150), correo)
        .query(`SELECT UsuarioID, Nombre, Apellido, Correo, Telefono, PasswordHash, FechaRegistro FROM ${T.Usuarios} WHERE Correo = @correo;`);
      return mapUsuario(recordset[0]) || null;
    },

    async obtenerUsuario(id) {
      const { recordset } = await (await pool())
        .request()
        .input('id', sql.Int, id)
        .query(`SELECT UsuarioID, Nombre, Apellido, Correo, Telefono, FechaRegistro FROM ${T.Usuarios} WHERE UsuarioID = @id;`);
      return mapUsuario(recordset[0]) || null;
    },

    // ---------- Vehículos ----------
    async listarVehiculos(f, ahora) {
      const r = (await pool()).request();
      const where = construirWhere(r, f, ahora);
      r.input('offset', sql.Int, (f.pagina - 1) * f.tamano);
      r.input('tamano', sql.Int, f.tamano);
      const { recordsets } = await r.query(
        `SELECT COUNT(*) AS Total
           FROM ${T.Vehiculos} AS v
           INNER JOIN ${T.TiposArticulo} AS ta ON ta.TipoArticuloID = v.TipoArticuloID
           INNER JOIN ${T.Marcas}        AS ma ON ma.MarcaID = v.MarcaID
           INNER JOIN ${T.NivelesDanio}  AS nd ON nd.NivelDanioID = v.NivelDanioID
         ${where};
         ${SELECT_VEHICULO}
         ${where}
         ORDER BY ${ORDEN[f.orden] || ORDEN.cierre}, v.VehiculoID DESC
         OFFSET @offset ROWS FETCH NEXT @tamano ROWS ONLY;`
      );
      return { total: recordsets[0][0].Total, data: recordsets[1].map(mapVehiculo) };
    },

    async obtenerVehiculo(id) {
      const { recordsets } = await (await pool())
        .request()
        .input('id', sql.Int, id)
        .query(
          `${SELECT_VEHICULO}
           WHERE v.VehiculoID = @id;
           SELECT FotoID FROM ${T.Fotos} WHERE VehiculoID = @id ORDER BY Orden, FotoID;`
        );
      const fila = recordsets[0][0];
      if (!fila) return null;
      return { ...mapVehiculo(fila), fotos: recordsets[1].map((x) => x.FotoID) };
    },

    async obtenerFoto(id) {
      const { recordset } = await (await pool())
        .request()
        .input('id', sql.Int, id)
        .query(`SELECT TipoMime, Datos FROM ${T.Fotos} WHERE FotoID = @id;`);
      return recordset[0] ? { mime: recordset[0].TipoMime, datos: recordset[0].Datos } : null;
    },

    // ---------- Pujas ----------
    async listarPujas(vehiculoId, limite = 50) {
      const { recordset } = await (await pool())
        .request()
        .input('v', sql.Int, vehiculoId)
        .input('lim', sql.Int, limite)
        .query(`SELECT TOP (@lim) PujaID, UsuarioID, Monto, Fecha FROM ${T.Pujas} WHERE VehiculoID = @v ORDER BY Monto DESC, PujaID DESC;`);
      return recordset.map((x) => ({ id: x.PujaID, usuarioId: x.UsuarioID, monto: Number(x.Monto), fecha: x.Fecha }));
    },

    async haOfertado(vehiculoId, usuarioId) {
      const { recordset } = await (await pool())
        .request()
        .input('v', sql.Int, vehiculoId)
        .input('u', sql.Int, usuarioId)
        .query(`SELECT CASE WHEN EXISTS (SELECT 1 FROM ${T.Pujas} WHERE VehiculoID = @v AND UsuarioID = @u) THEN 1 ELSE 0 END AS Si;`);
      return recordset[0].Si === 1;
    },

    async listarPostores(vehiculoId) {
      const { recordset } = await (await pool())
        .request()
        .input('v', sql.Int, vehiculoId)
        .query(`SELECT DISTINCT UsuarioID FROM ${T.Pujas} WHERE VehiculoID = @v;`);
      return recordset.map((x) => x.UsuarioID);
    },

    async misOfertas(usuarioId) {
      const { recordset } = await (await pool())
        .request()
        .input('u', sql.Int, usuarioId)
        .query(
          `SELECT vb.*, mp.MiMaximo, mp.MisPujas, mp.MiUltimaPuja
             FROM (${SELECT_VEHICULO}) AS vb
            CROSS APPLY (SELECT MAX(p.Monto) AS MiMaximo, COUNT(*) AS MisPujas, MAX(p.Fecha) AS MiUltimaPuja
                           FROM ${T.Pujas} AS p
                          WHERE p.VehiculoID = vb.VehiculoID AND p.UsuarioID = @u) AS mp
            WHERE mp.MisPujas > 0
            ORDER BY mp.MiUltimaPuja DESC;`
        );
      return recordset.map((x) => ({ ...mapVehiculo(x), miMaximo: Number(x.MiMaximo), misPujas: x.MisPujas, miUltimaPuja: x.MiUltimaPuja }));
    },

    // ---------- Cierre de subastas ----------
    async subastasAbiertas() {
      const { recordset } = await (await pool())
        .request()
        .query(`SELECT VehiculoID, FechaInicio, FechaCierre FROM ${T.Vehiculos} WHERE Resultado IS NULL;`);
      return recordset.map((x) => ({ id: x.VehiculoID, fechaInicio: x.FechaInicio, fechaCierre: x.FechaCierre }));
    },

    /** Cierra (si corresponde) una subasta o todas las vencidas. Devuelve las filas cerradas. */
    async cerrarVencidas(ahora, id = null) {
      const r = (await pool()).request().input('ahora', sql.DateTime2(3), ahora);
      let filtroId = '';
      if (id != null) (r.input('id', sql.Int, id), (filtroId = 'AND VehiculoID = @id'));
      const { recordset } = await r.query(
        `UPDATE ${T.Vehiculos}
            SET Resultado = CASE WHEN TotalPujas > 0 THEN 'VENDIDA' ELSE 'DESIERTA' END,
                FechaCierreReal = @ahora
         OUTPUT INSERTED.VehiculoID, INSERTED.Resultado, INSERTED.MontoActual, INSERTED.LiderUsuarioID, INSERTED.TotalPujas
          WHERE Resultado IS NULL AND FechaCierre <= @ahora ${filtroId};`
      );
      return recordset.map((x) => ({
        id: x.VehiculoID,
        resultado: x.Resultado.toLowerCase(),
        montoFinal: num(x.MontoActual),
        liderUsuarioId: x.LiderUsuarioID,
        totalPujas: x.TotalPujas
      }));
    },

    // ---------- Semilla ----------
    async eliminarVehiculosDemo() {
      await (await pool()).request().query(`DELETE FROM ${T.Vehiculos} WHERE EsDemo = 1;`);
    },

    // ---------- Transacciones ----------
    async transaccion(trabajo) {
      const p = await pool();
      for (let intento = 1; ; intento++) {
        const tx = new sql.Transaction(p);
        await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
        try {
          const resultado = await trabajo(operaciones(tx));
          await tx.commit();
          return resultado;
        } catch (err) {
          try {
            await tx.rollback();
          } catch {
            /* ya abortada por el servidor */
          }
          if (numeroErrorSql(err) === SQL.DEADLOCK && intento < 3) {
            await new Promise((res) => setTimeout(res, 80 * intento));
            continue;
          }
          throw err;
        }
      }
    }
  };
}

module.exports = { crearRepositorioSqlServer, construirWhere, ORDEN, CONDICION_ESTADO, SELECT_VEHICULO };
