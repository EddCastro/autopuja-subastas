import { CircleCheck, CircleAlert, Trophy, CircleX } from 'lucide-react'
import { ESTADOS_SUBASTA, moneda } from '../lib/formato'

const COLOR_DANIO = { VERDE: 'var(--danio-verde)', AMARILLO: 'var(--danio-amarillo)', ROJO: 'var(--danio-rojo)' }

/** Nivel de daño con su color (● Verde / ● Amarillo / ● Rojo) y texto (nunca solo color). */
export function InsigniaDanio({ danio, completa = false }) {
  if (!danio) return null
  return (
    <span className="insignia insignia--danio" style={{ '--c': COLOR_DANIO[danio.codigo] || danio.color }} title={`${danio.nombre}: ${danio.descripcion}`}>
      <span className="punto" aria-hidden="true" />
      {completa ? `${danio.nombre} · ${danio.descripcion}` : danio.descripcion.split(' / ')[0]}
    </span>
  )
}

export function InsigniaEstado({ subasta }) {
  if (!subasta) return null
  if (subasta.estado === 'cerrada') {
    return subasta.resultado === 'vendida' ? (
      <span className="insignia insignia--vendida">Vendida</span>
    ) : (
      <span className="insignia insignia--cerrada">{subasta.resultado === 'desierta' ? 'Desierta · no vendida' : 'Oferta cerrada'}</span>
    )
  }
  const e = ESTADOS_SUBASTA[subasta.estado]
  return <span className={`insignia insignia--${e.clase}`}>{e.texto}</span>
}

const TEXTOS = {
  ganando: { icono: CircleCheck, titulo: '¡Vas ganando esta subasta!', sub: 'Tienes la oferta más alta en este momento.' },
  superado: { icono: CircleAlert, titulo: 'Tu oferta ha sido superada.', sub: '¡Haz tu oferta ahora antes de que termine el tiempo!' },
  ganada: { icono: Trophy, titulo: '¡Ganaste esta subasta!', sub: 'Tu oferta fue la más alta al cierre.' },
  perdida: { icono: CircleX, titulo: 'No ganaste esta subasta.', sub: 'Otro postor hizo una oferta mayor.' },
}

/** Indicador visual del estado de MI puja (verde: ganando · rojo: superado). */
export function EstadoPuja({ estado, monto, compacto = false }) {
  const t = TEXTOS[estado]
  if (!t) return null
  const Icono = t.icono
  if (compacto) {
    return (
      <span className={`insignia estado-mini estado-mini--${estado}`} style={estiloMini[estado]}>
        <Icono size={14} aria-hidden="true" /> {t.titulo.replace(/[¡!.]/g, '')}
      </span>
    )
  }
  return (
    <div className={`estado-puja estado-puja--${estado}`} role="status" aria-live="assertive">
      <Icono size={24} aria-hidden="true" />
      <div>
        {t.titulo}
        <small>{monto != null && estado === 'superado' ? `Oferta actual: ${moneda(monto)}. ${t.sub}` : t.sub}</small>
      </div>
    </div>
  )
}

const estiloMini = {
  ganando: { background: 'var(--ok-bg)', color: 'var(--ok)', borderColor: 'var(--ok-borde)' },
  ganada: { background: 'var(--ok-bg)', color: 'var(--ok)', borderColor: 'var(--ok-borde)' },
  superado: { background: 'var(--bad-bg)', color: 'var(--bad)', borderColor: 'var(--bad-borde)' },
  perdida: { background: 'var(--bg-2)', color: 'var(--text-2)', borderColor: 'var(--border-2)' },
}
