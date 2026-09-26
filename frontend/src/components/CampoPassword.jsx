import { useState } from 'react'
import { Eye, EyeOff, Check, Circle } from 'lucide-react'

/** Mismas reglas que valida el servidor (contraseña segura). */
export const REGLAS = [
  ['Entre 8 y 64 caracteres', (p) => p.length >= 8 && p.length <= 64],
  ['Una letra mayúscula', (p) => /\p{Lu}/u.test(p)],
  ['Una letra minúscula', (p) => /\p{Ll}/u.test(p)],
  ['Un número', (p) => /\d/.test(p)],
  ['Un carácter especial', (p) => /[^\p{L}\p{N}\s]/u.test(p)],
  ['Sin espacios', (p) => p.length > 0 && !/\s/.test(p)],
]
export const esSegura = (p) => REGLAS.every(([, ok]) => ok(p))

export default function CampoPassword({ id, etiqueta = 'Contraseña', valor, onCambio, error, mostrarReglas = false, autoComplete = 'current-password' }) {
  const [ver, setVer] = useState(false)
  const cumplidas = REGLAS.filter(([, ok]) => ok(valor)).length
  const pct = Math.round((cumplidas / REGLAS.length) * 100)
  const color = pct < 50 ? 'var(--bad)' : pct < 100 ? 'var(--accent)' : 'var(--ok)'
  return (
    <div className={`campo ${error ? 'campo--error' : ''}`}>
      <label htmlFor={id}>
        {etiqueta}
        <span className="campo__req">*</span>
      </label>
      <div className="input-grupo">
        <input
          id={id}
          className="input"
          style={{ paddingLeft: 12, paddingRight: 44 }}
          type={ver ? 'text' : 'password'}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button type="button" className="input-grupo__boton" onClick={() => setVer((x) => !x)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {ver ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {mostrarReglas && (
        <>
          <div className="fuerza" aria-hidden="true">
            <span style={{ width: `${valor ? pct : 0}%`, background: color }} />
          </div>
          <ul className="reglas" aria-label="Requisitos de la contraseña">
            {REGLAS.map(([texto, ok]) => {
              const cumple = ok(valor)
              return (
                <li key={texto} className={cumple ? 'ok' : ''}>
                  {cumple ? <Check size={13} /> : <Circle size={11} />} {texto}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {error && (
        <span id={`${id}-error`} className="campo__error">
          {error}
        </span>
      )}
    </div>
  )
}
