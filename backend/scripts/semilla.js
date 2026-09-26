'use strict';
/** Carga usuarios y vehículos de prueba en SQL Server:  npm run db:semilla */
const config = require('../src/config');
const { cerrarPool } = require('../src/db/pool');
const { crearRepositorioSqlServer } = require('../src/repositories/sqlServerRepository');
const { crearAuthService } = require('../src/services/authService');
const { sembrar, usuariosPrueba } = require('../src/db/sembrar');

(async () => {
  console.log(`Cargando datos de prueba en ${config.db.database} @ ${config.db.server}…`);
  const repo = crearRepositorioSqlServer();
  try {
    await sembrar({ repo, authService: crearAuthService(repo, config) });
    console.log('\nUsuarios de prueba:');
    console.table(usuariosPrueba.map(({ correo, password, nombre, apellido }) => ({ usuario: `${nombre} ${apellido}`, correo, password })));
  } catch (err) {
    console.error('✖ Error al cargar datos:', err.message);
    process.exitCode = 1;
  } finally {
    await cerrarPool();
  }
})();
