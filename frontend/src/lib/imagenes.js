/**
 * Reduce y comprime las fotos en el navegador antes de subirlas
 * (máx. 1600 px, JPEG 82 %). Así la subida es rápida aunque la foto
 * original venga de un celular (5–10 MB).
 */
const LADO_MAX = 1600
const CALIDAD = 0.82
const TIPOS = ['image/jpeg', 'image/png', 'image/webp']

export const esImagenValida = (f) => TIPOS.includes(f.type)

async function cargar(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* intenta con <img> */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function comprimirImagen(file) {
  if (file.size < 350 * 1024 && file.type === 'image/jpeg') return file
  const img = await cargar(file)
  const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height))
  const w = Math.round(img.width * escala)
  const h = Math.round(img.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', CALIDAD))
  if (!blob) return file
  const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], nombre, { type: 'image/jpeg' })
}
