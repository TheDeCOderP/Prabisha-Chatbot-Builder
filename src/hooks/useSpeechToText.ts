import { useCallback, useEffect, useRef, useState } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Server-side speech-to-text.
//
// The browser's `webkitSpeechRecognition` is unreliable inside cross-origin iframes
// (which is exactly how the chatbot widget is embedded) — it throws
// `not-allowed` / `service-not-allowed` even when the microphone is permitted.
//
// Instead we record the mic with the Web Audio API, encode it to WAV (PCM16 — a
// format every speech model accepts), and POST it to `/api/ai/stt` for transcription.
// `getUserMedia` *does* work in a cross-origin iframe when the parent grants
// `allow="microphone"`, so this path is consistent across browsers and sites.
//
// The public API is kept identical to the old hook so the widget needs no changes,
// with one addition: `isTranscribing` (true while the server is transcribing).
// ─────────────────────────────────────────────────────────────────────────────

interface UseSpeechToTextOptions {
  continuous?: boolean
  lang?: string
}

type AudioContextCtor = typeof AudioContext

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext || null
}

function flattenChunks(chunks: Float32Array[]): Float32Array {
  let length = 0
  for (const c of chunks) length += c.length
  const out = new Float32Array(length)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

// Encode mono Float32 PCM samples to a 16-bit WAV Blob.
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  writeString(8, "WAVE")
  writeString(12, "fmt ")
  view.setUint32(16, 16, true)        // fmt chunk length
  view.setUint16(20, 1, true)         // PCM
  view.setUint16(22, 1, true)         // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate (sampleRate * blockAlign)
  view.setUint16(32, 2, true)         // block align (channels * bytesPerSample)
  view.setUint16(34, 16, true)        // bits per sample
  writeString(36, "data")
  view.setUint32(40, samples.length * 2, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([view], { type: "audio/wav" })
}

// Auto-stop tuning: end the recording after a short silence so the user doesn't have
// to tap the mic twice — this mirrors the old speech-recognition auto-stop behaviour.
const SILENCE_RMS_THRESHOLD = 0.012
const SILENCE_DURATION_MS = 1300
const MAX_RECORDING_MS = 30000

export const useSpeechToText = (options?: UseSpeechToTextOptions) => {
  const [isListening, setIsListening] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isMicrophoneAvailable, setIsMicrophoneAvailable] = useState(false)
  const [policyBlocked, setPolicyBlocked] = useState(false)
  const [policyMessage, setPolicyMessage] = useState<string | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const chunksRef = useRef<Float32Array[]>([])
  const sampleRateRef = useRef<number>(44100)
  const isListeningRef = useRef(false)

  // Silence-detection state + a ref to the latest stopListening so onaudioprocess
  // (created once per recording) can auto-stop without a stale closure.
  const lastLoudAtRef = useRef(0)
  const hasSpeechRef = useRef(false)
  const startedAtRef = useRef(0)
  const stopListeningRef = useRef<() => void>(() => { /* noop */ })

  // Keep the latest language without forcing the callbacks to be recreated.
  const langRef = useRef<string>(options?.lang ?? "en-US")
  langRef.current = options?.lang ?? "en-US"

  // Voice input is supported when we can capture the mic AND build an AudioContext.
  // This is true inside cross-origin iframes (with allow="microphone") and on every
  // modern browser, unlike webkitSpeechRecognition. False on insecure (HTTP) pages.
  const browserSupportsSpeechRecognition =
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!getAudioContextCtor()

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then(devices => setIsMicrophoneAvailable(devices.some(d => d.kind === "audioinput")))
        .catch(() => setIsMicrophoneAvailable(false))
    }
  }, [])

  const teardownAudio = useCallback(() => {
    try { processorRef.current?.disconnect() } catch { /* noop */ }
    try { sourceRef.current?.disconnect() } catch { /* noop */ }
    try { streamRef.current?.getTracks().forEach(t => t.stop()) } catch { /* noop */ }
    try { audioContextRef.current?.close() } catch { /* noop */ }
    processorRef.current = null
    sourceRef.current = null
    streamRef.current = null
    audioContextRef.current = null
  }, [])

  const transcribe = useCallback(async (blob: Blob) => {
    setIsTranscribing(true)
    try {
      const form = new FormData()
      form.append("audio", blob, "speech.wav")
      if (langRef.current) form.append("lang", langRef.current)

      const res = await fetch("/api/ai/stt", { method: "POST", body: form })
      if (!res.ok) {
        if (res.status === 429) {
          setPolicyMessage("Voice is busy — please wait a moment and try again.")
        } else {
          setPolicyMessage("Couldn't transcribe your voice. Please try again.")
        }
        return
      }
      const data = await res.json()
      const text = (data?.transcript || "").trim()
      if (text) {
        setTranscript(prev => (prev ? `${prev} ${text}` : text))
      }
    } catch (err) {
      console.error("STT request failed", err)
      setPolicyMessage("Voice service unreachable. Check your connection and try again.")
    } finally {
      setIsTranscribing(false)
    }
  }, [])

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return

    // Insecure context (HTTP) — mediaDevices is undefined and voice cannot work.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPolicyBlocked(true)
      setPolicyMessage("Voice needs a secure (HTTPS) page. Open this site over https:// to use the microphone.")
      setIsMicrophoneAvailable(false)
      return
    }

    const AudioCtx = getAudioContextCtor()
    if (!AudioCtx) {
      setPolicyBlocked(true)
      setPolicyMessage("Your browser doesn't support audio recording.")
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setPolicyBlocked(false)
      setPolicyMessage(null)
    } catch (error) {
      const name = (error as { name?: string })?.name || ""
      console.error("Microphone permission denied.", error)
      setIsMicrophoneAvailable(false)
      setPolicyBlocked(true)
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPolicyMessage("Microphone is blocked. Click the 🔒 / camera icon in the address bar and allow the microphone, then try again.")
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setPolicyMessage("No microphone found on this device.")
      } else {
        setPolicyMessage("Could not access the microphone. Please check your browser settings.")
      }
      return
    }

    try {
      const audioContext = new AudioCtx()
      // The context may start suspended under autoplay policies — startListening is
      // always triggered by a user gesture (mic tap) so resume() is allowed here.
      if (audioContext.state === "suspended") {
        await audioContext.resume().catch(() => { /* noop */ })
      }

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)

      chunksRef.current = []
      sampleRateRef.current = audioContext.sampleRate
      lastLoudAtRef.current = Date.now()
      startedAtRef.current = Date.now()
      hasSpeechRef.current = false

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const data = e.inputBuffer.getChannelData(0)
        // Copy — the underlying buffer is reused on the next callback.
        chunksRef.current.push(new Float32Array(data))

        // Track loudness for silence-based auto-stop.
        let sum = 0
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
        const rms = Math.sqrt(sum / data.length)
        const now = Date.now()
        if (rms > SILENCE_RMS_THRESHOLD) {
          lastLoudAtRef.current = now
          hasSpeechRef.current = true
        }

        const silenceElapsed = hasSpeechRef.current && now - lastLoudAtRef.current > SILENCE_DURATION_MS
        const tooLong = now - startedAtRef.current > MAX_RECORDING_MS
        if (silenceElapsed || tooLong) {
          stopListeningRef.current()
        }
      }

      source.connect(processor)
      // Connect to destination so the processor runs; onaudioprocess never writes the
      // output buffer, so nothing is played back (no feedback loop).
      processor.connect(audioContext.destination)

      streamRef.current = stream
      audioContextRef.current = audioContext
      sourceRef.current = source
      processorRef.current = processor

      isListeningRef.current = true
      setIsListening(true)
    } catch (error) {
      console.error("Failed to start audio capture", error)
      stream.getTracks().forEach(t => t.stop())
      setPolicyMessage("Could not start audio recording. Please try again.")
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!isListeningRef.current) return
    isListeningRef.current = false
    setIsListening(false)

    const samples = flattenChunks(chunksRef.current)
    const sampleRate = sampleRateRef.current
    chunksRef.current = []
    teardownAudio()

    // Require a little audio (~0.2s) before bothering the server.
    if (samples.length > sampleRate * 0.2) {
      const wav = encodeWav(samples, sampleRate)
      void transcribe(wav)
    }
  }, [teardownAudio, transcribe])

  // Keep the ref pointing at the current stopListening for onaudioprocess auto-stop.
  stopListeningRef.current = stopListening

  const resetTranscript = useCallback(() => setTranscript(""), [])

  useEffect(() => {
    return () => {
      isListeningRef.current = false
      teardownAudio()
    }
  }, [teardownAudio])

  return {
    transcript,
    isListening,
    isTranscribing,
    startListening,
    stopListening,
    resetTranscript,
    isMicrophoneAvailable,
    browserSupportsSpeechRecognition,
    policyBlocked,
    policyMessage,
  }
}
