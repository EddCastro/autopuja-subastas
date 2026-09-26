'use strict';
/** Crea la base de datos de pruebas (solo CI con SQL Server en contenedor). */
const sql = require('mssql');

(async () => {
  const nombre = process.env.DB_DATABASE || 'autopuja_test';
  for (let i = 1; i <= 30; i++) {
    try {
      const pool = await new sql.ConnectionPool({
        server: process.env.DB_SERVER || 'localhost',
        port: Number(process.env.DB_PORT || 1433),
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD,
        database: 'master',
        options: { encrypt: true, trustServerCertificate: true }
      }).connect();
      await pool.request().batch(`IF DB_ID(N'${nombre}') IS NULL CREATE DATABASE [${nombre}];`);
      await pool.close();
      console.log(`Base de datos ${nombre} lista.`);
      return;
    } catch (err) {
      console.log(`Esperando a SQL Server (${i}/30): ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  process.exit(1);
})();
