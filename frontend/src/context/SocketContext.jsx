import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { API_URL } from '../lib/api'
import { ajustarReloj } from '../lib/reloj'
import { useAuth } from './AuthContext'

/**
 * Conexión WebSocket (Socket.IO) compartida por toda la SPA.
 * Se reconecta con el token cuando el usuario inicia o cierra sesión, para
 * recibir sus indicadores privados (ganando / superado).
 */
const SocketContext = createContext({ socket: null, conectado: false })

export function SocketProvider({ children }) {
  const { token } = useAuth()
  const [socket, setSocket] = useState(null)
  const [conectado, setConectado] = useState(false)

  useEffect(() => {
    const s = io(API_URL || undefined, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    })
    const sincronizar = () => {
      const t0 = performance.now()
      s.emit('hora', (r) => ajustarReloj(r?.ahora, (performance.now() - t0) / 2))
    }
    s.on('connect', () => {
      setConectado(true)
      sincronizar()
    })
    s.on('disconnect', () => setConectado(false))
    setSocket(s)
    const reloj = setInterval(sincronizar, 60_000)
    return () => {
      clearInterval(reloj)
      s.close()
      setConectado(false)
    }
  }, [token])

  return <SocketContext.Provider value={{ socket, conectado }}>{children}</SocketContext.Provider>
}

export const useSocket = () => useContext(SocketContext)

/** Suscribe un manejador a un evento del servidor mientras el componente esté montado. */
export function useEventoSocket(evento, manejador) {
  const { socket } = useSocket()
  const ref = useRef(manejador)
  ref.current = manejador
  useEffect(() => {
    if (!socket) return
    const h = (datos) => ref.current(datos)
    socket.on(evento, h)
    return () => socket.off(evento, h)
  }, [socket, evento])
}

/** Ejecuta `fn` cada vez que el socket se RE-conecta (para recuperar eventos perdidos). */
export function useAlReconectar(fn) {
  const { socket } = useSocket()
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    if (!socket) return
    let desconectado = false
    const alCaer = () => (desconectado = true)
    const alVolver = () => {
      if (!desconectado) return
      desconectado = false
      ref.current()
    }
    socket.on('disconnect', alCaer)
    socket.on('connect', alVolver)
    return () => {
      socket.off('disconnect', alCaer)
      socket.off('connect', alVolver)
    }
  }, [socket])
}
