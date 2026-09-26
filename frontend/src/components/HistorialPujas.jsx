import { User, History } from 'lucide-react'
import { moneda, haceCuanto, fecha } from '../lib/formato'
import { useAhora } from '../lib/reloj'

/** Historial ANÓNIMO: solo montos y hora; "Tú" marca las propias. */
export default function HistorialPujas({ pujas }) {
  const ahora = useAhora()
  return (
    <section className="panel">
      <div className="panel__cuerpo">
        <h2 className="panel__titulo" style={{ marginBottom: 6 }}>
          <History size={18} aria-hidden="true" /> Historial de ofertas
        </h2>
        <p className="tenue" style={{ fontSize: '0.84rem', marginBottom: 8 }}>
          Por privacidad, la identidad de los postores es anónima.
        </p>
        {!pujas?.length ? (
          <p className="tenue">Aún no hay ofertas. ¡Sea el primero en ofertar!</p>
        ) : (
          <div className="historial">
            {pujas.map((p, i) => (
              <div key={p.id} className={`historial__fila ${p.esMia ? 'historial__fila--mia' : ''} ${i === 0 ? 'historial__fila--lider' : ''}`}>
                <div className="historial__postor">
                  <span className="historial__avatar">
                    <User size={15} aria-hidden="true" />
                  </span>
                  <div>
                    <div>
                      {p.esMia ? 'Tu oferta' : 'Postor anónimo'}
                      {i === 0 && <span className="etiqueta-mia" style={{ color: 'var(--ok)', background: 'var(--ok-bg)' }}>Más alta</span>}
                    </div>
                    <small className="tenue" title={fecha(p.fecha)}>
                      {haceCuanto(p.fecha, ahora)}
                    </small>
                  </div>
                </div>
                <b className="num">{moneda(p.monto)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
