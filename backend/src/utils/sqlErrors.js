'use strict';

/** Número de error nativo de SQL Server (2627, 547, 1205, …) si existe. */
function numeroErrorSql(err) {
  return err?.number ?? err?.originalError?.number ?? err?.originalError?.info?.number ?? null;
}

const CODIGOS_CONEXION = new Set(['ECONFIG', 'ELOGIN', 'ESOCKET', 'ETIMEOUT', 'ECONNCLOSED', 'ENOTOPEN', 'EINSTLOOKUP', 'ECONNREFUSED', 'ENOTFOUND']);

const esErrorDeConexion = (err) => CODIGOS_CONEXION.has(err?.code) || CODIGOS_CONEXION.has(err?.originalError?.code);

module.exports = {
  numeroErrorSql,
  esErrorDeConexion,
  SQL: { UNIQUE_CONSTRAINT: 2627, UNIQUE_INDEX: 2601, FOREIGN_KEY: 547, CHECK: 547, DEADLOCK: 1205 }
};
