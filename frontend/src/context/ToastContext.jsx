import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, CircleAlert, Info, Trophy, X } from 'lucide-react'

const ToastContext = createContext({ notificar: () => {} })
const ICONOS = { exito: CircleCheck, error: CircleAlert, info: Info, premio: Trophy }

export function ToastProvider({ children }) {
  const [lista, setLista] = useState([])

  const cerrar = useCallback((id) => setLista((l) => l.filter((t) => t.id !== id)), [])
  const notificar = useCallback(
    ({ tipo = 'info', titulo, mensaje, enlace, duracion = 6000 }) => {
      const id = Math.random().toString(36).slice(2)
      setLista((l) => [...l.slice(-3), { id, tipo, titulo, mensaje, enlace }])
      if (duracion) setTimeout(() => cerrar(id), duracion)
    },
    [cerrar]
  )

  const valor = useMemo(() => ({ notificar }), [notificar])
  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toasts" role="region" aria-live="polite" aria-label="Notificaciones">
        {lista.map((t) => {
          const Icono = ICONOS[t.tipo] || Info
          return (
            <div key={t.id} className={`toast toast--${t.tipo}`} role="status">
              <Icono className="toast__icono" size={20} aria-hidden="true" />
              <div className="toast__cuerpo">
                {t.titulo && <strong>{t.titulo}</strong>}
                {t.mensaje && <p>{t.mensaje}</p>}
                {t.enlace && (
                  <Link to={t.enlace.a} className="toast__enlace" onClick={() => cerrar(t.id)}>
                    {t.enlace.texto}
                  </Link>
                )}
              </div>
              <button className="toast__cerrar" onClick={() => cerrar(t.id)} aria-label="Cerrar notificación">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
