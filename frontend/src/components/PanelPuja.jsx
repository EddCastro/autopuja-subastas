import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Gavel, LogIn, Pencil, Lock, Info, LoaderCircle, TrendingUp } from 'lucide-react'
import { moneda, fecha } from '../lib/formato'
import { InsigniaEstado, EstadoPuja } from './Insignias'
import CuentaRegresiva from './CuentaRegresiva'

const redondear = (n) => Math.ceil(n)

/**
 * Panel de subasta en tiempo real: oferta actual, temporizador, indicador
 * "Vas ganando / Tu oferta ha sido superada" y formulario de puja.
 * La validación definitiva ocurre en el servidor.
 */
export default function PanelPuja({ v, fase, miEstado, autenticado, destello, onOfertar, onCambioFase }) {
  const s = v.subasta
  const hayOfertas = s.totalPujas > 0
  const minimo = s.minimoSiguiente ?? s.precioBase
  const [monto, setMonto] = useState(String(redondear(minimo)))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const minimoPrevio = useRef(minimo)
  const location = useLocation()

  // Si otra persona oferta y el mínimo sube, se actualiza el monto sugerido.
  useEffect(() => {
    if (minimo === minimoPrevio.current) return
    minimoPrevio.current = minimo
    if (Number(monto) < minimo) {
      setAviso(`Otro postor ofertó: la oferta mínima ahora es ${moneda(minimo)}.`)
      setMonto(String(redondear(minimo)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minimo])

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    setAviso(null)
    const valor = Number(monto)
    if (!Number.isFinite(valor) || valor <= 0) return setError('Ingrese un monto válido.')
    if (valor < minimo) return setError(`La oferta mínima es ${moneda(minimo)} (${hayOfertas ? 'oferta actual + 10 %' : 'precio base'}).`)
    setEnviando(true)
    try {
      await onOfertar(valor)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const rapidos = hayOfertas
    ? [
        ['Mínimo', minimo],
        ['+15 %', s.montoActual * 1.15],
        ['+25 %', s.montoActual * 1.25],
      ]
    : [
        ['Base', s.precioBase],
        ['+10 %', s.precioBase * 1.1],
        ['+20 %', s.precioBase * 1.2],
      ]

  return (
    <section className="panel puja" aria-labelledby="titulo-puja">
      <div className="puja__cab">
        <h2 id="titulo-puja" className="panel__titulo">
          <Gavel size={18} aria-hidden="true" /> Subasta
        </h2>
        <InsigniaEstado subasta={{ ...s, estado: fase }} />
      </div>
      <div className="puja__cuerpo">
        <div>
          <div className="precio__etiqueta">
            {fase === 'cerrada' ? (hayOfertas ? 'Oferta ganadora' : 'Precio base · sin ofertas') : hayOfertas ? 'Oferta actual más alta' : 'Precio base · sin ofertas aún'}
          </div>
          <div className={`puja__monto num ${destello ? 'destello' : ''}`} aria-live="polite">
            {moneda(hayOfertas ? s.montoActual : s.precioBase)}
          </div>
        </div>

        <div className="puja__datos">
          <div className="dato">
            <span>Precio base</span>
            <b className="num">{moneda(s.precioBase)}</b>
          </div>
          <div className="dato">
            <span>Ofertas</span>
            <b className="num">{s.totalPujas}</b>
          </div>
          {fase !== 'cerrada' && (
            <div className="dato" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <TrendingUp size={14} /> Oferta mínima (incremento {s.incrementoMinimoPct} %)
              </span>
              <b className="num">{moneda(minimo)}</b>
            </div>
          )}
        </div>

        {fase !== 'cerrada' && <CuentaRegresiva subasta={s} variante="grande" onCambioFase={onCambioFase} />}

        {miEstado && <EstadoPuja estado={miEstado} monto={s.montoActual} />}

        {fase === 'cerrada' && (
          <div className="cerrada">
            <Lock size={20} style={{ justifySelf: 'center' }} aria-hidden="true" />
            <b>Oferta cerrada</b>
            <span className="tenue">
              {s.resultado === 'vendida' || (hayOfertas && s.resultado !== 'desierta')
                ? `Subasta finalizada · Vendido por ${moneda(s.montoActual)}`
                : 'Subasta desierta: no se alcanzó el monto base. No vendido.'}
            </span>
            <small className="tenue">Cerró el {fecha(s.fechaCierre)}</small>
          </div>
        )}

        {fase === 'proxima' && (
          <div className="alerta alerta--info">
            <Info size={18} />
            <span>La subasta inicia el {fecha(s.fechaInicio)}. Podrá ofertar en cuanto comience; el panel se activará solo.</span>
          </div>
        )}

        {fase === 'activa' && !autenticado && (
          <div className="alerta alerta--warn" style={{ display: 'grid', gap: 10 }}>
            <span style={{ display: 'flex', gap: 8 }}>
              <Lock size={18} /> Para ofertar debe iniciar sesión. Los visitantes solo pueden ver el inventario.
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link className="btn btn--primario btn--sm" to={`/login?volver=${encodeURIComponent(location.pathname)}`}>
                <LogIn size={15} /> Iniciar sesión
              </Link>
              <Link className="btn btn--secundario btn--sm" to={`/registro?volver=${encodeURIComponent(location.pathname)}`}>
                Crear cuenta
              </Link>
            </div>
          </div>
        )}

        {fase === 'activa' && autenticado && v.esPropietario && (
          <div className="alerta alerta--info" style={{ display: 'grid', gap: 10 }}>
            <span>Esta es su publicación: no puede ofertar por su propio vehículo.</span>
            <Link className="btn btn--secundario btn--sm" to={`/editar/${v.id}`} style={{ justifySelf: 'start' }}>
              <Pencil size={14} /> Editar publicación
            </Link>
          </div>
        )}

        {fase === 'activa' && autenticado && !v.esPropietario && miEstado !== 'ganando' && (
          <form className="puja__form" onSubmit={enviar} noValidate>
            <div className="pujas-rapidas" role="group" aria-label="Montos sugeridos">
              {rapidos.map(([t, m]) => (
                <button type="button" key={t} onClick={() => (setMonto(String(redondear(m))), setError(null))}>
                  {t}
                  <br />
                  <span className="num">{moneda(redondear(m))}</span>
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="monto">
              Monto de su oferta en quetzales
            </label>
            <div className="input-grupo">
              <span className="input-grupo__prefijo">Q</span>
              <input
                id="monto"
                className="input num"
                type="number"
                inputMode="decimal"
                min={minimo}
                step="0.01"
                value={monto}
                onChange={(e) => (setMonto(e.target.value), setError(null))}
                aria-invalid={Boolean(error)}
                aria-describedby="monto-ayuda"
              />
            </div>
            <small id="monto-ayuda" className="campo__ayuda">
              Mínimo {moneda(minimo)}. Toda puja debe superar la oferta actual en al menos 10 %.
            </small>
            {aviso && <div className="alerta alerta--info">{aviso}</div>}
            {error && <div className="alerta alerta--error" role="alert">{error}</div>}
            <button className="btn btn--acento btn--lg btn--bloque" disabled={enviando}>
              {enviando ? <LoaderCircle size={18} className="girar" /> : <Gavel size={18} />}
              {enviando ? 'Enviando oferta…' : `Ofertar ${moneda(Number(monto) || 0)}`}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}
