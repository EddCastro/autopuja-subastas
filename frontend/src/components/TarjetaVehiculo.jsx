import { Link } from 'react-router-dom'
import { Images, Fuel, Cog, Gauge, Calendar } from 'lucide-react'
import { urlApi } from '../lib/api'
import { moneda } from '../lib/formato'
import { InsigniaDanio, InsigniaEstado, EstadoPuja } from './Insignias'
import CuentaRegresiva from './CuentaRegresiva'

export default function TarjetaVehiculo({ v, destello = false }) {
  const s = v.subasta
  const hayOfertas = s.totalPujas > 0
  return (
    <Link to={`/vehiculo/${v.id}`} className={`tarjeta ${destello ? 'tarjeta--destello' : ''}`} aria-label={`Ver subasta: ${v.titulo}`}>
      <div className="tarjeta__foto">
        {v.fotoPortada ? <img src={urlApi(v.fotoPortada)} alt={v.titulo} loading="lazy" /> : null}
        <div className="tarjeta__sobre">
          <InsigniaDanio danio={v.danio} />
          <InsigniaEstado subasta={s} />
        </div>
        <span className="tarjeta__fotos">
          <Images size={13} aria-hidden="true" /> {v.totalFotos}
        </span>
      </div>
      <div className="tarjeta__cuerpo">
        <div>
          <h3 className="tarjeta__titulo">{v.titulo}</h3>
          <p className="tarjeta__sub">
            {v.tipoArticulo.nombre} · {v.motor}
          </p>
        </div>
        <div className="specs">
          <span className="spec"><Calendar size={12} aria-hidden="true" />{v.anio}</span>
          <span className="spec"><Fuel size={12} aria-hidden="true" />{v.combustible.nombre}</span>
          <span className="spec"><Cog size={12} aria-hidden="true" />{v.transmision.nombre}</span>
          <span className="spec"><Gauge size={12} aria-hidden="true" />{v.trenManejo.codigo}</span>
        </div>
        {v.miEstado && <EstadoPuja estado={v.miEstado} compacto />}
        <div className="tarjeta__precio">
          <div>
            <div className="precio__etiqueta">{hayOfertas ? 'Oferta actual' : 'Precio base'}</div>
            <div className={`precio__valor num ${destello ? 'destello' : ''}`}>{moneda(hayOfertas ? s.montoActual : s.precioBase)}</div>
            <div className="tarjeta__pujas">{hayOfertas ? `${s.totalPujas} ${s.totalPujas === 1 ? 'oferta' : 'ofertas'}` : 'Sin ofertas aún'}</div>
          </div>
          <div className="tarjeta__tiempo">
            <CuentaRegresiva subasta={s} variante="tarjeta" />
          </div>
        </div>
      </div>
    </Link>
  )
}

export function TarjetaEsqueleto() {
  return (
    <div className="tarjeta tarjeta--esqueleto" aria-hidden="true">
      <div className="tarjeta__foto esqueleto" />
      <div className="tarjeta__cuerpo">
        <div className="esqueleto" style={{ height: 18, width: '75%' }} />
        <div className="esqueleto" style={{ height: 12, width: '50%' }} />
        <div className="esqueleto" style={{ height: 22, width: '90%' }} />
        <div className="esqueleto" style={{ height: 28, width: '60%' }} />
      </div>
    </div>
  )
}
