import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { urlApi } from '../lib/api'

/**
 * Carrusel interactivo: flechas, miniaturas, teclado (← →), deslizamiento
 * táctil y visor a pantalla completa (Esc para cerrar).
 */
export default function Carrusel({ fotos = [], titulo }) {
  const [i, setI] = useState(0)
  const [visor, setVisor] = useState(false)
  const toque = useRef(null)
  const miniaturas = useRef(null)
  const total = fotos.length

  const ir = useCallback((n) => setI(((n % total) + total) % total), [total])
  const anterior = useCallback(() => ir(i - 1), [i, ir])
  const siguiente = useCallback(() => ir(i + 1), [i, ir])

  useEffect(() => {
    if (i >= total) setI(0)
  }, [total, i])

  useEffect(() => {
    miniaturas.current?.children[i]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [i])

  useEffect(() => {
    if (!visor) return
    const teclas = (e) => {
      if (e.key === 'Escape') setVisor(false)
      if (e.key === 'ArrowLeft') anterior()
      if (e.key === 'ArrowRight') siguiente()
    }
    document.addEventListener('keydown', teclas)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', teclas)
      document.body.style.overflow = ''
    }
  }, [visor, anterior, siguiente])

  if (!total) return <div className="carrusel__marco esqueleto" />

  const alTocar = (e) => (toque.current = e.touches[0].clientX)
  const alSoltar = (e) => {
    if (toque.current == null) return
    const dx = e.changedTouches[0].clientX - toque.current
    if (Math.abs(dx) > 40) (dx > 0 ? anterior : siguiente)()
    toque.current = null
  }
  const foto = fotos[i]

  return (
    <div className="carrusel" aria-roledescription="carrusel" aria-label={`Fotografías de ${titulo}`}>
      <div
        className="carrusel__marco"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') anterior()
          if (e.key === 'ArrowRight') siguiente()
          if (e.key === 'Enter') setVisor(true)
        }}
        onTouchStart={alTocar}
        onTouchEnd={alSoltar}
      >
        <img src={urlApi(foto.url)} alt={`${titulo} — foto ${i + 1} de ${total}`} onClick={() => setVisor(true)} draggable="false" />
        {total > 1 && (
          <>
            <button type="button" className="carrusel__flecha carrusel__flecha--izq" onClick={anterior} aria-label="Foto anterior">
              <ChevronLeft size={22} />
            </button>
            <button type="button" className="carrusel__flecha carrusel__flecha--der" onClick={siguiente} aria-label="Foto siguiente">
              <ChevronRight size={22} />
            </button>
          </>
        )}
        <span className="carrusel__contador" aria-live="polite">
          {i + 1} / {total}
        </span>
        <button type="button" className="btn btn--secundario btn--sm carrusel__ampliar" onClick={() => setVisor(true)}>
          <Maximize2 size={14} /> Ampliar
        </button>
      </div>

      <div className="carrusel__miniaturas" ref={miniaturas}>
        {fotos.map((f, n) => (
          <button type="button" key={f.id} className="miniatura" aria-current={n === i} aria-label={`Ver foto ${n + 1}`} onClick={() => setI(n)}>
            <img src={urlApi(f.url)} alt="" />
          </button>
        ))}
      </div>

      {visor && (
        <div className="visor" role="dialog" aria-modal="true" aria-label="Visor de fotografías" onTouchStart={alTocar} onTouchEnd={alSoltar}>
          <div className="visor__barra">
            <strong>
              {titulo} · {i + 1} / {total}
            </strong>
            <button type="button" className="btn btn--secundario btn--sm" onClick={() => setVisor(false)} autoFocus>
              <X size={16} /> Cerrar
            </button>
          </div>
          <div className="visor__img">
            <img src={urlApi(foto.url)} alt={`${titulo} — foto ${i + 1}`} />
            {total > 1 && (
              <>
                <button type="button" className="carrusel__flecha carrusel__flecha--izq" onClick={anterior} aria-label="Foto anterior">
                  <ChevronLeft size={22} />
                </button>
                <button type="button" className="carrusel__flecha carrusel__flecha--der" onClick={siguiente} aria-label="Foto siguiente">
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>
          <div className="carrusel__miniaturas" style={{ justifyContent: 'center' }}>
            {fotos.map((f, n) => (
              <button type="button" key={f.id} className="miniatura" aria-current={n === i} onClick={() => setI(n)} aria-label={`Ver foto ${n + 1}`}>
                <img src={urlApi(f.url)} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
