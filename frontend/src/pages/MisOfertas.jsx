import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gavel, Eye } from 'lucide-react'
import { api, urlApi } from '../lib/api'
import { moneda } from '../lib/formato'
import { useEventoSocket } from '../context/SocketContext'
import { EstadoPuja, InsigniaEstado } from '../components/Insignias'
import CuentaRegresiva from '../components/CuentaRegresiva'

/** Subastas en las que el usuario participa, con su indicador en vivo. */
export default function MisOfertas() {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const cargar = useCallback(() => api('/api/pujas/mias').then((r) => setLista(r.data)).catch((e) => setError(e.message)), [])
  useEffect(() => {
    cargar()
  }, [cargar])

  useEventoSocket('puja:nueva', (e) => {
    if (lista?.some((v) => v.id === e.vehiculoId)) setLista((l) => l.map((v) => (v.id === e.vehiculoId ? { ...v, subasta: { ...v.subasta, montoActual: e.montoActual, totalPujas: e.totalPujas } } : v)))
  })
  useEventoSocket('puja:estado', (e) => setLista((l) => l && l.map((v) => (v.id === e.vehiculoId ? { ...v, miEstado: e.estado } : v))))
  useEventoSocket('subasta:cerrada', (e) => lista?.some((v) => v.id === e.vehiculoId) && cargar())

  return (
    <div className="contenedor" style={{ paddingBottom: 48 }}>
      <div className="pagina-cab">
        <div>
          <h1>Mis ofertas</h1>
          <p>Subastas en las que participa. Los indicadores se actualizan en tiempo real.</p>
        </div>
      </div>
      <div className="panel">
        {error && <div className="alerta alerta--error" style={{ margin: 14 }}>{error}</div>}
        {!lista ? (
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            {[1, 2].map((i) => (
              <div key={i} className="esqueleto" style={{ height: 76 }} />
            ))}
          </div>
        ) : !lista.length ? (
          <div className="vacio">
            <span className="vacio__icono">
              <Gavel size={26} />
            </span>
            <h3>Aún no ha ofertado</h3>
            <p>Explore el inventario y haga su primera oferta.</p>
            <Link className="btn btn--primario" to="/">
              Ver inventario
            </Link>
          </div>
        ) : (
          lista.map((v) => (
            <div className="fila-lista" key={v.id}>
              <div className="fila-lista__img">{v.fotoPortada && <img src={urlApi(v.fotoPortada)} alt="" loading="lazy" />}</div>
              <div className="fila-lista__info">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <h3>{v.titulo}</h3>
                  <InsigniaEstado subasta={v.subasta} />
                  {v.miEstado && <EstadoPuja estado={v.miEstado} compacto />}
                </div>
                <div className="fila-lista__meta">
                  <span>
                    Oferta actual: <b className="num">{moneda(v.subasta.montoActual)}</b>
                  </span>
                  <span>
                    Mi oferta máxima: <b className="num">{moneda(v.miMaximo)}</b>
                  </span>
                  <span>
                    <CuentaRegresiva subasta={v.subasta} />
                  </span>
                </div>
              </div>
              <div className="fila-lista__acciones">
                <Link to={`/vehiculo/${v.id}`} className={`btn btn--sm ${v.miEstado === 'superado' ? 'btn--acento' : 'btn--secundario'}`}>
                  {v.miEstado === 'superado' ? <Gavel size={15} /> : <Eye size={15} />} {v.miEstado === 'superado' ? 'Ofertar de nuevo' : 'Ver'}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
