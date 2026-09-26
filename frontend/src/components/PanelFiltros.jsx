import { useEffect, useMemo, useState } from 'react'
import { RotateCcw, X, Search } from 'lucide-react'
import { api } from '../lib/api'

const COLOR = { VERDE: 'var(--danio-verde)', AMARILLO: 'var(--danio-amarillo)', ROJO: 'var(--danio-rojo)' }
const ESTADOS = [
  ['disponibles', 'Vigentes'],
  ['activa', 'En vivo'],
  ['proxima', 'Próximas'],
  ['cerrada', 'Cerradas'],
  ['todas', 'Todas'],
]

const alternar = (lista, valor) => (lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor])

function Opciones({ items, seleccion, onCambio, etiqueta = (x) => x.nombre, valor = (x) => x.id }) {
  return (
    <div className="opciones">
      {items.map((it) => {
        const v = valor(it)
        return (
          <button type="button" key={v} className="opcion" aria-pressed={seleccion.includes(v)} onClick={() => onCambio(alternar(seleccion, v))}>
            {etiqueta(it)}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Filtros multitarea: todos se combinan entre sí (AND) y se aplican en el
 * servidor. Cubre todas las propiedades de la ficha técnica.
 */
export default function PanelFiltros({ filtros: f, cambiar, limpiar, catalogos: c, abierto, cerrar, totalActivos }) {
  const [buscaMarca, setBuscaMarca] = useState('')
  const [modelos, setModelos] = useState([])
  const marcaUnica = f.marca.length === 1 ? f.marca[0] : null

  useEffect(() => {
    let vivo = true
    api(`/api/catalogos/modelos${marcaUnica ? `?marcaId=${marcaUnica}` : ''}`)
      .then((r) => vivo && setModelos(r.data))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [marcaUnica])

  const marcas = useMemo(() => {
    const q = buscaMarca.trim().toLowerCase()
    const lista = c?.marcas || []
    const filtradas = q ? lista.filter((m) => m.nombre.toLowerCase().includes(q)) : lista
    // Las seleccionadas primero
    return [...filtradas.filter((m) => f.marca.includes(m.id)), ...filtradas.filter((m) => !f.marca.includes(m.id))]
  }, [c, buscaMarca, f.marca])

  if (!c) return null
  const anioMax = new Date().getFullYear() + 1

  return (
    <>
      {abierto && <div className="velo" onClick={cerrar} aria-hidden="true" />}
      <aside className={`panel filtros ${abierto ? 'abierto' : ''}`} aria-label="Filtros del inventario">
        <div className="filtros__cab">
          <strong>Filtros {totalActivos > 0 && <span className="tenue">({totalActivos})</span>}</strong>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" className="btn btn--fantasma btn--sm" onClick={limpiar} disabled={!totalActivos}>
              <RotateCcw size={14} /> Limpiar
            </button>
            <button type="button" className="btn btn--fantasma btn--sm boton-filtros-movil" onClick={cerrar} aria-label="Cerrar filtros">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="filtros__cuerpo">
          <div className="filtro">
            <span className="filtro__titulo">Estado de la subasta</span>
            <div className="opciones" role="group" aria-label="Estado de la subasta">
              {ESTADOS.map(([v, t]) => (
                <button type="button" key={v} className="opcion" aria-pressed={f.estado === v} onClick={() => cambiar({ estado: v })}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="filtro">
            <span className="filtro__titulo">Nivel de daño</span>
            <div className="opciones">
              {c.nivelesDanio.map((d) => (
                <button
                  type="button"
                  key={d.codigo}
                  className="opcion opcion--danio"
                  style={{ '--c': COLOR[d.codigo] }}
                  aria-pressed={f.danio.includes(d.codigo.toLowerCase())}
                  onClick={() => cambiar({ danio: alternar(f.danio, d.codigo.toLowerCase()) })}
                  title={d.descripcion}
                >
                  <span className="punto" aria-hidden="true" /> {d.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className="filtro">
            <span className="filtro__titulo">Marca</span>
            <div className="input-grupo">
              <Search size={14} className="input-grupo__prefijo" aria-hidden="true" />
              <input className="input" placeholder="Buscar marca" value={buscaMarca} onChange={(e) => setBuscaMarca(e.target.value)} aria-label="Buscar marca" />
            </div>
            <div className="lista-marcas">
              {marcas.map((m) => (
                <label className="check" key={m.id}>
                  <input type="checkbox" checked={f.marca.includes(m.id)} onChange={() => cambiar({ marca: alternar(f.marca, m.id) })} />
                  {m.nombre}
                </label>
              ))}
            </div>
          </div>

          <div className="filtro">
            <label className="filtro__titulo" htmlFor="f-modelo">Modelo</label>
            <input id="f-modelo" className="input" list="lista-modelos" placeholder="Ej. Civic, F-150…" value={f.modelo} onChange={(e) => cambiar({ modelo: e.target.value })} />
            <datalist id="lista-modelos">
              {modelos.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          <div className="filtro">
            <span className="filtro__titulo">Año</span>
            <div className="filtro__fila">
              <input className="input" type="number" min="1950" max={anioMax} placeholder="Desde" value={f.anioMin} onChange={(e) => cambiar({ anioMin: e.target.value })} aria-label="Año desde" />
              <input className="input" type="number" min="1950" max={anioMax} placeholder="Hasta" value={f.anioMax} onChange={(e) => cambiar({ anioMax: e.target.value })} aria-label="Año hasta" />
            </div>
          </div>

          <div className="filtro">
            <span className="filtro__titulo">Precio (Q)</span>
            <div className="filtro__fila">
              <input className="input" type="number" min="0" step="1000" placeholder="Mínimo" value={f.precioMin} onChange={(e) => cambiar({ precioMin: e.target.value })} aria-label="Precio mínimo" />
              <input className="input" type="number" min="0" step="1000" placeholder="Máximo" value={f.precioMax} onChange={(e) => cambiar({ precioMax: e.target.value })} aria-label="Precio máximo" />
            </div>
          </div>

          <div className="filtro">
            <span className="filtro__titulo">Tipo de artículo</span>
            <Opciones items={c.tiposArticulo} seleccion={f.tipo} onCambio={(v) => cambiar({ tipo: v })} />
          </div>

          <div className="filtro">
            <span className="filtro__titulo">Combustible</span>
            <Opciones items={c.combustibles} seleccion={f.combustible} onCambio={(v) => cambiar({ combustible: v })} />
          </div>

          <div className="filtro">
            <span className="filtro__titulo">Transmisión</span>
            <Opciones items={c.transmisiones} seleccion={f.transmision} onCambio={(v) => cambiar({ transmision: v })} />
          </div>

          <div className="filtro">
            <span className="filtro__titulo">Tren de manejo</span>
            <Opciones items={c.trenesManejo} seleccion={f.tren} etiqueta={(t) => <span title={t.descripcion}>{t.codigo}</span>} onCambio={(v) => cambiar({ tren: v })} />
          </div>

          <div className="filtro">
            <span className="filtro__titulo">Cilindros</span>
            <Opciones
              items={c.cilindros.map((n) => ({ id: n, nombre: n === 0 ? 'Eléctrico (0)' : String(n) }))}
              seleccion={f.cilindros}
              onCambio={(v) => cambiar({ cilindros: v })}
            />
          </div>
        </div>
      </aside>
    </>
  )
}
