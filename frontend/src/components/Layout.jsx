import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Gavel, Menu, X, LogOut, LogIn, UserPlus, Plus, LayoutGrid, FolderKanban, HandCoins, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSocket, useEventoSocket } from '../context/SocketContext'
import { useToast } from '../context/ToastContext'
import { api, API_URL } from '../lib/api'
import { moneda } from '../lib/formato'

export function Encabezado() {
  const { usuario, autenticado, cerrarSesion } = useAuth()
  const { conectado } = useSocket()
  const [abierto, setAbierto] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => setAbierto(false), [location.pathname])

  const salir = () => {
    cerrarSesion()
    navigate('/')
  }

  return (
    <header className="encabezado">
      <div className="contenedor encabezado__fila">
        <Link to="/" className="marca" aria-label="AutoPuja, inicio">
          <span className="marca__logo">
            <Gavel size={19} />
          </span>
          <span>
            Auto<b>Puja</b>
          </span>
        </Link>
        <nav className={`nav ${abierto ? 'abierto' : ''}`} aria-label="Principal">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'activo' : '')}>
            <LayoutGrid size={16} /> Inventario
          </NavLink>
          <NavLink to="/publicar" className={({ isActive }) => (isActive ? 'activo' : '')}>
            <Plus size={16} /> Publicar vehículo
          </NavLink>
          {!autenticado && (
            <NavLink to="/registro" className={({ isActive }) => `solo-movil ${isActive ? 'activo' : ''}`}>
              <UserPlus size={16} /> Crear cuenta
            </NavLink>
          )}
          {autenticado && (
            <>
              <NavLink to="/mis-publicaciones" className={({ isActive }) => (isActive ? 'activo' : '')}>
                <FolderKanban size={16} /> Mis publicaciones
              </NavLink>
              <NavLink to="/mis-ofertas" className={({ isActive }) => (isActive ? 'activo' : '')}>
                <HandCoins size={16} /> Mis ofertas
              </NavLink>
            </>
          )}
        </nav>
        <div className="encabezado__derecha">
          <span className={`en-vivo ${conectado ? '' : 'en-vivo--off'}`} title={conectado ? 'Conectado en tiempo real' : 'Reconectando…'}>
            <span>{conectado ? 'En vivo' : 'Conectando'}</span>
          </span>
          {autenticado ? (
            <div className="usuario-menu">
              <span className="avatar" aria-hidden="true">
                {(usuario?.nombre?.[0] || '') + (usuario?.apellido?.[0] || '')}
              </span>
              <span className="usuario-menu__nombre">{usuario?.nombre}</span>
              <button className="btn btn--fantasma btn--sm" onClick={salir} title="Cerrar sesión" aria-label="Cerrar sesión">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn--secundario btn--sm enc-ingresar">
                <LogIn size={15} /> Ingresar
              </Link>
              <Link to="/registro" className="btn btn--primario btn--sm enc-registro">
                <UserPlus size={15} /> Registrarse
              </Link>
            </>
          )}
          <button className="btn btn--fantasma btn--sm menu-movil" onClick={() => setAbierto((x) => !x)} aria-label="Menú" aria-expanded={abierto}>
            {abierto ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  )
}

export function PiePagina() {
  return (
    <footer className="pie">
      <div className="contenedor pie__fila">
        <div>
          <Link to="/" className="marca">
            <span className="marca__logo">
              <Gavel size={19} />
            </span>
            <span>
              Auto<b>Puja</b>
            </span>
          </Link>
          <p className="tenue" style={{ marginTop: 10, fontSize: '0.9rem', maxWidth: 420 }}>
            Plataforma de subastas de vehículos en tiempo real: regístrese, encuentre y oferte. Las pujas se validan en el servidor y se actualizan al instante en todos los navegadores.
          </p>
        </div>
        <div>
          <h4>Plataforma</h4>
          <ul>
            <li><Link to="/">Inventario</Link></li>
            <li><Link to="/publicar">Publicar vehículo</Link></li>
            <li><Link to="/registro">Crear cuenta</Link></li>
          </ul>
        </div>
        <div>
          <h4>Proyecto</h4>
          <ul>
            <li><a href={`${API_URL}/api`} target="_blank" rel="noreferrer">API REST</a></li>
            <li><a href="https://github.com/EddCastro/autopuja-subastas" target="_blank" rel="noreferrer">Código en GitHub</a></li>
            <li className="tenue">Fotos de ejemplo: Pexels</li>
          </ul>
        </div>
      </div>
      <div className="contenedor pie__legal">
        <span>© {new Date().getFullYear()} AutoPuja · Proyecto académico — Eddy Adolfo Castro Véliz (1890-23-16857)</span>
        <span>Universidad Mariano Gálvez de Guatemala</span>
      </div>
    </footer>
  )
}

/** Aviso si el servidor gratuito tarda en "despertar". */
function AvisoServidor() {
  const [lento, setLento] = useState(false)
  useEffect(() => {
    let listo = false
    const t = setTimeout(() => !listo && setLento(true), 3500)
    api('/api/health')
      .catch(() => {})
      .finally(() => {
        listo = true
        clearTimeout(t)
        setLento(false)
      })
    return () => clearTimeout(t)
  }, [])
  if (!lento) return null
  return (
    <div className="aviso-servidor" role="status">
      <div className="contenedor">
        <Clock size={16} /> Activando el servidor (plan gratuito): la primera carga puede tardar hasta un minuto…
      </div>
    </div>
  )
}

/** Notificaciones globales del estado de mis pujas (en cualquier página). */
function NotificacionesPuja() {
  const { notificar } = useToast()
  const location = useLocation()
  useEventoSocket('puja:estado', async (e) => {
    if (location.pathname === `/vehiculo/${e.vehiculoId}`) return // ahí ya se ve el indicador
    let titulo = `la subasta #${e.vehiculoId}`
    try {
      titulo = (await api(`/api/vehiculos/${e.vehiculoId}`)).data.titulo
    } catch {
      /* usa el número */
    }
    const m = {
      superado: ['error', 'Tu oferta ha sido superada', `En ${titulo} la oferta actual es ${moneda(e.montoActual)}. ¡Haz tu oferta antes de que termine el tiempo!`, 'Ofertar ahora'],
      ganando: ['exito', '¡Vas ganando!', `Tienes la oferta más alta en ${titulo}.`, 'Ver subasta'],
      ganada: ['premio', '¡Ganaste la subasta!', `${titulo} por ${moneda(e.montoActual)}.`, 'Ver subasta'],
      perdida: ['info', 'Subasta finalizada', `No ganaste ${titulo}.`, 'Ver subasta'],
    }[e.estado]
    if (m) notificar({ tipo: m[0], titulo: m[1], mensaje: m[2], enlace: { texto: m[3], a: `/vehiculo/${e.vehiculoId}` }, duracion: 9000 })
  })
  return null
}

export function Layout() {
  const location = useLocation()
  useEffect(() => window.scrollTo(0, 0), [location.pathname])
  return (
    <>
      <Encabezado />
      <AvisoServidor />
      <NotificacionesPuja />
      <main>
        <Outlet />
      </main>
      <PiePagina />
    </>
  )
}

/** Protege rutas: sin sesión redirige a /login y luego regresa. */
export function RutaProtegida({ children }) {
  const { autenticado } = useAuth()
  const location = useLocation()
  if (!autenticado) return <Navigate to={`/login?volver=${encodeURIComponent(location.pathname)}`} replace />
  return children
}
