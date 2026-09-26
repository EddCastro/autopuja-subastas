import { useEffect, useMemo, useState } from 'react'
import { CircleCheck, Circle, LoaderCircle, Send, Lock, CircleAlert } from 'lucide-react'
import { api } from '../lib/api'
import { aInputLocal, deInputLocal, moneda } from '../lib/formato'
import { comprimirImagen } from '../lib/imagenes'
import Campo from './Campo'
import GaleriaSubida, { MIN_FOTOS, fotoExistente } from './GaleriaSubida'

const COLOR = { VERDE: 'var(--danio-verde)', AMARILLO: 'var(--danio-amarillo)', ROJO: 'var(--danio-rojo)' }
const MIN = 60_000

export function datosIniciales(v = null) {
  const ahora = Date.now()
  if (!v) {
    return {
      anio: '', tipoArticuloId: '', marcaId: '', modelo: '', motor: '', transmisionId: '', combustibleId: '',
      trenManejoId: '', cilindros: '', nivelDanioId: '', color: '', kilometraje: '', descripcion: '', precioBase: '',
      fechaInicio: aInputLocal(ahora), fechaCierre: aInputLocal(ahora + 3 * 24 * 60 * MIN),
    }
  }
  return {
    anio: String(v.anio), tipoArticuloId: String(v.tipoArticulo.id), marcaId: String(v.marca.id), modelo: v.modelo, motor: v.motor,
    transmisionId: String(v.transmision.id), combustibleId: String(v.combustible.id), trenManejoId: String(v.trenManejo.id),
    cilindros: String(v.cilindros), nivelDanioId: String(v.danio.id), color: v.color || '', kilometraje: v.kilometraje ?? '',
    descripcion: v.descripcion || '', precioBase: String(v.subasta.precioBase),
    fechaInicio: aInputLocal(v.subasta.fechaInicio), fechaCierre: aInputLocal(v.subasta.fechaCierre),
  }
}

function Seccion({ num, titulo, texto, children }) {
  return (
    <section className="panel">
      <div className="panel__cuerpo seccion-form">
        <div className="seccion-form__cab">
          <span className="seccion-form__num">{num}</span>
          <div>
            <h2>{titulo}</h2>
            {texto && <p>{texto}</p>}
          </div>
        </div>
        {children}
      </div>
    </section>
  )
}

/**
 * Formulario de publicación / edición. Todos los campos de la ficha técnica,
 * el estado de daño, la galería (mín. 5 fotos) y los parámetros de la subasta
 * son obligatorios. El servidor vuelve a validar todo.
 */
