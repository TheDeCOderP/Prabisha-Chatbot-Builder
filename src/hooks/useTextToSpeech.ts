import { useState, useRef, useCallback } from 'react';

export const useTextToSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const isStoppingRef = useRef(false);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const stop = useCallback(() => {
    isStoppingRef.current = true;
    sourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    sourcesRef.current = [];
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const speak = async (text: string) => {
    try {
      if (isPlaying) {
        stop();
      }
      isStoppingRef.current = false;
      setIsPlaying(true);

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
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