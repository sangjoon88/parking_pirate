/**
 * 해전 효과음: 파일 없이 Web Audio로 합성 (도트 게임 느낌의 짧은 소리).
 * 켜고 끄기는 이 기기에 저장. 진동은 지원하는 휴대폰에서만.
 */
const KEY = "pp_sfx";
let ctx: AudioContext | null = null;

export function sfxOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}
export function setSfxOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* 저장 못 해도 괜찮다 */
  }
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 걸러진 잡음 한 번 (포성·폭발·물보라) */
function noise(dur: number, freq: number, gain: number, type: BiquadFilterType = "lowpass", delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/** 네모파 음 하나 (팡파레) */
function tone(freq: number, start: number, dur: number, gain = 0.08, type: OscillatorType = "square") {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + start;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

function buzz(ms: number | number[]) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 진동 미지원 */
  }
}

export const sfx = {
  /** 포를 쏨. 무기에 따라 소리가 다르다 */
  fire(weapon: string | null) {
    if (!sfxOn()) return;
    if (weapon === "missile" || weapon === "hyunmoo") {
      noise(0.5, 1800, 0.25, "bandpass");
      tone(220, 0, 0.35, 0.04, "sawtooth");
    } else if (weapon === "sling") {
      noise(0.08, 2500, 0.2, "highpass");
    } else {
      noise(0.35, 400, 0.5);
    }
  },
  hit(crit: boolean, big: boolean) {
    if (sfxOn()) {
      noise(big || crit ? 0.7 : 0.4, big ? 250 : 600, big || crit ? 0.8 : 0.5);
      if (crit) tone(110, 0, 0.3, 0.1, "square");
    }
    buzz(crit || big ? 90 : 35);
  },
  splash() {
    if (sfxOn()) noise(0.45, 3000, 0.25, "highpass");
  },
  absorb() {
    if (!sfxOn()) return;
    const a = ac();
    if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.5);
    const g = a.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    o.connect(g).connect(a.destination);
    o.start(t);
    o.stop(t + 0.5);
  },
  win() {
    if (sfxOn()) [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, i === 3 ? 0.45 : 0.14));
    buzz([60, 40, 60, 40, 120]);
  },
  lose() {
    if (sfxOn()) [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.18, 0.22, 0.07, "triangle"));
    buzz(200);
  },
  sink() {
    if (sfxOn()) noise(1.4, 200, 0.4);
  },
};
