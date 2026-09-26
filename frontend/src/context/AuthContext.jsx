import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, configurarApi, fijarToken } from '../lib/api'
import { ajustarReloj } from '../lib/reloj'

const AuthContext = createContext(null)
const CLAVE = 'autopuja.sesion'

const leer = () => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || 'null')
  } catch {
    return null
  }
}
const guardar = (s) => {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* almacenamiento no disponible */
  }
}

export function AuthProvider({ children }) {
  const [sesion, setSesion] = useState(() => {
    const s = leer()
    fijarToken(s?.token || null)
    return s
  })
  const [verificando, setVerificando] = useState(Boolean(sesion?.token))
  const [avisoSesion, setAvisoSesion] = useState(null)

  const cerrarSesion = useCallback((motivo = null) => {
    fijarToken(null)
    guardar(null)
    setSesion(null)
    setAvisoSesion(motivo)
  }, [])

  useEffect(() => {
    configurarApi({ onSesionExpirada: (m) => cerrarSesion(m || 'Su sesión expiró. Inicie sesión de nuevo.'), onHora: ajustarReloj })
  }, [cerrarSesion])

  // Valida el token guardado al abrir la app
  useEffect(() => {
    if (!sesion?.token) return
    let vivo = true
    api('/api/auth/yo')
      .then((r) => vivo && setSesion((s) => ({ ...s, usuario: r.usuario })))
      .catch(() => {})
      .finally(() => vivo && setVerificando(false))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const iniciar = useCallback((r) => {
    const s = { token: r.token, usuario: r.usuario }
    fijarToken(s.token)
    guardar(s)
    setSesion(s)
    setAvisoSesion(null)
    return s.usuario
  }, [])

  const login = useCallback(async (correo, password) => iniciar(await api('/api/auth/login', { metodo: 'POST', cuerpo: { correo, password } })), [iniciar])
  const registrar = useCallback(async (datos) => iniciar(await api('/api/auth/registro', { metodo: 'POST', cuerpo: datos })), [iniciar])

  const valor = useMemo(
    () => ({
      usuario: sesion?.usuario || null,
      token: sesion?.token || null,
      autenticado: Boolean(sesion?.token),
      verificando,
      avisoSesion,
      login,
      registrar,
      cerrarSesion,
    }),
    [sesion, verificando, avisoSesion, login, registrar, cerrarSesion]
  )
  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
