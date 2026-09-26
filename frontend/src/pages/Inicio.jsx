import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X, UserPlus, Gavel, Radio, ChevronLeft, ChevronRight, Sparkles, CarFront } from 'lucide-react'
import { api, aQuery } from '../lib/api'
import { FILTROS_VACIOS, leerFiltros, aParametros, contarActivos, aConsultaApi } from '../lib/filtros'
import { useEventoSocket, useAlReconectar } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import PanelFiltros from '../components/PanelFiltros'
import TarjetaVehiculo, { TarjetaEsqueleto } from '../components/TarjetaVehiculo'
import { numero } from '../lib/formato'

const ORDENES = [
  ['cierre', 'Terminan primero'],
  ['recientes', 'Más recientes'],
  ['precio_asc', 'Precio: menor a mayor'],
  ['precio_desc', 'Precio: mayor a menor'],
  ['anio_desc', 'Año: más nuevo'],
  ['anio_asc', 'Año: más antiguo'],
  ['populares', 'Más ofertados'],
]
const TAMANO = 12

function useDebounce(valor, ms) {
  const [v, setV] = useState(valor)
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms)
    return () => clearTimeout(t)
  }, [valor, ms])
  return v
}

export default function Inicio() {
  const { autenticado } = useAuth()
  const [sp, setSp] = useSearchParams()
  const filtros = useMemo(() => leerFiltros(sp), [sp])
  const consulta = useDebounce(aQuery(aConsultaApi(filtros, TAMANO)), 300)
  const [catalogos, setCatalogos] = useState(null)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [destellos, setDestellos] = useState({})
  const [hayNuevos, setHayNuevos] = useState(false)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [stats, setStats] = useState(null)
  const [busqueda, setBusqueda] = useState(filtros.q)
  const resultadosRef = useRef(null)

  useEffect(() => {
    api('/api/catalogos').then((r) => setCatalogos(r.data)).catch(() => {})
  }, [])

  const cargarStats = useCallback(() => {
    Promise.all([api('/api/vehiculos?estado=activa&tamano=1'), api('/api/vehiculos?estado=proxima&tamano=1')])
      .then(([a, p]) => setStats({ activas: a.total, proximas: p.total }))
      .catch(() => {})
  }, [])
  useEffect(cargarStats, [cargarStats])

  const cargar = useCallback(
    (silencioso = false) => {
      const ctrl = new AbortController()
      if (!silencioso) setCargando(true)
      api(`/api/vehiculos${consulta}`, { senal: ctrl.signal })
        .then((r) => {
          setResultado(r)
          setError(null)
          setHayNuevos(false)
        })
        .catch((e) => e.name !== 'AbortError' && setError(e.message))
        .finally(() => setCargando(false))
      return () => ctrl.abort()
    },
    [consulta]
  )
  useEffect(() => cargar(), [cargar, autenticado])
  useAlReconectar(() => {
    cargar(true)
    cargarStats()
  })

  // ---------- Tiempo real: las tarjetas se actualizan sin recargar ----------
  const destellar = (id) => {
    setDestellos((d) => ({ ...d, [id]: Date.now() }))
    setTimeout(() => setDestellos((d) => ({ ...d, [id]: 0 })), 1700)
  }
  useEventoSocket('puja:nueva', (e) => {
    if (!resultado?.data.some((v) => v.id === e.vehiculoId)) return
    destellar(e.vehiculoId)
    setResultado((r) => ({
      ...r,
      data: r.data.map((v) =>
        v.id === e.vehiculoId ? { ...v, subasta: { ...v.subasta, montoActual: e.montoActual, totalPujas: e.totalPujas, minimoSiguiente: e.minimoSiguiente } } : v
      ),
    }))
  })
  useEventoSocket('puja:estado', (e) =>
    setResultado((r) => (r ? { ...r, data: r.data.map((v) => (v.id === e.vehiculoId ? { ...v, miEstado: e.estado } : v)) } : r))
  )
  useEventoSocket('subasta:cerrada', (e) => {
    setResultado((r) =>
      r ? { ...r, data: r.data.map((v) => (v.id === e.vehiculoId ? { ...v, subasta: { ...v.subasta, estado: 'cerrada', resultado: e.resultado } } : v)) } : r
    )
    cargarStats()
  })
  useEventoSocket('subasta:iniciada', (e) => {
    setResultado((r) => (r ? { ...r, data: r.data.map((v) => (v.id === e.vehiculoId ? { ...v, subasta: { ...v.subasta, estado: 'activa' } } : v)) } : r))
    cargarStats()
  })
  useEventoSocket('vehiculo:nuevo', () => {
    setHayNuevos(true)
    cargarStats()
  })
  useEventoSocket('vehiculo:actualizado', (e) => {
    if (resultado?.data.some((v) => v.id === e.vehiculoId)) cargar(true)
  })

  // ---------- Filtros ----------
  const cambiar = (parcial) => {
    const nuevo = { ...filtros, ...parcial }
    if (!('pagina' in parcial)) nuevo.pagina = 1
    setSp(aParametros(nuevo), { replace: true })
  }
  const limpiar = () => {
    setBusqueda('')
    setSp(aParametros({ ...FILTROS_VACIOS, orden: filtros.orden }), { replace: true })
  }
  const activos = contarActivos(filtros)

  const chips = useMemo(() => {
    if (!catalogos) return []
    const nombre = (lista, id, campo = 'nombre') => catalogos[lista].find((x) => x.id === id)?.[campo] ?? id
    const c = []
    if (filtros.q) c.push([`“${filtros.q}”`, { q: '' }])
    filtros.danio.forEach((d) => c.push([`Daño ${d}`, { danio: filtros.danio.filter((x) => x !== d) }]))
    filtros.marca.forEach((m) => c.push([nombre('marcas', m), { marca: filtros.marca.filter((x) => x !== m) }]))
    if (filtros.modelo) c.push([`Modelo: ${filtros.modelo}`, { modelo: '' }])
    if (filtros.anioMin) c.push([`Desde ${filtros.anioMin}`, { anioMin: '' }])
    if (filtros.anioMax) c.push([`Hasta ${filtros.anioMax}`, { anioMax: '' }])
    if (filtros.precioMin) c.push([`≥ Q${numero(filtros.precioMin)}`, { precioMin: '' }])
    if (filtros.precioMax) c.push([`≤ Q${numero(filtros.precioMax)}`, { precioMax: '' }])
    filtros.tipo.forEach((t) => c.push([nombre('tiposArticulo', t), { tipo: filtros.tipo.filter((x) => x !== t) }]))
    filtros.combustible.forEach((t) => c.push([nombre('combustibles', t), { combustible: filtros.combustible.filter((x) => x !== t) }]))
    filtros.transmision.forEach((t) => c.push([nombre('transmisiones', t), { transmision: filtros.transmision.filter((x) => x !== t) }]))
    filtros.tren.forEach((t) => c.push([nombre('trenesManejo', t, 'codigo'), { tren: filtros.tren.filter((x) => x !== t) }]))
    filtros.cilindros.forEach((t) => c.push([`${t} cil.`, { cilindros: filtros.cilindros.filter((x) => x !== t) }]))
    if (filtros.estado !== 'disponibles') c.push([{ activa: 'En vivo', proxima: 'Próximas', cerrada: 'Cerradas', todas: 'Todas' }[filtros.estado], { estado: 'disponibles' }])
    return c
  }, [filtros, catalogos])

  const buscar = (e) => {
    e.preventDefault()
    cambiar({ q: busqueda.trim() })
    resultadosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const irPagina = (p) => {
    cambiar({ pagina: p })
    resultadosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <section className="hero">
        <div className="contenedor hero__fila">
          <div>
            <span className="hero__etiqueta">
              <Radio size={14} aria-hidden="true" /> Pujas en tiempo real
            </span>
            <h1>
              Encuentra tu próximo vehículo y <em>oferta en vivo</em>
            </h1>
            <p className="hero__sub">Inventario de vehículos de subasta estilo EE. UU. con ficha técnica completa, clasificación de daño y temporizador sincronizado para todos los postores.</p>
            <form className="hero__busqueda" onSubmit={buscar} role="search">
              <div className="input-grupo">
                <Search size={18} className="input-grupo__prefijo" aria-hidden="true" />
                <input className="input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Marca, modelo, año o motor…" aria-label="Buscar vehículos" />
              </div>
              <button className="btn btn--primario btn--lg">Buscar</button>
            </form>
            <div className="estadisticas">
              <div className="estadistica">
                <b className="num">{stats ? stats.activas : '—'}</b>
                <span>subastas en vivo</span>
              </div>
              <div className="estadistica">
                <b className="num">{stats ? stats.proximas : '—'}</b>
                <span>próximas a iniciar</span>
              </div>
              <div className="estadistica">
                <b>+10 %</b>
                <span>incremento mínimo por puja</span>
              </div>
            </div>
          </div>
          <div className="pilares">
            {[
              [UserPlus, '#eef4ff', 'var(--primary)', 'Regístrese', 'Cree su cuenta gratis para ofertar y publicar vehículos.', autenticado ? null : '/registro'],
              [Search, '#e8f7ee', 'var(--ok)', 'Encuentre', 'Filtre por marca, modelo, año, combustible, daño y más.', null],
              [Gavel, '#fff4e0', 'var(--accent-600)', 'Oferte', 'Pujas en vivo con aviso inmediato si ganas o te superan.', null],
            ].map(([Icono, bg, color, titulo, texto, enlace]) => (
              <div className="pilar" key={titulo}>
                <span className="pilar__icono" style={{ background: bg, color }}>
                  <Icono size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3>{enlace ? <Link to={enlace}>{titulo}</Link> : titulo}</h3>
                  <p>{texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="contenedor inventario" ref={resultadosRef} style={{ scrollMarginTop: 72 }}>
        <PanelFiltros
          filtros={filtros}
          cambiar={cambiar}
          limpiar={limpiar}
          catalogos={catalogos}
          abierto={filtrosAbiertos}
          cerrar={() => setFiltrosAbiertos(false)}
          totalActivos={activos}
        />

        <section aria-labelledby="titulo-resultados">
          <div className="barra-resultados">
            <div>
              <h2 id="titulo-resultados">Inventario</h2>
              <span className="tenue" aria-live="polite">
                {resultado ? `${numero(resultado.total)} ${resultado.total === 1 ? 'vehículo' : 'vehículos'}` : 'Cargando…'}
              </span>
            </div>
            <div className="barra-resultados__derecha">
              <button className="btn btn--secundario btn--sm boton-filtros-movil" onClick={() => setFiltrosAbiertos(true)}>
                <SlidersHorizontal size={15} /> Filtros {activos > 0 && `(${activos})`}
              </button>
              <label className="sr-only" htmlFor="orden">Ordenar</label>
              <select id="orden" className="select" style={{ height: 36, width: 'auto', fontSize: '0.86rem' }} value={filtros.orden} onChange={(e) => cambiar({ orden: e.target.value })}>
                {ORDENES.map(([v, t]) => (
                  <option key={v} value={v}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {chips.length > 0 && (
            <div className="chips-activos">
              {chips.map(([texto, quitar], i) => (
                <span className="chip-activo" key={i}>
                  {texto}
                  <button onClick={() => (quitar.q === '' && setBusqueda(''), cambiar(quitar))} aria-label={`Quitar filtro ${texto}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {hayNuevos && (
            <div className="alerta alerta--info banner-nuevos">
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Sparkles size={16} /> Se publicaron vehículos nuevos.
              </span>
              <button className="btn btn--secundario btn--sm" onClick={() => cargar()}>
                Actualizar lista
              </button>
            </div>
          )}

          {error && <div className="alerta alerta--error">{error}</div>}

          {cargando && !resultado ? (
            <div className="rejilla">
              {Array.from({ length: 6 }, (_, i) => (
                <TarjetaEsqueleto key={i} />
              ))}
            </div>
          ) : resultado?.data.length ? (
            <>
              <div className="rejilla" style={{ opacity: cargando ? 0.6 : 1, transition: 'opacity .2s' }}>
                {resultado.data.map((v) => (
                  <TarjetaVehiculo key={v.id} v={v} destello={Boolean(destellos[v.id])} />
                ))}
              </div>
              {resultado.paginas > 1 && (
                <nav className="paginacion" aria-label="Paginación">
                  <button className="btn btn--secundario btn--sm" disabled={filtros.pagina <= 1} onClick={() => irPagina(filtros.pagina - 1)}>
                    <ChevronLeft size={16} /> Anterior
                  </button>
                  <span className="tenue">
                    Página {filtros.pagina} de {resultado.paginas}
                  </span>
                  <button className="btn btn--secundario btn--sm" disabled={filtros.pagina >= resultado.paginas} onClick={() => irPagina(filtros.pagina + 1)}>
                    Siguiente <ChevronRight size={16} />
                  </button>
                </nav>
              )}
            </>
          ) : (
            !cargando && (
              <div className="panel vacio">
                <span className="vacio__icono">
                  <CarFront size={26} />
                </span>
                <h3>No hay vehículos con esos filtros</h3>
                <p>Pruebe quitando algunos filtros o cambiando el estado de la subasta.</p>
                {activos > 0 && (
                  <button className="btn btn--secundario" onClick={limpiar}>
                    Limpiar filtros
                  </button>
                )}
              </div>
            )
          )}
        </section>
      </div>
    </>
  )
}
