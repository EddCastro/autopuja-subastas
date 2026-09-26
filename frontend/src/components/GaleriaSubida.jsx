import { useEffect, useRef, useState } from 'react'
import { ImagePlus, ChevronLeft, ChevronRight, Trash2, Star } from 'lucide-react'
import { urlApi } from '../lib/api'
import { esImagenValida } from '../lib/imagenes'

export const MIN_FOTOS = 5
export const MAX_FOTOS = 12
const MAX_MB = 25

let contador = 0
export const fotoNueva = (file) => ({ clave: `n${++contador}`, tipo: 'nueva', file, vista: URL.createObjectURL(file) })
export const fotoExistente = (f) => ({ clave: `e${f.id}`, tipo: 'existente', id: f.id, vista: urlApi(f.url) })

/** Galería: arrastrar y soltar, vista previa, reordenar, portada y mínimo 5 fotos. */
export default function GaleriaSubida({ fotos, setFotos, error, deshabilitado = false }) {
  const input = useRef(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [aviso, setAviso] = useState(null)

  useEffect(
    () => () => fotos.forEach((f) => f.tipo === 'nueva' && URL.revokeObjectURL(f.vista)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const agregar = (lista) => {
    setAviso(null)
    const archivos = [...lista]
    const validos = archivos.filter((f) => esImagenValida(f) && f.size <= MAX_MB * 1024 * 1024)
    const rechazados = archivos.length - validos.length
    const espacio = MAX_FOTOS - fotos.length
    if (rechazados) setAviso(`${rechazados} archivo(s) no son imágenes JPG/PNG/WEBP válidas y se omitieron.`)
    if (validos.length > espacio) setAviso(`Máximo ${MAX_FOTOS} fotografías: se agregaron ${Math.max(0, espacio)}.`)
    setFotos((f) => [...f, ...validos.slice(0, Math.max(0, espacio)).map(fotoNueva)])
  }

  const mover = (i, d) =>
    setFotos((f) => {
      const j = i + d
      if (j < 0 || j >= f.length) return f
      const c = [...f]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })
  const portada = (i) => setFotos((f) => [f[i], ...f.filter((_, k) => k !== i)])
  const quitar = (i) =>
    setFotos((f) => {
      if (f[i].tipo === 'nueva') URL.revokeObjectURL(f[i].vista)
      return f.filter((_, k) => k !== i)
    })

  const faltan = Math.max(0, MIN_FOTOS - fotos.length)

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div
        className={`zona-fotos ${arrastrando ? 'zona-fotos--activa' : ''}`}
        role="button"
        tabIndex={0}
        aria-disabled={deshabilitado}
        onClick={() => !deshabilitado && input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          if (!deshabilitado) agregar(e.dataTransfer.files)
        }}
      >
        <span className="zona-fotos__icono">
          <ImagePlus size={24} />
        </span>
        <strong>Arrastre las fotos aquí o haga clic para seleccionarlas</strong>
        <span className="tenue" style={{ fontSize: '0.84rem' }}>
          JPG, PNG o WEBP · mínimo {MIN_FOTOS}, máximo {MAX_FOTOS} · se optimizan automáticamente
        </span>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => (agregar(e.target.files), (e.target.value = ''))} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span className="contador-fotos" style={{ color: faltan ? 'var(--bad)' : 'var(--ok)' }}>
          {fotos.length} / {MAX_FOTOS} fotos {faltan ? `· faltan ${faltan} para el mínimo` : '· galería completa ✓'}
        </span>
        {fotos.length > 1 && <span className="tenue" style={{ fontSize: '0.8rem' }}>La primera foto es la portada del anuncio.</span>}
      </div>
      {aviso && <div className="alerta alerta--warn">{aviso}</div>}
      {error && <div className="campo__error" role="alert">{error}</div>}

      {fotos.length > 0 && (
        <div className="previas">
          {fotos.map((f, i) => (
            <div className="previa" key={f.clave}>
              <img src={f.vista} alt={`Foto ${i + 1}`} />
              <span className="previa__num">{i + 1}</span>
              {i === 0 && <span className="previa__portada">Portada</span>}
              <div className="previa__acciones">
                {i > 0 && (
                  <button type="button" onClick={() => portada(i)} title="Usar como portada" aria-label={`Usar foto ${i + 1} como portada`}>
                    <Star size={14} />
                  </button>
                )}
                <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} title="Mover a la izquierda" aria-label={`Mover foto ${i + 1} a la izquierda`}>
                  <ChevronLeft size={14} />
                </button>
                <button type="button" onClick={() => mover(i, 1)} disabled={i === fotos.length - 1} title="Mover a la derecha" aria-label={`Mover foto ${i + 1} a la derecha`}>
                  <ChevronRight size={14} />
                </button>
                <button type="button" className="borrar" onClick={() => quitar(i)} title="Quitar" aria-label={`Quitar foto ${i + 1}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
