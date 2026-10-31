let enabled = true;
let volume = 0.7;
let context: AudioContext | null = null;

export function configureSound(nextEnabled: boolean, nextVolume: number): void {
  enabled = nextEnabled;
  volume = Math.min(1, Math.max(0, nextVolume));
}

function audio(): AudioContext | null {
  if (!enabled || volume <= 0) return null;
  if (!context) context = new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function tone(freq: number, duration: number, type: OscillatorType, gain = 0.06, delay = 0): void {
  const ctx = audio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  amp.gain.value = gain * volume;
  osc.connect(amp);
  amp.connect(ctx.destination);
  const start = ctx.currentTime + delay;
  osc.start(start);
  amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.stop(start + duration + 0.02);
}

export const sfx = {
  click() {
    tone(420, 0.04, 'square', 0.03);
  },
  dice() {
    tone(160, 0.07, 'square', 0.04);
    tone(120, 0.08, 'square', 0.035, 0.08);
  },
  cash() {
    tone(720, 0.1, 'sine', 0.05);
    tone(960, 0.14, 'sine', 0.04, 0.06);
  },
  jail() {
    tone(98, 0.28, 'sawtooth', 0.04);
  },
  win() {
    [523, 659, 784, 1046].forEach((freq, index) => tone(freq, 0.18, 'triangle', 0.06, index * 0.12));
  },
  build() {
    tone(520, 0.06, 'triangle', 0.04);
    tone(680, 0.09, 'triangle', 0.04, 0.07);
  },
};
