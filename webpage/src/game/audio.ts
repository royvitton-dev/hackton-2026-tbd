let context: AudioContext | null = null;
export function playTone(frequency: number, enabled: boolean, duration = .09) {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.065, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration);
  } catch { /* Sound is optional; unavailable audio never interrupts a turn. */ }
}
