const fmtQ0 = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 0 })
const fmtQ2 = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtNum = new Intl.NumberFormat('es-GT')
const fmtFecha = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
const fmtFechaCorta = new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const rel = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

/** Q 20,000 (sin decimales si es entero) */
export const moneda = (n) => (n == null ? '—' : Number.isInteger(Number(n)) ? fmtQ0.format(n) : fmtQ2.format(n))
export const numero = (n) => (n == null ? '—' : fmtNum.format(n))
export const fecha = (f) => (f ? fmtFecha.format(new Date(f)) : '—')
export const fechaCorta = (f) => (f ? fmtFechaCorta.format(new Date(f)) : '—')

export function haceCuanto(f, ahora = Date.now()) {
  const seg = Math.round((new Date(f).getTime() - ahora) / 1000)
  const abs = Math.abs(seg)
  if (abs < 60) return rel.format(Math.round(seg), 'second')
  if (abs < 3600) return rel.format(Math.round(seg / 60), 'minute')
  if (abs < 86400) return rel.format(Math.round(seg / 3600), 'hour')
  return rel.format(Math.round(seg / 86400), 'day')
}

/** Descompone milisegundos en días/horas/minutos/segundos. */
export function partesTiempo(ms) {
  const t = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60, total: ms }
}

const dos = (n) => String(n).padStart(2, '0')
export function textoTiempo(ms) {
  const { d, h, m, s } = partesTiempo(ms)
  if (d > 0) return `${d}d ${dos(h)}h ${dos(m)}m`
  if (h > 0) return `${dos(h)}h ${dos(m)}m ${dos(s)}s`
  return `${dos(m)}m ${dos(s)}s`
}

/** Fecha → valor para <input type="datetime-local"> en hora local. */
export function aInputLocal(f) {
  const d = new Date(f)
  if (Number.isNaN(d.getTime())) return ''
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 16)
}
export const deInputLocal = (v) => (v ? new Date(v).toISOString() : '')

export const ESTADOS_SUBASTA = {
  activa: { texto: 'En vivo', clase: 'activa' },
  proxima: { texto: 'Próximamente', clase: 'proxima' },
  cerrada: { texto: 'Cerrada', clase: 'cerrada' },
}
