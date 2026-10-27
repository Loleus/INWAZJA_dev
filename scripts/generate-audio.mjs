#!/usr/bin/env node
/* Generuje tymczasowe dźwięki do public/audio (23 pliki WAV) — w 100% proceduralne,
   więc nie ma tu cudzej grafiki ani sampli. Podmień pliki pod tymi samymi nazwami
   na własne nagrania; silnik (src/game/audio) nie wymaga wtedy żadnych zmian.
   Użycie: node scripts/generate-audio.mjs */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 22050;
const TAU = Math.PI * 2;
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');
/** Pętle same normalizują głośność i nie mogą dostać fade'ów na granicy bufora. */
const LOOPING = new Set(['loop-basic', 'loop-fast', 'loop-tank', 'loop-boss', 'loop-megaboss', 'music-game']);

function makeBuffer(seconds) {
  return new Float32Array(Math.max(1, Math.ceil(seconds * SR)));
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wave(phase, type = 'sine') {
  const p = ((phase / TAU) % 1 + 1) % 1;
  if (type === 'square') return p < 0.5 ? 1 : -1;
  if (type === 'sawtooth') return p * 2 - 1;
  if (type === 'triangle') return p < 0.5 ? p * 4 - 1 : 3 - p * 4;
  return Math.sin(phase);
}

function addTone(buf, start, duration, f0, f1, amp, type = 'sine', decay = 3, attack = 0.008) {
  const from = Math.floor(start * SR);
  const count = Math.min(buf.length - from, Math.floor(duration * SR));
  if (count <= 0) return;
  let phase = 0;
  for (let i = 0; i < count; i++) {
    const t = i / SR;
    const k = i / count;
    const freq = f0 + (f1 - f0) * k;
    phase += (TAU * freq) / SR;
    const env = Math.min(1, t / Math.max(0.001, attack)) * Math.pow(1 - k, decay);
    buf[from + i] += wave(phase, type) * amp * env;
  }
}

function addNoise(buf, start, duration, amp, cutoff, decay, seed = 1) {
  const rnd = mulberry(seed);
  const from = Math.floor(start * SR);
  const count = Math.min(buf.length - from, Math.floor(duration * SR));
  let low = 0;
  for (let i = 0; i < count; i++) {
    const white = rnd() * 2 - 1;
    low += (white - low) * cutoff;
    const k = i / count;
    const env = Math.min(1, i / 60) * Math.pow(1 - k, decay);
    buf[from + i] += low * amp * env;
  }
}

function thump(buf, start, duration, f0, f1, amp, noise = 0) {
  addTone(buf, start, duration, f0, f1, amp, 'sine', 3.6, 0.004);
  if (noise) addNoise(buf, start, duration * 0.55, amp * noise, 0.22, 5, 7);
}

function normalize(buf, peak = 0.85) {
  let top = 0;
  for (let i = 0; i < buf.length; i++) top = Math.max(top, Math.abs(buf[i]));
  if (!top) return;
  const scale = peak / top;
  for (let i = 0; i < buf.length; i++) buf[i] *= scale;
}

/** Bardzo krótkie wejście/wyjście usuwa trzask przy starcie i końcu sample'a. */
function deClick(buf, ms = 4) {
  const n = Math.floor((ms / 1000) * SR);
  for (let i = 0; i < n && i < buf.length; i++) {
    const k = i / n;
    buf[i] *= k;
    buf[buf.length - 1 - i] *= k;
  }
}

function loopTone(buf, freq, amp, type) {
  const duration = buf.length / SR;
  // Pełna liczba okresów w buforze → pętla bez kliknięcia.
  const f = Math.max(1, Math.round(freq * duration)) / duration;
  let phase = 0;
  for (let i = 0; i < buf.length; i++) {
    phase += (TAU * f) / SR;
    buf[i] += wave(phase, type) * amp;
  }
}

function loopLfo(buf, freq, depth) {
  const duration = buf.length / SR;
  const f = Math.max(1, Math.round(freq * duration)) / duration;
  for (let i = 0; i < buf.length; i++) {
    const t = i / SR;
    buf[i] *= 1 - depth + depth * (0.5 + 0.5 * Math.sin(TAU * f * t));
  }
}

function engineLoop(seconds, base, flavor, lfoHz) {
  const buf = makeBuffer(seconds);
  const harmonics = flavor === 'square' ? [1, 0.32, 0.18, 0.1, 0.06] : [1, 0.5, 0.32, 0.22, 0.14];
  harmonics.forEach((amp, index) => {
    loopTone(buf, base * (index + 1), amp * 0.2, flavor);
    loopTone(buf, base * (index + 1) * 1.006, amp * 0.1, 'sine');
  });
  loopLfo(buf, lfoHz, 0.35);
  normalize(buf, 0.55);
  return buf;
}

const builders = {
  'ui-click': (b) => {
    addTone(b, 0, 0.07, 940, 700, 0.5, 'triangle', 4);
    addNoise(b, 0, 0.02, 0.2, 0.55, 6, 11);
  },
  'ui-select': (b) => {
    addTone(b, 0, 0.07, 520, 620, 0.35, 'triangle', 3);
    addTone(b, 0.05, 0.1, 720, 880, 0.32, 'triangle', 3);
  },
  'ui-wave': (b) => {
    [392, 523, 659].forEach((f, i) => addTone(b, i * 0.095, 0.16, f, f, 0.3, 'triangle', 2.5));
    addTone(b, 0, 0.36, 98, 98, 0.18, 'sine', 1.6, 0.02);
  },
  'ui-start': (b) => {
    addTone(b, 0, 0.5, 110, 110, 0.32, 'sine', 1.4, 0.03);
    [196, 262, 392].forEach((f, i) => addTone(b, i * 0.11, 0.32, f, f, 0.22, 'sawtooth', 2));
    addNoise(b, 0, 0.25, 0.08, 0.12, 3, 13);
  },
  'ui-victory': (b) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => addTone(b, i * 0.15, 0.55, f, f, 0.24, 'triangle', 2.2, 0.01));
    addTone(b, 0, 1.25, 261.63, 261.63, 0.1, 'sine', 1.2, 0.1);
    addNoise(b, 0.4, 0.6, 0.04, 0.6, 3, 17);
  },
  'ui-defeat': (b) => {
    [392, 329.63, 277.18, 196].forEach((f, i) => addTone(b, i * 0.22, 0.6, f, f, 0.2, 'sawtooth', 2, 0.01));
    addTone(b, 0, 1.15, 98, 92, 0.22, 'sine', 1.2, 0.06);
  },
  'tower-place': (b) => {
    thump(b, 0, 0.23, 180, 52, 0.6, 0.25);
    addTone(b, 0.02, 0.05, 1300, 900, 0.2, 'triangle', 4);
  },
  'tower-upgrade-1': (b) => {
    addTone(b, 0, 0.1, 620, 620, 0.28, 'triangle', 2.5);
    addTone(b, 0.08, 0.14, 940, 940, 0.26, 'triangle', 2.5);
    addNoise(b, 0.04, 0.2, 0.05, 0.6, 3, 19);
  },
  'tower-upgrade-2': (b) => {
    [700, 1050, 1400].forEach((f, i) => addTone(b, i * 0.075, 0.12, f, f, 0.24, 'triangle', 2.3));
    addNoise(b, 0.02, 0.26, 0.06, 0.7, 3, 23);
  },
  'shot-arrow': (b) => {
    addNoise(b, 0, 0.09, 0.3, 0.35, 3, 29);
    addTone(b, 0, 0.08, 1350, 760, 0.22, 'triangle', 3);
  },
  'shot-cannon': (b) => {
    thump(b, 0, 0.22, 165, 46, 0.55, 0.5);
    addNoise(b, 0, 0.16, 0.18, 0.18, 3, 31);
  },
  'shot-frost': (b) => {
    addTone(b, 0, 0.16, 1450, 2150, 0.26, 'sine', 2.5);
    addTone(b, 0.02, 0.12, 2900, 3300, 0.1, 'sine', 3);
  },
  'shot-lightning': (b) => {
    addNoise(b, 0, 0.14, 0.34, 0.75, 3.5, 37);
    [0, 0.045, 0.085].forEach((start, i) => addTone(b, start, 0.03, 1600 + i * 500, 2200, 0.12, 'square', 5));
  },
  'explosion-enemy': (b) => {
    addNoise(b, 0, 0.34, 0.6, 0.16, 2.4, 41);
    thump(b, 0, 0.28, 120, 38, 0.38, 0.2);
  },
  'explosion-boss': (b) => {
    addNoise(b, 0, 0.7, 0.65, 0.09, 1.9, 43);
    thump(b, 0, 0.6, 90, 28, 0.6, 0.3);
    addTone(b, 0.15, 0.5, 60, 34, 0.25, 'sine', 1.8);
  },
  'explosion-megaboss': (b) => {
    addNoise(b, 0, 1.1, 0.7, 0.07, 1.6, 47);
    thump(b, 0, 1.0, 65, 22, 0.7, 0.35);
    addTone(b, 0.2, 0.85, 48, 26, 0.32, 'sine', 1.5);
  },
  'base-hit': (b) => {
    thump(b, 0, 0.46, 240, 42, 0.62, 0.4);
    addTone(b, 0.04, 0.3, 392, 118, 0.16, 'sawtooth', 2.6);
    addNoise(b, 0, 0.14, 0.15, 0.3, 4, 53);
  },
  'loop-basic': () => engineLoop(1.4, 85, 'sawtooth', 3),
  'loop-fast': () => engineLoop(1.2, 125, 'sawtooth', 6),
  'loop-tank': () => engineLoop(1.6, 55, 'square', 2.5),
  'loop-boss': () => engineLoop(1.7, 42, 'sawtooth', 2),
  'loop-megaboss': () => engineLoop(1.8, 32, 'square', 1.6),
  'music-game': (b) => {
    // 8 s = cztery takty po 2 s (120 BPM). Tonacja molowa, spokojny puls pod rozgrywkę.
    const chords = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [164.81, 196, 261.63], // C/E
      [196, 246.94, 293.66], // G
    ];
    chords.forEach((chord, bar) => {
      const start = bar * 2;
      chord.forEach((f) => addTone(b, start, 1.9, f, f, 0.085, 'triangle', 1.4, 0.22));
      addTone(b, start, 1.9, (chord[0] / 2) * 1.005, (chord[0] / 2) * 1.005, 0.1, 'sawtooth', 1.3, 0.25);
      for (let beat = 0; beat < 4; beat++) {
        const t = start + beat * 0.5;
        addTone(b, t, 0.34, chord[0] / 2, chord[0] / 2, 0.16, 'sine', 2.2, 0.005);
        addTone(b, t, 0.09, 55, 38, 0.09, 'sine', 3.5, 0.002);
        if (beat % 2 === 1) addNoise(b, t, 0.06, 0.035, 0.7, 4, 50 + bar * 4 + beat);
      }
      for (let step = 0; step < 8; step++) {
        const note = chord[step % chord.length] * 2;
        addTone(b, start + step * 0.25, 0.14, note, note, 0.032, 'triangle', 2.6, 0.004);
      }
    });
    normalize(b, 0.55);
    deClick(b, 6);
  },
};

function encodeWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buffer;
}

const lengths = {
  'ui-click': 0.1,
  'ui-select': 0.2,
  'ui-wave': 0.45,
  'ui-start': 0.65,
  'ui-victory': 1.4,
  'ui-defeat': 1.3,
  'tower-place': 0.3,
  'tower-upgrade-1': 0.4,
  'tower-upgrade-2': 0.45,
  'shot-arrow': 0.16,
  'shot-cannon': 0.3,
  'shot-frost': 0.2,
  'shot-lightning': 0.2,
  'explosion-enemy': 0.4,
  'explosion-boss': 0.8,
  'explosion-megaboss': 1.25,
  'base-hit': 0.55,
  'music-game': 8,
};

await fs.mkdir(OUT, { recursive: true });
let total = 0;
for (const [id, build] of Object.entries(builders)) {
  const target = makeBuffer(lengths[id] ?? 1);
  const produced = build(target);
  const samples = produced instanceof Float32Array ? produced : target;
  if (!LOOPING.has(id)) {
    normalize(samples, 0.85);
    deClick(samples, 3);
  }
  const wav = encodeWav(samples);
  await fs.writeFile(path.join(OUT, id + '.wav'), wav);
  total += wav.length;
  console.log(String(id + '.wav').padEnd(28), (wav.length / 1024).toFixed(1).padStart(7) + ' KB');
}
console.log(`\nRazem: ${(total / 1024).toFixed(0)} KB w ${OUT}`);
