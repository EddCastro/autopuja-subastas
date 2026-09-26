import { useNavigate } from 'react-router-dom'
import { enviarFormulario } from '../lib/api'
import { useToast } from '../context/ToastContext'
import FormularioVehiculo from '../components/FormularioVehiculo'

export default function Publicar() {
  const navigate = useNavigate()
  const { notificar } = useToast()

  const guardar = async (fd, onProgreso) => {
    const r = await enviarFormulario('/api/vehiculos', fd, { onProgreso })
    notificar({ tipo: 'exito', titulo: 'Vehículo publicado', mensaje: `${r.data.titulo} ya está en el inventario.` })
    navigate(`/vehiculo/${r.data.id}`)
  }

  return (
    <div className="contenedor">
      <div className="pagina-cab">
        <div>
          <h1>Publicar un vehículo</h1>
          <p>Complete la ficha técnica, clasifique el daño, suba al menos 5 fotos y defina la subasta.</p>
        </div>
      </div>
      <FormularioVehiculo onGuardar={guardar} />
    </div>
  )
}
