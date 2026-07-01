import { useState, useRef, useCallback } from 'react';
import { getTTSAudioContext } from '@/lib/tts-audio';

export const useTextToSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const nextStartTimeRef = useRef<number>(0);
  const isStoppingRef = useRef(false);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current = [];
    // NOTE: we deliberately do NOT close the AudioContext — it's a shared, gesture-unlocked
    // singleton (see lib/tts-audio). Closing it would re-lock audio for the next reply.
    setIsPlaying(false);
  }, []);

  const speak = async (text: string) => {
    try {
      if (isPlaying) {
        stop();
      }
      isStoppingRef.current = false;
      setIsPlaying(true);

      // Reuse the shared context that was unlocked on the mic tap so deferred voice-to-voice
      // playback is allowed by the browser's autoplay policy.
      const ctx = getTTSAudioContext();
      if (!ctx) { setIsPlaying(false); return; }
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      nextStartTimeRef.current = ctx.currentTime;

      const response = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const SAMPLE_RATE = 24000;
      let leftover: Uint8Array | null = null;

      while (true) {
        if (isStoppingRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;

        let combined = value;
        if (leftover) {
          const newCombined = new Uint8Array(leftover.length + value.length);
          newCombined.set(leftover);
          newCombined.set(value, leftover.length);
          combined = newCombined;
          leftover = null;
        }

        const bytesPerSample = 2; // Int16
        const samplesCount = Math.floor(combined.length / bytesPerSample);
        const processedLength = samplesCount * bytesPerSample;
        
        if (processedLength < combined.length) {
          leftover = combined.slice(processedLength);
        }

        if (samplesCount === 0) continue;

        // Convert Int16 PCM to Float32 for Web Audio
        const dataView = new DataView(combined.buffer, combined.byteOffset, processedLength);
        const float32Data = new Float32Array(samplesCount);
        
        for (let i = 0; i < samplesCount; i++) {
          const int16 = dataView.getInt16(i * 2, true);
          float32Data[i] = int16 / 32768.0;
        }

        const buffer = ctx.createBuffer(1, samplesCount, SAMPLE_RATE);
        buffer.getChannelData(0).set(float32Data);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
        source.start(startTime);
        nextStartTimeRef.current = startTime + buffer.duration;
        sourcesRef.current.push(source);

        source.onended = () => {
          sourcesRef.current = sourcesRef.current.filter(s => s !== source);
        };
      }

      // Check if playback has finished
      const checkPlaybackEnded = () => {
        if (isStoppingRef.current) return;
        if (ctx.currentTime >= nextStartTimeRef.current) {
          setIsPlaying(false);
        } else {
          setTimeout(checkPlaybackEnded, 100);
        }
      };
      checkPlaybackEnded();

    } catch (error) {
      console.error("TTS Playback Error:", error);
      setIsPlaying(false);
    }
  };

  return { speak, stop, isPlaying };
};