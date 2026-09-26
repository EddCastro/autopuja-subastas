'use strict';

const config = require('./config');
const { crearServidor } = require('./servidor');
const { crearRepositorioSqlServer } = require('./repositories/sqlServerRepository');
const { cerrarPool, getPool } = require('./db/pool');
const { migrar } = require('./db/migrar');

const { servidor, programador, cerrar } = crearServidor({ repo: crearRepositorioSqlServer(), config });

servidor.listen(config.port, () => {
  console.log(`AutoPuja API escuchando en http://localhost:${config.port}/api`);
  if (!config.db.configurada) console.warn('⚠ Variables de BD incompletas: copie .env.example a .env y complételo.');
  else console.log(`  Base de datos: ${config.db.database} @ ${config.db.server}`);
  prepararBd().finally(() => programador.iniciar());
});

/** Crea tablas/catálogos que falten (idempotente). Desactivable con AUTO_MIGRAR=false. */
async function prepararBd() {
  if (!config.db.configurada || process.env.AUTO_MIGRAR === 'false') return;
  try {
    await migrar(await getPool(), { log: () => {} });
    console.log('  ✔ Esquema de base de datos verificado');
  } catch (err) {
    console.warn(`  ⚠ No se pudo verificar el esquema: ${err.message}`);
  }
}

async function apagar(senal) {
  console.log(`\n${senal}: cerrando…`);
  setTimeout(() => process.exit(1), 10_000).unref();
  await cerrar();
  await cerrarPool();
  process.exit(0);
}
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
