import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { UserPlus, LoaderCircle, CircleAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Campo from '../components/Campo'
import CampoPassword, { esSegura } from '../components/CampoPassword'

const VACIO = { nombre: '', apellido: '', correo: '', telefono: '', password: '', confirmar: '' }

export default function Registro() {
  const { registrar } = useAuth()
  const { notificar } = useToast()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const volver = sp.get('volver') || '/'
  const [d, setD] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: typeof e === 'string' ? e : e.target.value }))

  const validar = () => {
    const e = {}
    if (d.nombre.trim().length < 2) e.nombre = 'Ingrese su nombre.'
    if (d.apellido.trim().length < 2) e.apellido = 'Ingrese su apellido.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.correo.trim())) e.correo = 'Ingrese un correo válido.'
    if (d.telefono.replace(/\D/g, '').length < 8) e.telefono = 'Ingrese un teléfono válido (mínimo 8 dígitos).'
    if (!esSegura(d.password)) e.password = 'La contraseña no cumple todos los requisitos.'
    if (d.confirmar !== d.password) e.confirmar = 'Las contraseñas no coinciden.'
    return e
  }

  const enviar = async (ev) => {
    ev.preventDefault()
    setError(null)
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length) return
    setEnviando(true)
    try {
      const { confirmar: _confirmar, ...datos } = d
      const u = await registrar(datos)
      notificar({ tipo: 'exito', titulo: `¡Cuenta creada, ${u.nombre}!`, mensaje: 'Ya puede ofertar y publicar vehículos.' })
      navigate(volver.startsWith('/') ? volver : '/', { replace: true })
    } catch (err) {
      setError(err.message)
      setErrores(err.porCampo || {})
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__caja auth__caja--ancha">
        <div className="auth__cab">
          <span className="marca__logo" style={{ margin: '0 auto' }}>
            <UserPlus size={18} />
          </span>
          <h1>Crear cuenta</h1>
          <p>El registro es obligatorio para ofertar y publicar vehículos.</p>
        </div>
        <div className="panel">
          <div className="panel__cuerpo">
            <form onSubmit={enviar} noValidate>
              <div className="rejilla-campos" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
                <Campo id="nombre" etiqueta="Nombre" requerido error={errores.nombre}>
                  <input id="nombre" className="input" autoComplete="given-name" value={d.nombre} onChange={set('nombre')} />
                </Campo>
                <Campo id="apellido" etiqueta="Apellido" requerido error={errores.apellido}>
                  <input id="apellido" className="input" autoComplete="family-name" value={d.apellido} onChange={set('apellido')} />
                </Campo>
                <Campo id="correo" etiqueta="Correo electrónico" requerido error={errores.correo}>
                  <input id="correo" className="input" type="email" autoComplete="email" value={d.correo} onChange={set('correo')} />
                </Campo>
                <Campo id="telefono" etiqueta="Teléfono" requerido error={errores.telefono} ayuda="Ej. 5555-1234 o +502 5555 1234">
                  <input id="telefono" className="input" type="tel" autoComplete="tel" value={d.telefono} onChange={set('telefono')} />
                </Campo>
              </div>
              <CampoPassword id="password" valor={d.password} onCambio={set('password')} error={errores.password} mostrarReglas autoComplete="new-password" />
              <CampoPassword id="confirmar" etiqueta="Confirmar contraseña" valor={d.confirmar} onCambio={set('confirmar')} error={errores.confirmar} autoComplete="new-password" />
              {error && (
                <div className="alerta alerta--error" role="alert">
                  <CircleAlert size={18} /> {error}
                </div>
              )}
              <button className="btn btn--primario btn--lg btn--bloque" disabled={enviando}>
                {enviando ? <LoaderCircle size={18} className="girar" /> : <UserPlus size={18} />} Crear cuenta
              </button>
              <p className="tenue" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
                ¿Ya tiene cuenta? <Link to={`/login${sp.get('volver') ? `?volver=${encodeURIComponent(volver)}` : ''}`}>Inicie sesión</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
