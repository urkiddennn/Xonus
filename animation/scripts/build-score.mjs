#!/usr/bin/env node
/**
 * Xonus promo — deterministic score generator.
 *
 * 32 seconds, 120 BPM, A minor / F major / C major / G major / A major.
 * Everything is synthesized from oscillators and filtered noise; the only
 * dependency is ffmpeg for the final MP3 encode.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const DUR = 32;
const N = SR * DUR;
const BEAT = 0.5;
const BAR = 2;

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const audioDir = resolve(root, 'assets', 'audio');
const wavPath = resolve(audioDir, 'xonus-score.wav');
const mp3Path = resolve(audioDir, 'xonus-score.mp3');

const L = new Float32Array(N);
const R = new Float32Array(N);
const sendL = new Float32Array(N);
const sendR = new Float32Array(N);

let noiseState = 0x9e3779b9;
function noise() {
  noiseState ^= noiseState << 13;
  noiseState ^= noiseState >>> 17;
  noiseState ^= noiseState << 5;
  return ((noiseState >>> 0) / 0xffffffff) * 2 - 1;
}

function panGains(pan) {
  const p = Math.max(-1, Math.min(1, pan));
  return [Math.sqrt((1 - p) / 2), Math.sqrt((1 + p) / 2)];
}

function addSample(index, value, pan = 0) {
  if (index < 0 || index >= N) return;
  const [lg, rg] = panGains(pan);
  L[index] += value * lg;
  R[index] += value * rg;
}

function addSend(index, value, pan = 0, amount = 0.25) {
  if (index < 0 || index >= N) return;
  const [lg, rg] = panGains(pan);
  sendL[index] += value * lg * amount;
  sendR[index] += value * rg * amount;
}

function envelope(t, dur, attack, decay, sustain, release) {
  if (t < 0 || t > dur) return 0;
  if (t < attack) return t / Math.max(attack, 1e-5);
  if (t < attack + decay) {
    const k = (t - attack) / Math.max(decay, 1e-5);
    return 1 - (1 - sustain) * k;
  }
  if (t < dur - release) return sustain;
  return sustain * Math.max(0, (dur - t) / Math.max(release, 1e-5));
}

function wave(type, phase) {
  const p = phase / (Math.PI * 2);
  const frac = p - Math.floor(p);
  switch (type) {
    case 'sine':
      return Math.sin(phase);
    case 'triangle':
      return 2 * Math.abs(2 * frac - 1) - 1;
    case 'saw':
      return 2 * frac - 1;
    case 'square':
      return frac < 0.5 ? 1 : -1;
    default:
      return Math.sin(phase);
  }
}

function addTone({
  start,
  dur,
  freq,
  amp = 0.1,
  type = 'sine',
  pan = 0,
  attack = 0.01,
  decay = 0.08,
  sustain = 0.7,
  release = 0.12,
  detune = 0,
  send = 0,
}) {
  const from = Math.floor(start * SR);
  const to = Math.min(N, Math.floor((start + dur) * SR));
  const phaseOffset = detune;
  for (let i = from; i < to; i += 1) {
    const t = i / SR - start;
    const env = envelope(t, dur, attack, decay, sustain, release);
    const phase = Math.PI * 2 * (freq + phaseOffset) * t;
    const value = wave(type, phase) * env * amp;
    addSample(i, value, pan);
    if (send > 0) addSend(i, value, pan, send);
  }
}

function addKick(start, amp = 0.32, pan = 0) {
  const from = Math.floor(start * SR);
  const dur = 0.45;
  const to = Math.min(N, from + Math.floor(dur * SR));
  let phase = 0;
  for (let i = from; i < to; i += 1) {
    const t = (i - from) / SR;
    const freq = 38 + 92 * Math.exp(-t * 16);
    phase += (Math.PI * 2 * freq) / SR;
    const body = Math.sin(phase) * Math.exp(-t * 7.5) * amp;
    const click = noise() * Math.exp(-t * 120) * amp * 0.18;
    addSample(i, body + click, pan);
  }
}

function addImpact(start, amp = 0.38, pan = 0) {
  const from = Math.floor(start * SR);
  const dur = 0.8;
  const to = Math.min(N, from + Math.floor(dur * SR));
  let phase = 0;
  let lp = 0;
  for (let i = from; i < to; i += 1) {
    const t = (i - from) / SR;
    const freq = 34 + 46 * Math.exp(-t * 5);
    phase += (Math.PI * 2 * freq) / SR;
    const sub = Math.sin(phase) * Math.exp(-t * 3.8) * amp;
    const n = noise();
    lp += 0.06 * (n - lp);
    const air = lp * Math.exp(-t * 7) * amp * 0.3;
    addSample(i, sub + air, pan);
  }
}

function addHat(start, amp = 0.03, pan = 0) {
  const from = Math.floor(start * SR);
  const dur = 0.055;
  const to = Math.min(N, from + Math.floor(dur * SR));
  let lp = 0;
  for (let i = from; i < to; i += 1) {
    const t = (i - from) / SR;
    const n = noise();
    lp += 0.2 * (n - lp);
    const high = n - lp;
    const env = Math.exp(-t * 70);
    addSample(i, high * env * amp, pan);
  }
}

function addTick(start, amp = 0.035, pan = 0, freq = 2600) {
  const from = Math.floor(start * SR);
  const dur = 0.045;
  const to = Math.min(N, from + Math.floor(dur * SR));
  for (let i = from; i < to; i += 1) {
    const t = (i - from) / SR;
    const click = noise() * Math.exp(-t * 240) * amp * 0.55;
    const ping = Math.sin(Math.PI * 2 * freq * t) * Math.exp(-t * 55) * amp * 0.5;
    addSample(i, click + ping, pan);
  }
}

function addChime(start, freq, amp = 0.1, pan = 0, dur = 1.6) {
  const partials = [
    [1, 1],
    [2.01, 0.44],
    [3.91, 0.2],
    [5.42, 0.08],
  ];
  for (const [ratio, gain] of partials) {
    addTone({
      start,
      dur,
      freq: freq * ratio,
      amp: amp * gain,
      type: 'sine',
      pan,
      attack: 0.004,
      decay: 0.35,
      sustain: 0.18,
      release: 0.7,
      send: 0.35,
    });
  }
}

function addPluck(start, freq, amp = 0.05, pan = 0, dur = 0.34) {
  addTone({
    start,
    dur,
    freq,
    amp,
    type: 'triangle',
    pan,
    attack: 0.004,
    decay: 0.06,
    sustain: 0.22,
    release: 0.18,
    send: 0.22,
  });
}

function addPadChord(start, dur, freqs, amp = 0.04) {
  freqs.forEach((freq, index) => {
    const pan = (index / Math.max(1, freqs.length - 1)) * 1.1 - 0.55;
    for (const cents of [-5, 4]) {
      const detune = (freq * cents) / 1200;
      addTone({
        start,
        dur,
        freq: freq + detune,
        amp,
        type: 'saw',
        pan,
        attack: 0.75,
        decay: 0.3,
        sustain: 0.74,
        release: 1.3,
        send: 0.12,
      });
    }
  });
}

function addBass(start, dur, freq, amp = 0.14, pan = 0) {
  addTone({
    start,
    dur,
    freq,
    amp,
    type: 'sine',
    pan,
    attack: 0.006,
    decay: 0.1,
    sustain: 0.72,
    release: 0.14,
  });
  addTone({
    start,
    dur,
    freq: freq * 2,
    amp: amp * 0.22,
    type: 'triangle',
    pan,
    attack: 0.006,
    decay: 0.08,
    sustain: 0.5,
    release: 0.12,
  });
}

function addRiser(start, dur, amp = 0.1, pan = 0) {
  const from = Math.floor(start * SR);
  const to = Math.min(N, Math.floor((start + dur) * SR));
  let lp = 0;
  for (let i = from; i < to; i += 1) {
    const t = (i - from) / SR;
    const progress = t / dur;
    const cutoff = 280 * Math.pow(24, progress);
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
    const n = noise();
    lp += alpha * (n - lp);
    const env = Math.pow(progress, 1.4) * (1 - Math.max(0, progress - 0.92) / 0.08);
    addSample(i, lp * env * amp, pan);
  }
  addTone({
    start,
    dur,
    freq: 180,
    amp: amp * 0.22,
    type: 'sine',
    pan,
    attack: 0.1,
    decay: 0.2,
    sustain: 1,
    release: 0.05,
  });
}

function addWhoosh(start, amp = 0.06, panFrom = -0.6, panTo = 0.6, dur = 0.5) {
  const from = Math.floor(start * SR);
  const to = Math.min(N, Math.floor((start + dur) * SR));
  let lp = 0;
  for (let i = from; i < to; i += 1) {
    const t = (i - from) / SR;
    const progress = t / dur;
    const pan = panFrom + (panTo - panFrom) * progress;
    const cutoff = 500 + 5000 * Math.sin(Math.PI * progress);
    const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
    const n = noise();
    lp += alpha * (n - lp);
    const env = Math.sin(Math.PI * progress);
    addSample(i, lp * env * amp, pan);
  }
}

function duck(start, dur) {
  const from = Math.floor(start * SR);
  const to = Math.min(N, from + Math.floor(dur * SR));
  const fade = Math.floor(0.04 * SR);
  for (let i = from; i < to; i += 1) {
    const t = i - from;
    const gain = Math.min(1, t / fade, (to - i) / fade);
    L[i] *= gain;
    R[i] *= gain;
  }
}

// ---------------------------------------------------------------------------
// Harmony and arrangement
// ---------------------------------------------------------------------------

const CHORDS = {
  Am: [110.0, 130.81, 164.81, 246.94],
  Fmaj7: [87.31, 110.0, 130.81, 164.81],
  Cmaj7: [130.81, 164.81, 196.0, 246.94],
  Gmaj: [98.0, 123.47, 146.83, 185.0],
  AMaj: [110.0, 138.59, 164.81, 220.0],
};

addPadChord(0, 4.5, CHORDS.Am, 0.045);
addPadChord(3.8, 5.7, CHORDS.Fmaj7, 0.043);
addPadChord(8.8, 6.5, CHORDS.Cmaj7, 0.045);
addPadChord(14.8, 5.5, CHORDS.Gmaj, 0.043);
addPadChord(19.8, 4.5, CHORDS.Am, 0.045);
addPadChord(23.8, 4.5, CHORDS.Fmaj7, 0.043);
addPadChord(27.8, 4.4, CHORDS.AMaj, 0.052);

// Scene 1 — first light.
addImpact(0.12, 0.34);
addChime(0.55, 880, 0.1, -0.2, 2.2);
addKick(0.5, 0.18);
addKick(2.0, 0.14);
addBass(0.5, 0.9, 55, 0.06);
addBass(1.5, 0.8, 55, 0.05);
addBass(2.5, 1.1, 55, 0.055);
addTone({ start: 1.0, dur: 0.55, freq: 1318.5, amp: 0.025, type: 'sine', pan: 0.35, attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.3, send: 0.3 });
addTone({ start: 1.16, dur: 0.5, freq: 1760, amp: 0.018, type: 'sine', pan: 0.5, attack: 0.02, decay: 0.15, sustain: 0.2, release: 0.3, send: 0.3 });
addRiser(2.8, 1.2, 0.055, 0);

// Scene 2 — the clock that will not stop.
addImpact(4.0, 0.22);
addBass(4.0, 4.6, 43.65, 0.05);
for (let t = 4.5, i = 0; t < 8.55; t += 0.25, i += 1) {
  addTick(t, i % 4 === 0 ? 0.035 : 0.018, i % 2 === 0 ? -0.25 : 0.25, 1800 + (i % 3) * 240);
}
addHat(4.9, 0.022, 0.2);
addHat(5.15, 0.018, -0.2);
addHat(5.4, 0.022, 0.2);
addHat(5.65, 0.018, -0.2);
addWhoosh(8.35, 0.055, 0.5, -0.5, 0.55);
addRiser(8.0, 1.0, 0.07, 0);

// Scene 3 — the curve, and the cut.
addImpact(9.0, 0.3);
for (let t = 9.0; t < 14.6; t += BEAT) {
  addKick(t, t % BAR < 0.01 ? 0.24 : 0.18);
  addBass(t, 0.42, 65.41, 0.075);
}
for (let t = 9.25; t < 14.5; t += 0.5) addHat(t, 0.024, t % 1 < 0.01 ? -0.3 : 0.3);
const arp = [523.25, 659.25, 783.99, 987.77, 783.99, 659.25];
for (let t = 9.5, i = 0; t < 14.6; t += 0.25, i += 1) {
  addPluck(t, arp[i % arp.length], 0.024, i % 2 === 0 ? -0.35 : 0.35, 0.22);
}
addWhoosh(12.05, 0.08, -0.5, 0.6, 0.3);
addImpact(12.15, 0.36);
addChime(12.2, 1046.5, 0.055, 0.15, 1.4);
duck(12.06, 0.2);
addRiser(13.6, 1.4, 0.06, 0);

// Scene 4 — the gate fills.
addImpact(15.0, 0.24);
addBass(15.0, 4.6, 49.0, 0.05);
addBass(17.0, 2.5, 49.0, 0.04);
for (let t = 15.5; t < 19.4; t += 0.25) addTick(t, 0.012, t % 0.5 < 0.01 ? -0.1 : 0.1, 2100);
addChime(17.55, 1318.5, 0.075, 0.0, 2.2);
addChime(17.6, 1760, 0.045, 0.2, 1.8);
addWhoosh(19.15, 0.055, 0.4, -0.4, 0.55);
addRiser(18.5, 1.3, 0.06, 0);

// Scene 5 — the constellation answers.
addImpact(20.0, 0.2);
for (let t = 20.0; t < 23.8; t += BEAT) addBass(t, 0.4, 55, 0.06);
const providerNotes = [659.25, 783.99, 880.0, 987.77, 880.0, 783.99, 659.25, 587.33];
for (let i = 0; i < 8; i += 1) addChime(20.95 + i * 0.075, providerNotes[i], 0.028, i % 2 === 0 ? -0.45 : 0.45, 1.1);
const providerArp = [440.0, 523.25, 659.25, 783.99];
for (let t = 20.5, i = 0; t < 23.6; t += 0.25, i += 1) addPluck(t, providerArp[i % 4], 0.022, i % 2 === 0 ? -0.4 : 0.4, 0.2);
addWhoosh(23.1, 0.06, -0.4, 0.5, 0.6);

// Scene 6 — four on the floor, evidence lands.
addImpact(24.0, 0.26);
for (let t = 24.0; t < 27.9; t += BEAT) {
  addKick(t, 0.28);
  addBass(t, 0.42, 43.65, 0.085);
  addHat(t + 0.25, 0.03, t % 1 < 0.01 ? -0.3 : 0.3);
}
for (let i = 0; i < 4; i += 1) addTick(24.66 + i * 0.1, 0.03, i % 2 === 0 ? -0.35 : 0.35, 2200 + i * 120);
addChime(25.3, 880, 0.045, -0.25, 1.2);
addChime(25.42, 1108.7, 0.035, 0.25, 1.1);
addRiser(26.8, 1.3, 0.075, 0);

// Scene 7 — resolve.
addImpact(28.0, 0.42);
addChime(28.15, 880, 0.11, 0, 3.0);
addChime(28.28, 1108.73, 0.07, -0.2, 2.6);
addChime(28.4, 1318.5, 0.05, 0.2, 2.4);
addBass(28.0, 3.0, 55, 0.09);
addTone({ start: 28.1, dur: 2.8, freq: 220, amp: 0.025, type: 'sine', pan: 0, attack: 0.4, decay: 0.3, sustain: 0.7, release: 1.2, send: 0.3 });

// A dotted-eighth delay on the sparkle bus.
const delaySamples = Math.floor(0.375 * SR);
for (let i = delaySamples; i < N; i += 1) {
  if (i - delaySamples >= 0) {
    L[i] += sendL[i - delaySamples] * 0.24;
    R[i] += sendR[i - delaySamples] * 0.24;
  }
  if (i - delaySamples * 2 >= 0) {
    L[i] += sendR[i - delaySamples * 2] * 0.1;
    R[i] += sendL[i - delaySamples * 2] * 0.1;
  }
}

// ---------------------------------------------------------------------------
// Master
// ---------------------------------------------------------------------------

let peak = 0;
for (let i = 0; i < N; i += 1) {
  let l = L[i];
  let r = R[i];
  l = Math.tanh(l * 1.08) * 0.92;
  r = Math.tanh(r * 1.08) * 0.92;
  const t = i / SR;
  const fadeIn = Math.min(1, t / 0.05);
  const fadeOut = t > 31.15 ? Math.max(0, (DUR - t) / 0.85) : 1;
  l *= fadeIn * fadeOut;
  r *= fadeIn * fadeOut;
  L[i] = l;
  R[i] = r;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
}

const norm = 0.9 / Math.max(peak, 1e-6);
let energy = 0;
for (let i = 0; i < N; i += 1) {
  L[i] *= norm;
  R[i] *= norm;
  energy += L[i] * L[i] + R[i] * R[i];
}

function writeWav(path) {
  const buffer = Buffer.alloc(44 + N * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + N * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(N * 4, 40);
  let offset = 44;
  for (let i = 0; i < N; i += 1) {
    const l = Math.max(-1, Math.min(1, L[i]));
    const r = Math.max(-1, Math.min(1, R[i]));
    buffer.writeInt16LE(Math.round(l * 32767), offset);
    buffer.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }
  writeFileSync(path, buffer);
}

mkdirSync(audioDir, { recursive: true });
writeWav(wavPath);

execFileSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    wavPath,
    '-af',
    'loudnorm=I=-15:TP=-1.5:LRA=9',
    '-ar',
    String(SR),
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    mp3Path,
  ],
  { stdio: 'inherit' }
);

const rms = Math.sqrt(energy / (N * 2));
console.log(`score: ${DUR}s, ${SR} Hz stereo`);
console.log(`peak target: -0.9 dBFS, rms: ${(20 * Math.log10(Math.max(rms, 1e-9))).toFixed(1)} dBFS`);
console.log(`mp3: ${mp3Path} (${(statSync(mp3Path).size / 1024).toFixed(0)} KB)`);
unlinkSync(wavPath);
