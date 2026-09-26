import { useEffect, useRef } from 'react'
import { Clock, Timer } from 'lucide-react'
import { useAhora } from '../lib/reloj'
import { partesTiempo, textoTiempo } from '../lib/formato'

const URGENTE_MS = 5 * 60 * 1000

/** Fase según la hora del servidor: antes del inicio, en curso o finalizada. */
export function faseSubasta(subasta, ahora) {
  if (!subasta) return 'cerrada'
  if (subasta.resultado || subasta.estado === 'cerrada') return 'cerrada'
  if (ahora < new Date(subasta.fechaInicio).getTime()) return 'proxima'
  if (ahora >= new Date(subasta.fechaCierre).getTime()) return 'cerrada'
  return 'activa'
}

/**
 * Temporizador en tiempo real sincronizado con el reloj del servidor.
 * `onCambioFase` avisa cuando la subasta inicia o termina (sin recargar).
 */
export default function CuentaRegresiva({ subasta, variante = 'compacta', onCambioFase }) {
  const ahora = useAhora()
  const fase = faseSubasta(subasta, ahora)
  const fasePrevia = useRef(fase)

  useEffect(() => {
    if (fasePrevia.current !== fase) {
      fasePrevia.current = fase
      onCambioFase?.(fase)
    }
  }, [fase, onCambioFase])

  if (fase === 'cerrada') {
    if (variante === 'grande') return null
    if (variante === 'tarjeta') {
      return (
        <>
          <div className="precio__etiqueta">Subasta</div>
          <span className="tenue" style={{ fontWeight: 700 }}>Finalizada</span>
        </>
      )
    }
    return <span className="tenue">Finalizada</span>
  }
  const objetivo = new Date(fase === 'proxima' ? subasta.fechaInicio : subasta.fechaCierre).getTime()
  const restante = objetivo - ahora
  const urgente = fase === 'activa' && restante <= URGENTE_MS

  if (variante === 'grande') {
    const { d, h, m, s } = partesTiempo(restante)
    const dos = (n) => String(n).padStart(2, '0')
    return (
      <div>
        <div className="reloj__etiqueta">
          <Timer size={16} aria-hidden="true" /> {fase === 'proxima' ? 'La subasta inicia en' : 'La subasta termina en'}
        </div>
        <div className={`reloj ${urgente ? 'reloj--urgente' : ''}`} role="timer" aria-live="off" aria-label={textoTiempo(restante)}>
          {[
            [d, 'días'],
            [dos(h), 'horas'],
            [dos(m), 'min'],
            [dos(s), 'seg'],
          ].map(([v, u]) => (
            <div className="reloj__unidad" key={u}>
              <b>{v}</b>
              <span>{u}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (variante === 'tarjeta') {
    return (
      <>
        <div className="precio__etiqueta">{fase === 'proxima' ? 'Inicia en' : 'Cierra en'}</div>
        <span className="num" style={{ color: urgente ? 'var(--bad)' : undefined, fontWeight: 800, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <Clock size={14} aria-hidden="true" />
          {textoTiempo(restante)}
        </span>
      </>
    )
  }

  return (
    <span className="num" style={{ color: urgente ? 'var(--bad)' : undefined, fontWeight: 700, display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <Clock size={14} aria-hidden="true" />
      {fase === 'proxima' ? `Inicia en ${textoTiempo(restante)}` : textoTiempo(restante)}
    </span>
  )
}
