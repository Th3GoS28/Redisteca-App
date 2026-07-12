import { useRef, useState } from 'react'
import { X, RotateCcw } from 'lucide-react'

export default function SignaturePad({
  onConfirm,
  onClose
}: {
  onConfirm: (dataUrl: string, receivedBy: string) => void
  onClose: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasSignature, setHasSignature] = useState(false)
  const [receivedBy, setReceivedBy] = useState('')

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1c3f73'
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  function end() {
    drawing.current = false
  }

  function clear() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  function confirm() {
    if (!hasSignature) return
    onConfirm(canvasRef.current!.toDataURL('image/png'), receivedBy)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Firma de recibido</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de quien recibe
          </label>
          <input
            value={receivedBy}
            onChange={(e) => setReceivedBy(e.target.value)}
            className="input"
            placeholder="Ej. Carlos Mendoza"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">Firma</label>
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-1 text-xs text-gray-500"
            >
              <RotateCcw className="w-3 h-3" />
              Limpiar
            </button>
          </div>
          <canvas
            ref={canvasRef}
            width={400}
            height={180}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            className="w-full border border-gray-300 rounded-lg touch-none bg-gray-50"
            style={{ height: 180 }}
          />
        </div>

        <button
          onClick={confirm}
          disabled={!hasSignature}
          className="w-full bg-redisteca-blue text-white rounded-lg py-2.5 font-medium disabled:opacity-40"
        >
          Confirmar entrega
        </button>
      </div>
    </div>
  )
}
