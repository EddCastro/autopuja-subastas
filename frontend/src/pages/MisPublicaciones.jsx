import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Pencil, Eye, Plus, CarFront, Lock } from 'lucide-react'
import { api, aQuery, urlApi } from '../lib/api'
import { moneda } from '../lib/formato'
import { useEventoSocket } from '../context/SocketContext'
import { InsigniaDanio, InsigniaEstado } from '../components/Insignias'
import CuentaRegresiva from '../components/CuentaRegresiva'

const ESTADOS = [
  ['todas', 'Todas'],
  ['activa', 'En vivo'],
  ['proxima', 'Próximas'],
  ['cerrada', 'Cerradas'],
]

/** El publicador busca sus publicaciones y las edita. */
export default function MisPublicaciones() {
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('todas')
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)

  const cargar = useCallback(() => {
    api(`/api/vehiculos/mios${aQuery({ q: q.trim(), estado })}`)
      .then((r) => setLista(r.data))
      .catch((e) => setError(e.message))
  }, [q, estado])

  useEffect(() => {
    const t = setTimeout(cargar, 250)
    return () => clearTimeout(t)
  }, [cargar])

  useEventoSocket('puja:nueva', (e) => {
    if (lista?.some((v) => v.id === e.vehiculoId)) setLista((l) => l.map((v) => (v.id === e.vehiculoId ? { ...v, subasta: { ...v.subasta, montoActual: e.montoActual, totalPujas: e.totalPujas } } : v)))
  })
  useEventoSocket('subasta:cerrada', (e) => lista?.some((v) => v.id === e.vehiculoId) && cargar())

  return (
    <div className="contenedor" style={{ paddingBottom: 48 }}>
      <div className="pagina-cab">
        <div>
          <h1>Mis publicaciones</h1>
          <p>Busque sus vehículos publicados y edítelos.</p>
        </div>
        <Link to="/publicar" className="btn btn--primario">
          <Plus size={17} /> Publicar vehículo
        </Link>
      </div>

      <div className="panel">
        <div className="herramientas-lista">
          <div className="input-grupo">
            <Search size={16} className="input-grupo__prefijo" aria-hidden="true" />
            <input className="input" style={{ paddingLeft: 36 }} placeholder="Buscar por marca, modelo, año o motor" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar en mis publicaciones" />
          </div>
          <div className="segmentado" style={{ minWidth: 300 }} role="group" aria-label="Estado">
            {ESTADOS.map(([v, t]) => (
              <button key={v} type="button" aria-pressed={estado === v} onClick={() => setEstado(v)}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="alerta alerta--error" style={{ margin: 14 }}>{error}</div>}
        {!lista ? (
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="esqueleto" style={{ height: 76 }} />
            ))}
          </div>
        ) : !lista.length ? (
          <div className="vacio">
            <span className="vacio__icono">
              <CarFront size={26} />
            </span>
            <h3>{q || estado !== 'todas' ? 'Sin resultados' : 'Aún no ha publicado vehículos'}</h3>
            <p>{q || estado !== 'todas' ? 'Pruebe con otra búsqueda.' : 'Publique su primer vehículo para subastarlo.'}</p>
          </div>
        ) : (
          lista.map((v) => {
            const cerrada = v.subasta.estado === 'cerrada'
            return (
              <div className="fila-lista" key={v.id}>
                <div className="fila-lista__img">{v.fotoPortada && <img src={urlApi(v.fotoPortada)} alt="" loading="lazy" />}</div>
                <div className="fila-lista__info">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <h3>{v.titulo}</h3>
                    <InsigniaEstado subasta={v.subasta} />
                    <InsigniaDanio danio={v.danio} />
                  </div>
                  <div className="fila-lista__meta">
                    <span>
                      {v.subasta.totalPujas ? 'Oferta actual' : 'Precio base'}: <b className="num">{moneda(v.subasta.montoActual ?? v.subasta.precioBase)}</b>
                    </span>
                    <span>{v.subasta.totalPujas} ofertas</span>
                    <span>
                      <CuentaRegresiva subasta={v.subasta} />
                    </span>
                  </div>
                </div>
                <div className="fila-lista__acciones">
                  <Link to={`/vehiculo/${v.id}`} className="btn btn--secundario btn--sm">
                    <Eye size={15} /> Ver
                  </Link>
                  {cerrada ? (
                    <span className="btn btn--secundario btn--sm" aria-disabled="true" title="La subasta ya cerró" style={{ opacity: 0.55 }}>
                      <Lock size={14} /> Cerrada
                    </span>
                  ) : (
                    <Link to={`/editar/${v.id}`} className="btn btn--primario btn--sm">
                      <Pencil size={15} /> Editar
                    </Link>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
