import { useEffect, useRef, useState } from 'react'
import { identifyImage, type IdentifiedBook, type IdentifiedMetadata } from '../api/scan'
import { searchLibrary } from '../db/library'
import { addScannedBook, metadataToScannedBook, type ScannedBook } from '../scan'

interface BarcodeDetectorLike { detect(source: ImageBitmapSource): Promise<Array<{ rawValue?: string }>> }
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

declare global { interface Window { BarcodeDetector?: BarcodeDetectorConstructor } }

interface ScanBookProps { onCancel: () => void; onAdded: () => void }

function metadataFromLocal(item: Awaited<ReturnType<typeof searchLibrary>>[number]): IdentifiedMetadata {
  return { title: item.book.title, authors: item.book.author ? [item.book.author] : [], isbn13: item.book.isbn, cover_url: item.book.coverUrl, metadata_source: 'local cache' }
}

export function ScanBook({ onCancel, onAdded }: ScanBookProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorFrameRef = useRef<number | null>(null)
  const [scanning, setScanning] = useState(false)
  const [detectorAvailable, setDetectorAvailable] = useState(Boolean(window.BarcodeDetector))
  const [isbn, setIsbn] = useState('')
  const [result, setResult] = useState<ScannedBook | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!scanning || !streamRef.current || !videoRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    void video.play().then(() => {
    }).catch(() => setError('The camera preview could not be started.'))
  }, [scanning])

  function stopCamera() {
    if (detectorFrameRef.current !== null) cancelAnimationFrame(detectorFrameRef.current)
    detectorFrameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setScanning(false)
  }

  useEffect(() => () => stopCamera(), [])

  async function processIdentifiedImage(image: Blob, filename?: string): Promise<void> {
    stopCamera()
    setBusy(true); setError('')
    try {
      const response = await identifyImage(image, filename)
      const identified: IdentifiedBook | undefined = response.books?.[0]
      if (!identified) throw new Error(response.detected ? 'No book metadata was returned.' : 'No ISBN barcode found in the image.')
      if (!identified.metadata_found || !identified.metadata) throw new Error(identified.error || `ISBN detected: ${identified.isbn}, but book details were not found.`)
      setIsbn(identified.isbn); setResult(metadataToScannedBook(identified.isbn, identified.metadata))
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Book identification failed.'
      if (!navigator.onLine) setError(`ISBN detected: ${isbn || 'unknown'}. Book details are unavailable offline. You can scan again or add the book manually.`)
      else setError(message)
    } finally { setBusy(false) }
  }

  async function identifyCapture() {
    const video = videoRef.current
    if (!video) { setError('The camera preview is unavailable. Stop and start scanning again.'); return }
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) {
      setError('The camera preview is still warming up. Try Capture / Identify again in a moment.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!image) { setBusy(false); setError('Could not capture an image.'); return }
    await processIdentifiedImage(image, 'camera-capture.jpg')
  }

  async function identifyUploadedFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file.')
      return
    }
    await processIdentifiedImage(file, file.name)
  }

  async function findLocalMetadata(detectedIsbn: string): Promise<boolean> {
    const matches = await searchLibrary(detectedIsbn)
    if (!matches[0]) return false
    setIsbn(detectedIsbn); setResult(metadataToScannedBook(detectedIsbn, metadataFromLocal(matches[0]))); return true
  }

  async function detectFrame() {
    if (!videoRef.current || !streamRef.current || !window.BarcodeDetector) return
    try {
      const detected = await new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(videoRef.current)
      const value = detected.find((item) => item.rawValue)?.rawValue
      if (value) { if (await findLocalMetadata(value)) { stopCamera(); return }; setIsbn(value); await identifyCapture(); return }
    } catch { /* Camera frames can be unavailable while the video initializes. */ }
    detectorFrameRef.current = requestAnimationFrame(() => void detectFrame())
  }

  async function startCamera() {
    setError(''); setResult(null)
    if (!navigator.mediaDevices?.getUserMedia) { setDetectorAvailable(false); setError('Camera access is not available in this browser. Use Capture / Identify with an image file or add the book manually.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      setScanning(true)
    } catch { setError('Camera permission was denied or the camera could not be opened.') }
  }

  async function confirm() { if (!result) return; setBusy(true); try { await addScannedBook(result); onAdded() } catch { setError('The book could not be saved locally.') } finally { setBusy(false) } }

  return <section className="scan-panel"><div className="scan-heading"><div><span className="eyebrow">SCAN BOOK</span><h2>Identify a book</h2></div><button className="close-button" onClick={() => { stopCamera(); onCancel() }}>x</button></div>{result ? <div className="scan-confirmation">{result.metadata.cover_url && <img className="scan-cover" src={result.metadata.cover_url} alt="" />}<h3>{result.metadata.title || 'Untitled book'}</h3><p>{result.metadata.authors?.join(', ') || 'Unknown author'}</p><p className="scan-isbn">ISBN: {result.isbn}</p>{result.metadata.metadata_source && <p className="scan-source">Source: {result.metadata.metadata_source}</p>}<div className="form-actions"><button className="secondary" onClick={() => { setResult(null); setError('') }}>Scan again</button><button className="primary" onClick={() => void confirm()} disabled={busy}>{busy ? 'Saving...' : 'Add to library'}</button></div></div> : <><div className="camera-frame">{scanning ? <video ref={videoRef} className="camera-video" muted playsInline onLoadedData={() => { if (window.BarcodeDetector) detectorFrameRef.current = requestAnimationFrame(() => void detectFrame()) }} /> : <p>{detectorAvailable ? 'Start the camera to detect an ISBN locally.' : 'Barcode detection is unavailable. Start the camera and capture an image for identification.'}</p>}</div>{error && <p className="error">{error}</p>}{busy && <p className="scan-message">Identifying image...</p>}<div className="scan-actions">{scanning ? <button className="secondary" onClick={stopCamera}>Stop</button> : <button className="primary" onClick={() => void startCamera()}>Start scanning</button>}{scanning && <button className="primary" onClick={() => void identifyCapture()} disabled={busy}>Capture / Identify</button>}<button className="secondary" onClick={() => fileInputRef.current?.click()} disabled={busy}>Upload photo</button><input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  await identifyUploadedFile(file)
  event.target.value = ''
}} /></div><p className="scan-help">You can scan with the camera or upload a still image. The image is sent to the backend for ISBN identification.</p></>}</section>
}
