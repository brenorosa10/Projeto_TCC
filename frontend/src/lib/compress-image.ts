const MAX_IMAGE_BYTES = 550_000
const MAX_ACTIVITY_PAYLOAD_BYTES = 11 * 1024 * 1024
const MAX_DIMENSION = 1280

export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",")
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

export function assertActivityPayloadFits(imageDataUrls: Array<string | undefined>): void {
  const total = imageDataUrls.reduce(
    (sum, url) => sum + (url ? estimateDataUrlBytes(url) : 0),
    0
  )
  if (total > MAX_ACTIVITY_PAYLOAD_BYTES) {
    throw new Error(
      "As imagens juntas ultrapassam o limite de 16 MB do MongoDB. Remova algumas ou use arquivos menores."
    )
  }
}

export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.")
  }

  const image = await loadImage(file)
  let width = image.naturalWidth || image.width
  let height = image.naturalHeight || image.height
  if (!width || !height) {
    throw new Error("Não foi possível ler as dimensões da imagem.")
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  let quality = 0.82
  let blob = await renderJpeg(image, width, height, quality)

  while (blob.size > MAX_IMAGE_BYTES && quality > 0.4) {
    quality = Math.max(0.4, quality - 0.12)
    blob = await renderJpeg(image, width, height, quality)
  }

  while (blob.size > MAX_IMAGE_BYTES && Math.max(width, height) > 480) {
    width = Math.max(1, Math.round(width * 0.75))
    height = Math.max(1, Math.round(height * 0.75))
    blob = await renderJpeg(image, width, height, 0.7)
  }

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("Não foi possível comprimir a imagem para menos de 550 KB. Tente outra foto.")
  }

  return blobToDataUrl(blob)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Não foi possível ler a imagem."))
    }
    image.src = url
  })
}

function renderJpeg(
  image: HTMLImageElement,
  width: number,
  height: number,
  quality: number
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) {
    return Promise.reject(new Error("Seu navegador não consegue comprimir imagens."))
  }
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Falha ao comprimir a imagem."))
        else resolve(blob)
      },
      "image/jpeg",
      quality
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("Falha ao ler a imagem comprimida."))
    reader.readAsDataURL(blob)
  })
}
