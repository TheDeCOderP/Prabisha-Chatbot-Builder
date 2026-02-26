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

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (error: any) {
      console.error("Microphone permission denied.", error)
      setIsMicrophoneAvailable(false)
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
  }
}
