import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { api, enviarFormulario } from '../lib/api'
import { useToast } from '../context/ToastContext'
import FormularioVehiculo from '../components/FormularioVehiculo'

export default function Editar() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { notificar } = useToast()
  const [v, setV] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api(`/api/vehiculos/${id}`)
      .then((r) => {
        if (!r.data.esPropietario) setError('Solo el publicador puede editar este vehículo.')
        else setV(r.data)
      })
      .catch((e) => setError(e.message))
  }, [id])

  const guardar = async (fd, onProgreso) => {
    const r = await enviarFormulario(`/api/vehiculos/${id}`, fd, { metodo: 'PUT', onProgreso })
    notificar({ tipo: 'exito', titulo: 'Publicación actualizada', mensaje: r.data.titulo })
    navigate('/mis-publicaciones')
  }

  return (
    <div className="contenedor">
      <div className="pagina-cab">
        <div>
          <Link to="/mis-publicaciones" className="tenue" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: '0.88rem' }}>
            <ArrowLeft size={15} /> Mis publicaciones
          </Link>
          <h1 style={{ marginTop: 6 }}>Editar publicación</h1>
          {v && <p>{v.titulo} · Lote #{String(v.id).padStart(5, '0')}</p>}
        </div>
      </div>
      {error ? (
        <div className="alerta alerta--error">
          <CircleAlert size={18} /> {error}
        </div>
      ) : v ? (
        <FormularioVehiculo vehiculo={v} onGuardar={guardar} textoBoton="Guardar cambios" />
      ) : (
        <div className="panel esqueleto" style={{ height: 480 }} />
      )}
    </div>
  )
}
