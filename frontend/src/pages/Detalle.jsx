import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight, ClipboardList, FileText, CircleAlert } from 'lucide-react'
import { api } from '../lib/api'
import { useAhora } from '../lib/reloj'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useEventoSocket, useAlReconectar } from '../context/SocketContext'
import Carrusel from '../components/Carrusel'
import FichaTecnica from '../components/FichaTecnica'
import PanelPuja from '../components/PanelPuja'
import HistorialPujas from '../components/HistorialPujas'
import { InsigniaDanio, InsigniaEstado } from '../components/Insignias'
import { faseSubasta } from '../components/CuentaRegresiva'
import { moneda } from '../lib/formato'

export default function Detalle() {
  const { id: idTexto } = useParams()
  const id = Number(idTexto)
  const { autenticado } = useAuth()
  const { notificar } = useToast()
  const ahora = useAhora()
  const [v, setV] = useState(null)
  const [pujas, setPujas] = useState([])
  const [error, setError] = useState(null)
  const [destello, setDestello] = useState(false)
  const refrescoCierre = useRef(null)

  const cargarPujas = useCallback(() => api(`/api/vehiculos/${id}/pujas`).then((r) => setPujas(r.data)).catch(() => {}), [id])
  const cargar = useCallback(() => {
    return Promise.all([api(`/api/vehiculos/${id}`), api(`/api/vehiculos/${id}/pujas`)])
      .then(([d, p]) => {
        setV(d.data)
        setPujas(p.data)
        setError(null)
      })
      .catch((e) => setError(e))
  }, [id])

  useEffect(() => {
    setV(null)
    cargar()
  }, [cargar, autenticado])
  useAlReconectar(cargar)

  useEffect(() => {
    if (v) document.title = `${v.titulo} · AutoPuja`
    return () => (document.title = 'AutoPuja · Subastas de vehículos en tiempo real')
  }, [v])

  const fase = v ? faseSubasta(v.subasta, ahora) : null

  // Al llegar a cero en pantalla, se consulta el resultado oficial al servidor.
  useEffect(() => {
    if (fase === 'cerrada' && v && !v.subasta.resultado && !refrescoCierre.current) {
      refrescoCierre.current = setTimeout(() => {
        refrescoCierre.current = null
        cargar()
      }, 2500)
    }
  }, [fase, v, cargar])
  useEffect(() => () => clearTimeout(refrescoCierre.current), [])

  const destellar = () => {
    setDestello(true)
    setTimeout(() => setDestello(false), 1700)
  }

  // ---------------- Tiempo real ----------------
  useEventoSocket('puja:nueva', (e) => {
    if (e.vehiculoId !== id) return
    setV((x) => x && { ...x, subasta: { ...x.subasta, montoActual: e.montoActual, totalPujas: e.totalPujas, minimoSiguiente: e.minimoSiguiente } })
    destellar()
    cargarPujas()
  })
  useEventoSocket('puja:estado', (e) => {
    if (e.vehiculoId !== id) return
    setV((x) => x && { ...x, miEstado: e.estado })
  })
  useEventoSocket('subasta:cerrada', (e) => {
    if (e.vehiculoId !== id) return
    setV((x) => x && { ...x, subasta: { ...x.subasta, estado: 'cerrada', resultado: e.resultado, minimoSiguiente: null } })
  })
  useEventoSocket('subasta:iniciada', (e) => e.vehiculoId === id && cargar())
  useEventoSocket('vehiculo:actualizado', (e) => e.vehiculoId === id && cargar())

  const ofertar = async (monto) => {
    try {
      const r = await api(`/api/vehiculos/${id}/pujas`, { metodo: 'POST', cuerpo: { monto } })
      setV((x) => ({ ...x, miEstado: r.miEstado, subasta: { ...x.subasta, ...r.subasta } }))
      notificar({ tipo: 'exito', titulo: 'Oferta registrada', mensaje: `Ofertaste ${moneda(monto)}. ¡Vas ganando esta subasta!` })
      cargarPujas()
    } catch (err) {
      if (err.codigo === 'SUBASTA_CERRADA' || err.codigo === 'SUBASTA_NO_INICIADA' || err.codigo === 'YA_ERES_LIDER') cargar()
      if (err.detalles?.minimo) setV((x) => ({ ...x, subasta: { ...x.subasta, minimoSiguiente: err.detalles.minimo, montoActual: err.detalles.montoActual ?? x.subasta.montoActual } }))
      throw err
    }
  }

  if (error) {
    return (
      <div className="contenedor" style={{ padding: '48px 16px' }}>
        <div className="panel vacio">
          <span className="vacio__icono">
            <CircleAlert size={26} />
          </span>
          <h3>{error.status === 404 ? 'Vehículo no encontrado' : 'No se pudo cargar el vehículo'}</h3>
          <p>{error.message}</p>
          <Link className="btn btn--primario" to="/">
            Volver al inventario
          </Link>
        </div>
      </div>
    )
  }

  if (!v) {
    return (
      <div className="contenedor">
        <div className="migas esqueleto" style={{ height: 18, width: 240, margin: '22px 0 14px' }} />
        <div className="detalle">
          <div className="carrusel__marco esqueleto" />
          <div className="panel esqueleto" style={{ height: 420 }} />
        </div>
      </div>
    )
  }

  return (
    <div className="contenedor">
      <nav className="migas" aria-label="Ruta de navegación">
        <Link to="/">Inventario</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link to={`/?marca=${v.marca.id}`}>{v.marca.nombre}</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{v.modelo}</span>
      </nav>

      <div className="detalle__cab">
        <h1 className="detalle__titulo">{v.titulo}</h1>
        <InsigniaEstado subasta={{ ...v.subasta, estado: fase }} />
        <InsigniaDanio danio={v.danio} completa />
        <span className="insignia">Lote #{String(v.id).padStart(5, '0')}</span>
      </div>

      <div className="detalle">
        <div className="detalle__principal">
          <Carrusel fotos={v.fotos} titulo={v.titulo} />

          <section className="panel">
            <div className="panel__cuerpo">
              <h2 className="panel__titulo" style={{ marginBottom: 14 }}>
                <ClipboardList size={18} aria-hidden="true" /> Ficha técnica
              </h2>
              <FichaTecnica v={v} />
            </div>
          </section>

          <section className="panel">
            <div className="panel__cuerpo" style={{ display: 'grid', gap: 12 }}>
              <h2 className="panel__titulo">
                <FileText size={18} aria-hidden="true" /> Estado y descripción
              </h2>
              <InsigniaDanio danio={v.danio} completa />
              <p style={{ color: 'var(--text-2)', whiteSpace: 'pre-line' }}>{v.descripcion || 'El publicador no agregó una descripción adicional.'}</p>
            </div>
          </section>
        </div>

        <aside className="detalle__lateral">
          <PanelPuja v={v} fase={fase} miEstado={v.miEstado} autenticado={autenticado} destello={destello} onOfertar={ofertar} />
          <HistorialPujas pujas={pujas} />
        </aside>
      </div>
    </div>
  )
}
