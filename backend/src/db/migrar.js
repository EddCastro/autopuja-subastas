'use strict';

/**
 * Crea las tablas que falten e inserta/actualiza los catálogos base.
 * Es seguro ejecutarlo varias veces.
 */
const { sql } = require('./pool');
const { T, sentenciasEsquema } = require('./esquema');
const base = require('./catalogosBase');

async function migrar(pool, { log = console.log } = {}) {
  for (const ddl of sentenciasEsquema()) {
    await pool.request().batch(ddl);
  }
  log('  ✔ Tablas e índices verificados');

  const simples = [
    [T.TiposArticulo, base.tiposArticulo, 50],
    [T.Marcas, base.marcas, 50],
    [T.Combustibles, base.combustibles, 40],
    [T.Transmisiones, base.transmisiones, 40]
  ];
  for (const [tabla, valores, largo] of simples) {
    for (const nombre of valores) {
      await pool
        .request()
        .input('nombre', sql.NVarChar(largo), nombre)
        .query(`IF NOT EXISTS (SELECT 1 FROM ${tabla} WHERE Nombre = @nombre) INSERT INTO ${tabla} (Nombre) VALUES (@nombre);`);
    }
  }

  for (const t of base.trenesManejo) {
    await pool
      .request()
      .input('codigo', sql.VarChar(5), t.codigo)
      .input('descripcion', sql.NVarChar(60), t.descripcion)
      .query(
        `IF EXISTS (SELECT 1 FROM ${T.TrenesManejo} WHERE Codigo = @codigo)
         BEGIN
           UPDATE ${T.TrenesManejo} SET Descripcion = @descripcion WHERE Codigo = @codigo;
         END
         ELSE
         BEGIN
           INSERT INTO ${T.TrenesManejo} (Codigo, Descripcion) VALUES (@codigo, @descripcion);
         END`
      );
  }

  for (const d of base.nivelesDanio) {
    await pool
      .request()
      .input('codigo', sql.VarChar(10), d.codigo)
      .input('nombre', sql.NVarChar(20), d.nombre)
      .input('descripcion', sql.NVarChar(60), d.descripcion)
      .input('color', sql.Char(7), d.color)
      .input('orden', sql.TinyInt, d.orden)
      .query(
        `IF EXISTS (SELECT 1 FROM ${T.NivelesDanio} WHERE Codigo = @codigo)
         BEGIN
           UPDATE ${T.NivelesDanio} SET Nombre = @nombre, Descripcion = @descripcion, ColorHex = @color, Orden = @orden WHERE Codigo = @codigo;
         END
         ELSE
         BEGIN
           INSERT INTO ${T.NivelesDanio} (Codigo, Nombre, Descripcion, ColorHex, Orden) VALUES (@codigo, @nombre, @descripcion, @color, @orden);
         END`
      );
  }
  log('  ✔ Catálogos cargados');
}

module.exports = { migrar };
