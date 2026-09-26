/** Campo de formulario con etiqueta, ayuda y mensaje de error accesibles. */
export default function Campo({ id, etiqueta, requerido = false, error, ayuda, children, estilo }) {
  return (
    <div className={`campo ${error ? 'campo--error' : ''}`} style={estilo}>
      <label htmlFor={id}>
        {etiqueta}
        {requerido && <span className="campo__req" aria-hidden="true">*</span>}
      </label>
      {children}
      {ayuda && !error && <span className="campo__ayuda">{ayuda}</span>}
      {error && (
        <span className="campo__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
