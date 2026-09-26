'use strict';

const base = require('../db/catalogosBase');

/** Catálogos con caché en memoria (cambian muy poco). */
function crearCatalogoService(repo, { ttlMs = 5 * 60 * 1000 } = {}) {
  let cache = null;
  let vence = 0;

  async function catalogos() {
    if (!cache || Date.now() > vence) {
      cache = { ...(await repo.listarCatalogos()), cilindros: base.cilindros };
      vence = Date.now() + ttlMs;
    }
    return cache;
  }

  async function modelos(marcaId) {
    const id = Number(marcaId);
    return repo.listarModelos({ marcaId: Number.isInteger(id) && id > 0 ? id : undefined });
  }

  return { catalogos, modelos, invalidar: () => (cache = null) };
}

module.exports = { crearCatalogoService };
