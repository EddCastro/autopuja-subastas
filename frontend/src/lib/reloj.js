/**
 * Reloj sincronizado con el SERVIDOR. Los temporizadores de las subastas se
 * calculan con la hora del servidor (no con la del equipo del usuario), así
 * todos los navegadores ven la misma cuenta regresiva.
 * Un único intervalo de 1 s notifica a los componentes suscritos.
 */
import { useSyncExternalStore } from 'react'

let desfase = 0 // ms a sumar a Date.now()
let mejorLatencia = Infinity
let instante = Date.now()
const suscriptores = new Set()
let intervalo = null

export const ahoraServidor = () => Date.now() + desfase

/** Ajusta el desfase con una muestra (hora del servidor + latencia estimada). */
export function ajustarReloj(horaServidor, latencia = 0) {
  if (!Number.isFinite(horaServidor)) return
  // Se prefieren las muestras con menor latencia (más precisas).
  if (latencia <= mejorLatencia + 40) {
    mejorLatencia = Math.min(mejorLatencia, latencia)
    desfase = horaServidor + latencia - Date.now()
  }
}

function suscribir(fn) {
  suscriptores.add(fn)
  if (!intervalo) {
    intervalo = setInterval(() => {
      instante = ahoraServidor()
      suscriptores.forEach((s) => s())
    }, 1000)
  }
  return () => {
    suscriptores.delete(fn)
    if (!suscriptores.size) {
      clearInterval(intervalo)
      intervalo = null
    }
  }
}

/** Hook: devuelve la hora del servidor y re-renderiza cada segundo. */
export function useAhora() {
  return useSyncExternalStore(suscribir, () => instante)
}
