import { useEffect, useRef, useState } from "react"


declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

interface UseSpeechToTextOptions {
  continuous?: boolean
  lang?: string
}

export const useSpeechToText = (options?: UseSpeechToTextOptions) => {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [isMicrophoneAvailable, setIsMicrophoneAvailable] = useState(false)
  const [policyBlocked, setPolicyBlocked] = useState(false)
  const [policyMessage, setPolicyMessage] = useState<string | null>(null)

  // Use correct type instead of `any`
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const browserSupportsSpeechRecognition =
    typeof window !== "undefined" && "webkitSpeechRecognition" in window

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then(devices => {
          const hasMic = devices.some(device => device.kind === "audioinput")
          setIsMicrophoneAvailable(hasMic)
        })
        .catch(() => setIsMicrophoneAvailable(false))
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const startListening = async () => {
    if (isListening || !browserSupportsSpeechRecognition) return

    // Insecure context (HTTP) — mediaDevices is undefined and voice cannot work.
    // Surface a clear message instead of failing silently.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPolicyBlocked(true)
      setPolicyMessage(
        "Voice needs a secure (HTTPS) page. Open this site over https:// to use the microphone."
      )
      setIsMicrophoneAvailable(false)
      return
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      // Permission granted — clear any earlier blocked state
      setPolicyBlocked(false)
      setPolicyMessage(null)
    } catch (error: any) {
      const name = error?.name || ""
      console.error("Microphone permission denied.", error)
      setIsMicrophoneAvailable(false)
      setPolicyBlocked(true)
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPolicyMessage(
          "Microphone is blocked. Click the 🔒 / camera icon in the address bar and allow the microphone, then try again."
        )
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setPolicyMessage("No microphone found on this device.")
      } else {
        setPolicyMessage("Could not access the microphone. Please check your browser settings.")
      }
      return
    }

    setIsListening(true)

    // Type-safe webkitSpeechRecognition
    const recognition = new window.webkitSpeechRecognition()
    recognitionRef.current = recognition

    recognition.continuous = options?.continuous ?? true
    recognition.lang = options?.lang ?? "en-US"
    recognition.interimResults = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ""
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript
        }
      }
      setTranscript(prev => prev + finalTranscript)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error", event.error)
      setIsListening(false)
      recognitionRef.current = null
      // Map the most common failures so the UI can explain what happened.
      // 'not-allowed' / 'service-not-allowed' are what cross-origin iframes and
      // denied permissions typically throw.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setPolicyBlocked(true)
        setPolicyMessage(
          "Microphone access was blocked. Allow the microphone for this site (address-bar icon) and reload."
        )
      } else if (event.error === "no-speech") {
        // Not fatal — user just didn't speak; keep mic usable.
      } else if (event.error === "network") {
        setPolicyMessage("Voice service unreachable. Check your connection and try again.")
      }
    }

    recognition.start()
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }

  const resetTranscript = () => {
    setTranscript("")
  }

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    resetTranscript,
    isMicrophoneAvailable,
    browserSupportsSpeechRecognition,
    policyBlocked,
    policyMessage,
  }
}
