'use strict';

/** Imagen SVG de respaldo (tonos claros) si no se puede descargar una foto. */
const PALETA = {
  Gris: ['#e8edf3', '#c9d3df'],
  Azul: ['#e3eefc', '#bcd4f6'],
  Negro: ['#e9eaee', '#c7cad3'],
  Blanco: ['#f5f7fa', '#dfe5ec'],
  default: ['#eef2f7', '#d5dde8']
};

function fotoPlaceholder({ titulo, color, indice, total }) {
  const [a, b] = PALETA[color] || PALETA.default;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <g transform="translate(300 250) scale(1.25)" fill="none" stroke="#5b6b82" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M40 200 L60 130 Q75 90 120 85 L360 85 Q400 90 420 130 L440 200"/>
    <rect x="20" y="200" width="440" height="90" rx="28"/>
    <circle cx="110" cy="300" r="38" fill="${b}"/><circle cx="370" cy="300" r="38" fill="${b}"/>
    <path d="M110 140 L150 110 L330 110 L370 140 Z"/>
  </g>
  <text x="600" y="690" text-anchor="middle" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#334155">${esc(titulo)}</text>
  <text x="600" y="740" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" fill="#64748b">Foto ${indice} de ${total}</text>
</svg>`;
  return { mime: 'image/svg+xml', buffer: Buffer.from(svg) };
}

module.exports = { fotoPlaceholder };
