import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VoiceMeasure } from './loudness.ts';
import { integratedLoudness, measureVoice, spokenSeconds, VOICE_LEVEL, voiceGain } from './loudness.ts';

const RATE: number = 48000;
const TONE_HZ: number = 997;

function tone(seconds: number, amplitude: number, rate: number = RATE): Float32Array {
  const samples: Float32Array = new Float32Array(Math.round(seconds * rate));
  for (let index: number = 0; index < samples.length; index += 1) samples[index] = amplitude * Math.sin((2 * Math.PI * TONE_HZ * index) / rate);
  return samples;
}

function joined(...parts: readonly Float32Array[]): Float32Array {
  const total: number = parts.reduce((sum: number, part: Float32Array): number => sum + part.length, 0);
  const out: Float32Array = new Float32Array(total);
  let at: number = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function decibels(gain: number): number {
  return 20 * Math.log10(gain);
}

void test('a full-scale 997 Hz tone reads -3.01 LUFS on one channel, at 48 and 44.1 kHz', (): void => {
  assert.ok(Math.abs(integratedLoudness([tone(2, 1)], RATE) - -3.01) < 0.05);
  assert.ok(Math.abs(integratedLoudness([tone(2, 1, 44100)], 44100) - -3.01) < 0.05);
});

void test('the tone 20 dB down reads 20 LU lower, and silence reads as no loudness at all', (): void => {
  assert.ok(Math.abs(integratedLoudness([tone(2, 0.1)], RATE) - -23.01) < 0.05);
  assert.equal(integratedLoudness([new Float32Array(RATE)], RATE), -Infinity);
});

void test('the pauses between words do not lower the loudness of a line', (): void => {
  const spoken: number = integratedLoudness([tone(2, 0.1)], RATE);
  const paused: number = integratedLoudness([joined(tone(1, 0.1), new Float32Array(RATE * 2), tone(1, 0.1))], RATE);
  const ungated: number = spoken - 10 * Math.log10(2);
  assert.ok(paused > spoken - 1);
  assert.ok(paused > ungated + 2);
});

void test('a clip shorter than one block is measured whole', (): void => {
  assert.ok(Math.abs(integratedLoudness([tone(0.25, 0.1)], RATE) - -23.01) < 0.2);
});

void test('every clip is brought to the one voice target, a quiet one up and a loud one down', (): void => {
  const loud: VoiceMeasure = measureVoice([tone(2, 0.5)], RATE);
  const quiet: VoiceMeasure = measureVoice([tone(2, 0.08)], RATE);
  assert.ok(Math.abs(loud.loudness + decibels(voiceGain(loud)) - VOICE_LEVEL.targetLufs) < 0.05);
  assert.ok(Math.abs(quiet.loudness + decibels(voiceGain(quiet)) - VOICE_LEVEL.targetLufs) < 0.05);
  assert.ok(voiceGain(loud) < 1);
  assert.ok(voiceGain(quiet) > 1);
});

void test('a raise never pushes a peak past the ceiling and never exceeds the largest boost', (): void => {
  const whisper: VoiceMeasure = { loudness: -40, peak: 0.1, seconds: 2, voicedSeconds: 2 };
  assert.ok(Math.abs(decibels(voiceGain(whisper)) - VOICE_LEVEL.mostBoostDb) < 1e-9);
  const spiky: VoiceMeasure = { loudness: -30, peak: 0.8, seconds: 2, voicedSeconds: 2 };
  assert.ok(Math.abs(decibels(0.8 * voiceGain(spiky)) - VOICE_LEVEL.ceilingDb) < 1e-9);
  assert.equal(voiceGain({ loudness: -Infinity, peak: 0, seconds: 1, voicedSeconds: 0 }), 1);
});

void test('a line is spoken until its last audible sound and a short settle, never past the end of its clip', (): void => {
  const measure: VoiceMeasure = measureVoice([joined(tone(1.5, 0.3), new Float32Array(RATE * 2))], RATE);
  assert.ok(Math.abs(measure.voicedSeconds - 1.5) < 0.01);
  assert.ok(Math.abs(measure.seconds - 3.5) < 1e-9);
  assert.ok(Math.abs(spokenSeconds(measure) - (1.5 + VOICE_LEVEL.settleSeconds)) < 0.01);
  const full: VoiceMeasure = measureVoice([tone(1, 0.3)], RATE);
  assert.equal(spokenSeconds(full), full.seconds);
});
