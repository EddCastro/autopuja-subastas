'use strict';
/** Crea/actualiza las tablas y catálogos en SQL Server:  npm run db:migrar */
const config = require('../src/config');
const { getPool, cerrarPool } = require('../src/db/pool');
const { migrar } = require('../src/db/migrar');

(async () => {
  console.log(`Migrando ${config.db.database} @ ${config.db.server}${config.db.prefijo ? ` (prefijo ${config.db.prefijo})` : ''}…`);
  try {
    await migrar(await getPool());
    console.log('Migración completa.');
  } catch (err) {
    console.error('✖ Error en la migración:', err.message);
    process.exitCode = 1;
  } finally {
    await cerrarPool();
  }
})();
