import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { SearchX } from 'lucide-react'
import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { ToastProvider } from './context/ToastContext'
import { Layout, RutaProtegida } from './components/Layout'
import Inicio from './pages/Inicio'
import Detalle from './pages/Detalle'
import Login from './pages/Login'
import Registro from './pages/Registro'
import Publicar from './pages/Publicar'
import Editar from './pages/Editar'
import MisPublicaciones from './pages/MisPublicaciones'
import MisOfertas from './pages/MisOfertas'

function NoEncontrado() {
  return (
    <div className="contenedor" style={{ padding: '48px 16px' }}>
      <div className="panel vacio">
        <span className="vacio__icono">
          <SearchX size={26} />
        </span>
        <h3>Página no encontrada</h3>
        <Link className="btn btn--primario" to="/">
          Ir al inventario
        </Link>
      </div>
    </div>
  )
}

const privada = (el) => <RutaProtegida>{el}</RutaProtegida>

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Inicio />} />
                <Route path="vehiculo/:id" element={<Detalle />} />
                <Route path="login" element={<Login />} />
                <Route path="registro" element={<Registro />} />
                <Route path="publicar" element={privada(<Publicar />)} />
                <Route path="editar/:id" element={privada(<Editar />)} />
                <Route path="mis-publicaciones" element={privada(<MisPublicaciones />)} />
                <Route path="mis-ofertas" element={privada(<MisOfertas />)} />
                <Route path="*" element={<NoEncontrado />} />
              </Route>
            </Routes>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
