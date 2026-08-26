// hooks/useHandsFreeVoice.ts
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseHandsFreeVoiceOptions {
  botName: string;
  lang?: string;
  enabled: boolean;
  onWakeWordDetected?: () => void;
  onQueryReady: (transcript: string) => void;
  isBotSpeaking: boolean;
  isBotThinking: boolean;
}

export type VoiceState = "disabled" | "sleeping" | "listening" | "processing";

export function useHandsFreeVoice({
  botName,
  lang = "en-US",
  enabled,
  onWakeWordDetected,
  onQueryReady,
  isBotSpeaking,
  isBotThinking,
}: UseHandsFreeVoiceOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>("disabled");
  const [transcript, setTranscript] = useState("");
  
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const followUpTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConversingRef = useRef<boolean>(false);

  // Stop listening helper
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  }, []);

  // Start listening helper
  const startListening = useCallback(() => {
    if (!enabled || isBotSpeaking || isBotThinking || document.hidden) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch {}
    }
  }, [enabled, isBotSpeaking, isBotThinking]);

  // Handle Speech Recognition setup
  useEffect(() => {
    if (!enabled) {
      setVoiceState("disabled");
      stopListening();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      setVoiceState(isConversingRef.current ? "listening" : "sleeping");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const currentText = (final || interim).toLowerCase().trim();
      setTranscript(currentText);

      // Mode 1: Passive Wake Word Mode (Not yet in conversation)
      if (!isConversingRef.current) {
        const cleanName = botName.toLowerCase();
        if (
          currentText.includes(cleanName) ||
          currentText.includes("hello") ||
          currentText.includes("hey")
        ) {
          isConversingRef.current = true;
          setVoiceState("listening");
          onWakeWordDetected?.();

          // Extract text spoken immediately after the wake word (e.g., "Hey Neema, what are your hours?")
          const afterName = currentText.split(cleanName)[1]?.trim();
          if (afterName && afterName.length > 3) {
            triggerQuerySubmit(afterName);
          }
        }
        return;
      }

      // Mode 2: Active Conversation Mode (Dictation with Auto-Submit)
      if (isConversingRef.current && currentText) {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (followUpTimeoutRef.current) clearTimeout(followUpTimeoutRef.current);

        // Auto-submit after 1.4s pause in speech
        silenceTimerRef.current = setTimeout(() => {
          triggerQuerySubmit(currentText);
        }, 1400);
      }
    };

    recognition.onerror = (err: any) => {
      if (err.error !== "no-speech") {
        console.error("Speech Recognition Error:", err);
      }
    };

    recognition.onend = () => {
      // Reconnect if hands-free is enabled and bot isn't speaking
      if (enabled && !isBotSpeaking && !isBotThinking && !document.hidden) {
        try {
          recognition.start();
        } catch {}
      }
    };

    recognitionRef.current = recognition;
    startListening();

    return () => {
      recognition.onend = null;
      recognition.stop();
    };
  }, [enabled, lang, botName, onWakeWordDetected, startListening, stopListening, isBotSpeaking, isBotThinking]);

  // Submit query and enter processing state
  const triggerQuerySubmit = (query: string) => {
    if (!query.trim()) return;
    setVoiceState("processing");
    onQueryReady(query);
    setTranscript("");
    stopListening();
  };

  // Follow-up window management after bot finishes speaking
  useEffect(() => {
    if (!enabled) return;

    if (isBotSpeaking || isBotThinking) {
      stopListening();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (followUpTimeoutRef.current) clearTimeout(followUpTimeoutRef.current);
    } else if (isConversingRef.current && !isBotSpeaking && !isBotThinking) {
      // Bot just finished speaking: keep mic open for a 6s follow-up window
      startListening();
      setVoiceState("listening");

      followUpTimeoutRef.current = setTimeout(() => {
        // Fall back to passive sleeping/wake word mode if no follow-up is received
        isConversingRef.current = false;
        setVoiceState("sleeping");
      }, 6000);
    }
  }, [isBotSpeaking, isBotThinking, enabled, startListening, stopListening]);

  // Privacy Safeguard: Mute mic immediately when user switches tabs or minimizes browser
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopListening();
      } else if (enabled && !isBotSpeaking && !isBotThinking) {
        startListening();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled, isBotSpeaking, isBotThinking, startListening, stopListening]);

  return {
    voiceState,
    transcript,
    resetToSleep: () => {
      isConversingRef.current = false;
      setVoiceState("sleeping");
    },
  };
}