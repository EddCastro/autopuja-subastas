/** Estado de los filtros ⇄ parámetros de la URL (los filtros se pueden compartir por enlace). */
export const FILTROS_VACIOS = {
  q: '',
  estado: 'disponibles',
  danio: [],
  marca: [],
  modelo: '',
  anioMin: '',
  anioMax: '',
  tipo: [],
  combustible: [],
  transmision: [],
  tren: [],
  cilindros: [],
  precioMin: '',
  precioMax: '',
  orden: 'cierre',
  pagina: 1,
}

const LISTAS_NUM = ['marca', 'tipo', 'combustible', 'transmision', 'tren', 'cilindros']

export function leerFiltros(sp) {
  const f = { ...FILTROS_VACIOS }
  for (const k of Object.keys(FILTROS_VACIOS)) {
    const v = sp.get(k)
    if (v === null) continue
    if (LISTAS_NUM.includes(k)) f[k] = v.split(',').map(Number).filter((n) => Number.isInteger(n))
    else if (k === 'danio') f[k] = v.split(',').filter((x) => ['verde', 'amarillo', 'rojo'].includes(x))
    else if (k === 'pagina') f[k] = Math.max(1, Number(v) || 1)
    else f[k] = v
  }
  return f
}

export function aParametros(f) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) {
    if (Array.isArray(v) ? !v.length : v === '' || v === FILTROS_VACIOS[k]) continue
    sp.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  return sp
}

/** Cantidad de filtros activos (sin contar orden ni página). */
export function contarActivos(f) {
  let n = 0
  for (const k of Object.keys(FILTROS_VACIOS)) {
    if (['orden', 'pagina'].includes(k)) continue
    const v = f[k]
    if (Array.isArray(v) ? v.length : v !== '' && v !== FILTROS_VACIOS[k]) n += Array.isArray(v) ? v.length : 1
  }
  return n
}

/** Parámetros para la API (el estado "todas" = sin filtro). */
export function aConsultaApi(f, tamano = 12) {
  const { pagina, ...resto } = f
  return { ...resto, pagina, tamano }
}
