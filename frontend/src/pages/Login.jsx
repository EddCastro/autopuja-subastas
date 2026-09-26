import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, LoaderCircle, Mail, CircleAlert, FlaskConical } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import CampoPassword from '../components/CampoPassword'
import Campo from '../components/Campo'

/** Usuarios pre-creados para que el evaluador pruebe en varios navegadores. */
export const USUARIOS_PRUEBA = [
  { nombre: 'Ana López (postor 1)', correo: 'postor1@autopuja.test', password: 'Postor1#2026' },
  { nombre: 'Carlos Méndez (postor 2)', correo: 'postor2@autopuja.test', password: 'Postor2#2026' },
  { nombre: 'María Rodas (vendedora)', correo: 'vendedor@autopuja.test', password: 'Vendedor#2026' },
]

export default function Login() {
  const { login, avisoSesion } = useAuth()
  const { notificar } = useToast()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const volver = sp.get('volver') || '/'
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [errores, setErrores] = useState({})

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    const errs = {}
    if (!correo.trim()) errs.correo = 'Ingrese su correo.'
    if (!password) errs.password = 'Ingrese su contraseña.'
    setErrores(errs)
    if (Object.keys(errs).length) return
    setEnviando(true)
    try {
      const u = await login(correo.trim(), password)
      notificar({ tipo: 'exito', titulo: `¡Bienvenido, ${u.nombre}!`, mensaje: 'Ya puede ofertar y publicar vehículos.' })
      navigate(volver.startsWith('/') ? volver : '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__caja">
        <div className="auth__cab">
          <span className="marca__logo" style={{ margin: '0 auto' }}>
            <LogIn size={18} />
          </span>
          <h1>Iniciar sesión</h1>
          <p>Ingrese para ofertar en subastas y publicar sus vehículos.</p>
        </div>
        <div className="panel">
          <div className="panel__cuerpo">
            <form onSubmit={enviar} noValidate>
              {avisoSesion && (
                <div className="alerta alerta--warn">
                  <CircleAlert size={18} /> {avisoSesion}
                </div>
              )}
              {sp.get('volver') && !avisoSesion && <div className="alerta alerta--info">Debe iniciar sesión para continuar.</div>}
              <Campo id="correo" etiqueta="Correo electrónico" requerido error={errores.correo}>
                <div className="input-grupo">
                  <Mail size={16} className="input-grupo__prefijo" aria-hidden="true" />
                  <input id="correo" className="input" style={{ paddingLeft: 36 }} type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
                </div>
              </Campo>
              <CampoPassword id="password" valor={password} onCambio={setPassword} error={errores.password} />
              {error && (
                <div className="alerta alerta--error" role="alert">
                  <CircleAlert size={18} /> {error}
                </div>
              )}
              <button className="btn btn--primario btn--lg btn--bloque" disabled={enviando}>
                {enviando ? <LoaderCircle size={18} className="girar" /> : <LogIn size={18} />} Ingresar
              </button>
              <p className="tenue" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                ¿No tiene cuenta? <Link to={`/registro${sp.get('volver') ? `?volver=${encodeURIComponent(volver)}` : ''}`}>Regístrese gratis</Link>
              </p>
            </form>
          </div>
        </div>

        <details className="panel" style={{ marginTop: 14 }}>
          <summary className="panel__cuerpo" style={{ cursor: 'pointer', fontWeight: 700, display: 'flex', gap: 8, alignItems: 'center' }}>
            <FlaskConical size={17} /> Usuarios de prueba (para evaluar en varios navegadores)
          </summary>
          <div className="panel__cuerpo usuarios-prueba" style={{ paddingTop: 0 }}>
            {USUARIOS_PRUEBA.map((u) => (
              <button type="button" key={u.correo} className="usuario-prueba" onClick={() => (setCorreo(u.correo), setPassword(u.password))}>
                <span>
                  <b style={{ display: 'block', fontSize: '0.88rem' }}>{u.nombre}</b>
                  <code>
                    {u.correo} · {u.password}
                  </code>
                </span>
                <span className="btn btn--secundario btn--sm">Usar</span>
              </button>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}
