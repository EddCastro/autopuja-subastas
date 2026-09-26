/**
 * Cliente HTTP de la API (consumo asíncrono con fetch).
 * - Agrega el token JWT si hay sesión.
 * - Sincroniza el reloj con la hora del servidor (encabezado X-Hora-Servidor).
 * - Normaliza los errores: { status, codigo, mensaje, detalles }.
 */
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

let token = null
let alExpirarSesion = () => {}
let alRecibirHora = () => {}

export const configurarApi = ({ obtenerToken, onSesionExpirada, onHora }) => {
  if (obtenerToken !== undefined) token = obtenerToken
  if (onSesionExpirada) alExpirarSesion = onSesionExpirada
  if (onHora) alRecibirHora = onHora
}
export const fijarToken = (t) => (token = t)

/** Convierte "/api/fotos/5" en URL absoluta del backend. */
export const urlApi = (ruta) => (!ruta ? null : /^https?:/.test(ruta) ? ruta : `${API_URL}${ruta}`)

export class ErrorApi extends Error {
  constructor({ status, codigo, mensaje, detalles }) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
    this.detalles = detalles
  }
  /** { campo: mensaje } para mostrar junto a cada input. */
  get porCampo() {
    const m = {}
    if (Array.isArray(this.detalles)) for (const d of this.detalles) m[d.campo] ??= d.mensaje
    return m
  }
}

async function procesar(res, inicio) {
  const hora = Number(res.headers.get('X-Hora-Servidor'))
  if (hora) alRecibirHora(hora, (performance.now() - inicio) / 2)
  let cuerpo = null
  try {
    cuerpo = await res.json()
  } catch {
    cuerpo = null
  }
  if (!res.ok) {
    const e = cuerpo?.error || {}
    if (res.status === 401 && token && e.codigo === 'NO_AUTENTICADO') alExpirarSesion(e.mensaje)
    throw new ErrorApi({
      status: res.status,
      codigo: e.codigo || 'ERROR',
      mensaje: e.mensaje || `Error ${res.status}`,
      detalles: e.detalles,
    })
  }
  return cuerpo
}

export async function api(ruta, { metodo = 'GET', cuerpo, senal } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (cuerpo !== undefined && !(cuerpo instanceof FormData)) headers['Content-Type'] = 'application/json'
  const inicio = performance.now()
  let res
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : cuerpo instanceof FormData ? cuerpo : JSON.stringify(cuerpo),
      signal: senal,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ErrorApi({ status: 0, codigo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo.' })
  }
  return procesar(res, inicio)
}

/** Envío multipart con progreso (XMLHttpRequest) para subir fotografías. */
export function enviarFormulario(ruta, formData, { metodo = 'POST', onProgreso } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(metodo, `${API_URL}${ruta}`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgreso?.(Math.round((e.loaded / e.total) * 100))
    xhr.onerror = () => reject(new ErrorApi({ status: 0, codigo: 'SIN_CONEXION', mensaje: 'No se pudo conectar con el servidor.' }))
    xhr.onload = () => {
      let cuerpo = null
      try {
        cuerpo = JSON.parse(xhr.responseText)
      } catch {
        /* vacío */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(cuerpo)
      const e = cuerpo?.error || {}
      reject(new ErrorApi({ status: xhr.status, codigo: e.codigo || 'ERROR', mensaje: e.mensaje || `Error ${xhr.status}`, detalles: e.detalles }))
    }
    xhr.send(formData)
  })
}

/** Convierte un objeto de filtros en query string (omite vacíos). */
export function aQuery(obj) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue
    p.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}
