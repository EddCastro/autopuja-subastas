import { Calendar, Tag, CarFront, Wrench, Cog, Fuel, Gauge, Hash, Palette, Activity } from 'lucide-react'
import { numero } from '../lib/formato'

/** Ficha técnica completa del vehículo. */
export default function FichaTecnica({ v }) {
  const items = [
    [Calendar, 'Año', v.anio],
    [CarFront, 'Tipo de artículo', v.tipoArticulo.nombre],
    [Tag, 'Marca', v.marca.nombre],
    [Tag, 'Modelo', v.modelo],
    [Wrench, 'Motor', v.motor],
    [Cog, 'Transmisión', v.transmision.nombre],
    [Fuel, 'Combustible', v.combustible.nombre],
    [Gauge, 'Tren de manejo', `${v.trenManejo.codigo} · ${v.trenManejo.descripcion}`],
    [Hash, 'Cilindros', v.cilindros === 0 ? '0 (eléctrico)' : v.cilindros],
    ...(v.color ? [[Palette, 'Color', v.color]] : []),
    ...(v.kilometraje != null ? [[Activity, 'Kilometraje', `${numero(v.kilometraje)} km`]] : []),
  ]
  return (
    <dl className="ficha" style={{ margin: 0 }}>
      {items.map(([Icono, etiqueta, valor]) => (
        <div className="ficha__item" key={etiqueta}>
          <span className="ficha__icono">
            <Icono size={17} aria-hidden="true" />
          </span>
          <div>
            <dt className="ficha__etiqueta">{etiqueta}</dt>
            <dd className="ficha__valor" style={{ margin: 0 }}>
              {valor}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  )
}
