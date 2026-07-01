// Shared, gesture-unlocked AudioContext for TTS playback.
//
// Browsers keep an AudioContext "suspended" until it is resumed in response to a real
// user gesture. Voice-to-voice plays the bot's reply several seconds AFTER the mic tap,
// with no gesture in the call stack — so a freshly-created context stays suspended and
// nothing is audible. The fix: create + resume ONE shared context DURING the mic tap
// (unlockTTSAudio) and reuse that same running context for the deferred playback.

let sharedCtx: AudioContext | null = null;

type Ctor = typeof AudioContext;

function getCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext || null;
}

export function getTTSAudioContext(): AudioContext | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new Ctor();
  return sharedCtx;
}

// Call from inside a user-gesture handler (e.g. the mic tap) so later programmatic
// TTS playback is allowed. Safe to call repeatedly.
export function unlockTTSAudio(): void {
  try {
    const c = getTTSAudioContext();
    if (c && c.state === 'suspended') void c.resume().catch(() => {});
  } catch { /* noop */ }
}