export default function FormularioVehiculo({ vehiculo = null, onGuardar, textoBoton = 'Publicar vehículo' }) {
  const [c, setC] = useState(null)
  const [d, setD] = useState(() => datosIniciales(vehiculo))
  const [fotos, setFotos] = useState(() => (vehiculo?.fotos || []).map(fotoExistente))
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [modelos, setModelos] = useState([])

  const conPujas = (vehiculo?.subasta.totalPujas || 0) > 0
  const cerrada = vehiculo?.subasta.estado === 'cerrada'

  useEffect(() => {
    api('/api/catalogos').then((r) => setC(r.data)).catch((e) => setError(e.message))
  }, [])
  useEffect(() => {
    if (!d.marcaId) return setModelos([])
    api(`/api/catalogos/modelos?marcaId=${d.marcaId}`).then((r) => setModelos(r.data)).catch(() => {})
  }, [d.marcaId])

  const electrico = useMemo(() => c?.combustibles.find((x) => String(x.id) === d.combustibleId)?.nombre === 'Eléctrico', [c, d.combustibleId])
  useEffect(() => {
    if (electrico && d.cilindros !== '0') setD((x) => ({ ...x, cilindros: '0' }))
    if (!electrico && d.cilindros === '0') setD((x) => ({ ...x, cilindros: '' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [electrico])

  const set = (k) => (e) => {
    const valor = e?.target ? e.target.value : e
    setD((x) => ({ ...x, [k]: valor }))
    setErrores((x) => ({ ...x, [k]: undefined }))
    setError(null)
  }

  const presetCierre = (ms) => {
    const base = new Date(d.fechaInicio || Date.now()).getTime()
    setD((x) => ({ ...x, fechaCierre: aInputLocal(base + ms) }))
    setErrores((x) => ({ ...x, fechaCierre: undefined }))
  }

  const anioMax = new Date().getFullYear() + 1

  function validar() {
    const e = {}
    const req = (k, msg) => !String(d[k] ?? '').trim() && (e[k] = msg)
    req('anio', 'Indique el año.')
    if (d.anio && (Number(d.anio) < 1950 || Number(d.anio) > anioMax)) e.anio = `Año entre 1950 y ${anioMax}.`
    req('tipoArticuloId', 'Seleccione el tipo de artículo.')
    req('marcaId', 'Seleccione la marca.')
    req('modelo', 'Indique el modelo.')
    req('motor', 'Describa el motor (ej. 2.0L I4 Turbo).')
    req('transmisionId', 'Seleccione la transmisión.')
    req('combustibleId', 'Seleccione el combustible.')
    req('trenManejoId', 'Seleccione el tren de manejo.')
    req('cilindros', 'Seleccione los cilindros.')
    req('nivelDanioId', 'Clasifique el estado de daño.')
    if (!(Number(d.precioBase) >= 100)) e.precioBase = 'Precio base mínimo Q 100.'
    if (!d.fechaInicio) e.fechaInicio = 'Indique el inicio.'
    if (!d.fechaCierre) e.fechaCierre = 'Indique el cierre.'
    else if (new Date(d.fechaCierre) - new Date(d.fechaInicio) < 2 * MIN) e.fechaCierre = 'El cierre debe ser al menos 2 minutos después del inicio.'
    else if (new Date(d.fechaCierre).getTime() <= Date.now() + MIN) e.fechaCierre = 'El cierre debe ser una fecha futura.'
    if (fotos.length < MIN_FOTOS) e.fotos = `Agregue al menos ${MIN_FOTOS} fotografías (tiene ${fotos.length}).`
    return e
  }

  const enviar = async (ev) => {
    ev.preventDefault()
    setError(null)
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length) {
      setError('Revise los campos marcados en rojo.')
      setTimeout(() => document.querySelector('.campo--error, .campo__error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      return
    }
    setEnviando(true)
    setProgreso(0)
    try {
      const nuevas = fotos.filter((f) => f.tipo === 'nueva')
      const comprimidas = await Promise.all(nuevas.map((f) => comprimirImagen(f.file)))
      const datos = {
        anio: Number(d.anio), tipoArticuloId: Number(d.tipoArticuloId), marcaId: Number(d.marcaId), modelo: d.modelo.trim(), motor: d.motor.trim(),
        transmisionId: Number(d.transmisionId), combustibleId: Number(d.combustibleId), trenManejoId: Number(d.trenManejoId),
        cilindros: Number(d.cilindros), nivelDanioId: Number(d.nivelDanioId), color: d.color.trim() || null,
        kilometraje: d.kilometraje === '' ? null : Number(d.kilometraje), descripcion: d.descripcion.trim() || null,
        precioBase: Number(d.precioBase), fechaInicio: deInputLocal(d.fechaInicio), fechaCierre: deInputLocal(d.fechaCierre),
      }
      if (vehiculo) {
        // Se conservan las fechas exactas originales si no se modificaron (evita perder segundos)
        if (d.fechaInicio === aInputLocal(vehiculo.subasta.fechaInicio)) datos.fechaInicio = vehiculo.subasta.fechaInicio
        if (d.fechaCierre === aInputLocal(vehiculo.subasta.fechaCierre)) datos.fechaCierre = vehiculo.subasta.fechaCierre
        datos.fotosConservar = fotos.filter((f) => f.tipo === 'existente').map((f) => f.id)
        let n = 0
        datos.fotosOrden = fotos.map((f) => (f.tipo === 'existente' ? `e:${f.id}` : `n:${n++}`))
      }
      const fd = new FormData()
      fd.append('datos', JSON.stringify(datos))
      comprimidas.forEach((f) => fd.append('fotos', f, f.name))
      await onGuardar(fd, setProgreso)
    } catch (err) {
      setError(err.message)
      if (err.porCampo) setErrores(err.porCampo)
    } finally {
      setEnviando(false)
    }
  }

  if (!c) {
    return error ? <div className="alerta alerta--error">{error}</div> : <div className="panel esqueleto" style={{ height: 480 }} />
  }

  const completo = {
    ficha: ['anio', 'tipoArticuloId', 'marcaId', 'modelo', 'motor', 'transmisionId', 'combustibleId', 'trenManejoId', 'cilindros'].every((k) => String(d[k]).trim()),
    danio: Boolean(d.nivelDanioId),
    fotos: fotos.length >= MIN_FOTOS,
    subasta: Boolean(d.precioBase && d.fechaInicio && d.fechaCierre),
  }
  const campoSel = (k, etiqueta, opciones, props = {}) => (
    <Campo id={k} etiqueta={etiqueta} requerido error={errores[k]}>
      <select id={k} className="select" value={d[k]} onChange={set(k)} {...props}>
        <option value="">Seleccione…</option>
        {opciones}
      </select>
    </Campo>
  )

  return (
    <form className="form-vehiculo" onSubmit={enviar} noValidate>
      <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
        <Seccion num="1" titulo="Ficha técnica" texto="Datos del vehículo tal como aparecen en su documentación.">
          <div className="rejilla-campos">
            <Campo id="anio" etiqueta="Año" requerido error={errores.anio}>
              <input id="anio" className="input" type="number" min="1950" max={anioMax} value={d.anio} onChange={set('anio')} placeholder="Ej. 2020" />
            </Campo>
            {campoSel('tipoArticuloId', 'Tipo de artículo', c.tiposArticulo.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>))}
            {campoSel('marcaId', 'Marca', c.marcas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>))}
            <Campo id="modelo" etiqueta="Modelo" requerido error={errores.modelo}>
              <input id="modelo" className="input" list="modelos-form" value={d.modelo} onChange={set('modelo')} placeholder="Ej. Corolla LE" maxLength={80} />
              <datalist id="modelos-form">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
            </Campo>
            <Campo id="motor" etiqueta="Motor" requerido error={errores.motor}>
              <input id="motor" className="input" value={d.motor} onChange={set('motor')} placeholder="Ej. 2.5L I4" maxLength={80} />
            </Campo>
            {campoSel('transmisionId', 'Transmisión', c.transmisiones.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>))}
            {campoSel('combustibleId', 'Tipo de combustible', c.combustibles.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>))}
            {campoSel(
              'cilindros',
              'Número de cilindros',
              c.cilindros.filter((n) => (electrico ? n === 0 : n > 0)).map((n) => <option key={n} value={n}>{n === 0 ? '0 (eléctrico)' : n}</option>),
              { disabled: electrico }
            )}
            <Campo id="color" etiqueta="Color" error={errores.color}>
              <input id="color" className="input" value={d.color} onChange={set('color')} placeholder="Opcional" maxLength={40} />
            </Campo>
            <Campo id="kilometraje" etiqueta="Kilometraje (km)" error={errores.kilometraje}>
              <input id="kilometraje" className="input" type="number" min="0" value={d.kilometraje} onChange={set('kilometraje')} placeholder="Opcional" />
            </Campo>
          </div>
          <div className="campo">
            <span className="campo__etiqueta">
              Tren de manejo<span className="campo__req">*</span>
            </span>
            <div className="tarjetas-opcion" role="radiogroup" aria-label="Tren de manejo">
              {c.trenesManejo.map((t) => (
                <button type="button" role="radio" key={t.id} className="tarjeta-opcion" aria-pressed={d.trenManejoId === String(t.id)} aria-checked={d.trenManejoId === String(t.id)} onClick={() => set('trenManejoId')(String(t.id))}>
                  <b>{t.codigo}</b>
                  <span>{t.descripcion}</span>
                </button>
              ))}
            </div>
            {errores.trenManejoId && <span className="campo__error">{errores.trenManejoId}</span>}
          </div>
        </Seccion>

        <Seccion num="2" titulo="Clasificación por estado de daño" texto="El color se mostrará en el inventario y en el detalle.">
          <div className="tarjetas-opcion" role="radiogroup" aria-label="Estado de daño">
            {c.nivelesDanio.map((n) => (
              <button type="button" role="radio" key={n.id} className="tarjeta-opcion" style={{ '--c': COLOR[n.codigo] }} aria-pressed={d.nivelDanioId === String(n.id)} aria-checked={d.nivelDanioId === String(n.id)} onClick={() => set('nivelDanioId')(String(n.id))}>
                <b>
                  <span className="punto" aria-hidden="true" /> {n.nombre}
                </b>
                <span>{n.descripcion}</span>
              </button>
            ))}
          </div>
          {errores.nivelDanioId && <span className="campo__error">{errores.nivelDanioId}</span>}
          <Campo id="descripcion" etiqueta="Descripción del daño y observaciones" error={errores.descripcion} ayuda="Opcional · hasta 1000 caracteres">
            <textarea id="descripcion" className="textarea" value={d.descripcion} onChange={set('descripcion')} maxLength={1000} placeholder="Ej. Golpe en defensa delantera; motor enciende; bolsas de aire intactas…" />
          </Campo>
        </Seccion>

        <Seccion num="3" titulo="Galería fotográfica" texto={`Mínimo ${MIN_FOTOS} fotografías: frente, laterales, parte trasera, interior y motor.`}>
          <GaleriaSubida fotos={fotos} setFotos={(f) => (setFotos(f), setErrores((x) => ({ ...x, fotos: undefined })))} error={errores.fotos} />
        </Seccion>

        <Seccion num="4" titulo="Parámetros de la subasta" texto="Monto base con el que inicia la subasta y su horario.">
          {conPujas && (
            <div className="alerta alerta--warn">
              <Lock size={18} /> La subasta ya tiene ofertas: el precio base y las fechas no se pueden modificar.
            </div>
          )}
          <div className="rejilla-campos">
            <Campo id="precioBase" etiqueta="Precio / monto base" requerido error={errores.precioBase} ayuda={d.precioBase ? `La primera oferta debe ser de al menos ${moneda(Number(d.precioBase))}` : 'Ej. 20000'}>
              <div className="input-grupo">
                <span className="input-grupo__prefijo">Q</span>
                <input id="precioBase" className="input" type="number" min="100" step="0.01" value={d.precioBase} onChange={set('precioBase')} disabled={conPujas} />
              </div>
            </Campo>
            <Campo id="fechaInicio" etiqueta="Fecha y hora de inicio" requerido error={errores.fechaInicio}>
              <div className="input-grupo">
                <input id="fechaInicio" className="input" style={{ paddingLeft: 12, paddingRight: 70 }} type="datetime-local" value={d.fechaInicio} onChange={set('fechaInicio')} disabled={conPujas} />
                {!conPujas && (
                  <button type="button" className="btn btn--fantasma btn--sm" style={{ position: 'absolute', right: 4 }} onClick={() => set('fechaInicio')(aInputLocal(Date.now()))}>
                    Ahora
                  </button>
                )}
              </div>
            </Campo>
            <Campo id="fechaCierre" etiqueta="Fecha y hora de cierre" requerido error={errores.fechaCierre}>
              <input id="fechaCierre" className="input" type="datetime-local" value={d.fechaCierre} onChange={set('fechaCierre')} disabled={conPujas} />
            </Campo>
          </div>
          {!conPujas && (
            <div className="presets" aria-label="Duraciones rápidas">
              <span className="tenue" style={{ fontSize: '0.82rem', alignSelf: 'center' }}>Duración:</span>
              {[
                ['10 min', 10 * MIN],
                ['1 hora', 60 * MIN],
                ['1 día', 1440 * MIN],
                ['3 días', 3 * 1440 * MIN],
                ['7 días', 7 * 1440 * MIN],
              ].map(([t, ms]) => (
                <button type="button" key={t} className="btn btn--secundario btn--sm" onClick={() => presetCierre(ms)}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </Seccion>
      </div>

      <aside className="resumen">
        <div className="panel">
          <div className="panel__cuerpo" style={{ display: 'grid', gap: 14 }}>
            <h2 className="panel__titulo">Resumen</h2>
            <ul className="lista-check">
              {[
                ['ficha', 'Ficha técnica completa'],
                ['danio', 'Estado de daño clasificado'],
                ['fotos', `Galería (${fotos.length}/${MIN_FOTOS} mínimo)`],
                ['subasta', 'Parámetros de la subasta'],
              ].map(([k, t]) => (
                <li key={k} className={completo[k] ? 'ok' : ''}>
                  {completo[k] ? <CircleCheck size={16} /> : <Circle size={16} />} {t}
                </li>
              ))}
            </ul>
            {cerrada && (
              <div className="alerta alerta--warn">
                <Lock size={18} /> La subasta ya cerró; la publicación no se puede editar.
              </div>
            )}
            {error && (
              <div className="alerta alerta--error" role="alert">
                <CircleAlert size={18} /> {error}
              </div>
            )}
            {enviando && (
              <div>
                <div className="barra-progreso">
                  <span style={{ width: `${progreso}%` }} />
                </div>
                <small className="tenue">Subiendo fotografías… {progreso}%</small>
              </div>
            )}
            <button className="btn btn--primario btn--lg btn--bloque" disabled={enviando || cerrada}>
              {enviando ? <LoaderCircle size={18} className="girar" /> : <Send size={18} />} {textoBoton}
            </button>
          </div>
        </div>
      </aside>
    </form>
  )
}
