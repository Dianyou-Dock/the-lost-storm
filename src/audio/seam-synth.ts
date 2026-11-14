export const SEAM_SYNTH = {
  noiseSeconds: 2,
  silent: 0.0001,
  riserNoiseFrom: 220,
  riserNoiseTo: 3400,
  riserQFrom: 0.7,
  riserQTo: 5,
  riserNoiseGain: 0.3,
  riserToneFrom: 41,
  riserToneTo: 98,
  riserDetune: 1.013,
  riserToneGain: 0.22,
  riserToneCutoff: 420,
  wobbleFrom: 2.5,
  wobbleTo: 15,
  wobbleDepth: 0.55,
  riserGap: 0.05,
  riserFloor: 0.12,
  riserFadeIn: 0.25,
  riserRelease: 0.012,
  subFrom: 105,
  subTo: 36,
  subDrop: 0.28,
  subGain: 0.85,
  subDecay: 0.7,
  crackCutoff: 1100,
  crackGain: 0.5,
  crackDecay: 0.08,
  stutterRate: 34,
  stutterLength: 0.22,
  stutterGain: 0.18,
  stutterCentre: 1900,
  stutterQ: 2.2,
  tickFrom: 1300,
  tickTo: 260,
  tickLength: 0.07,
  tickGain: 0.05,
  backSubFrom: 88,
  backSubTo: 44,
  swellFromHz: 5200,
  swellToHz: 520,
  swellGain: 0.16,
  swellLength: 1.5,
  swellToneHz: 66,
  swellToneGain: 0.1,
  attack: 0.004,
} as const;

const S = SEAM_SYNTH;

function noise(context: BaseAudioContext): AudioBuffer {
  const length: number = Math.floor(context.sampleRate * S.noiseSeconds);
  const buffer: AudioBuffer = context.createBuffer(1, length, context.sampleRate);
  const data: Float32Array = buffer.getChannelData(0);
  for (let index: number = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  return buffer;
}

function noiseSource(context: BaseAudioContext, at: number, length: number): AudioBufferSourceNode {
  const source: AudioBufferSourceNode = context.createBufferSource();
  source.buffer = noise(context);
  source.loop = true;
  source.start(at);
  source.stop(at + length);
  return source;
}

function envelope(context: BaseAudioContext, at: number, peak: number, decay: number): GainNode {
  const gain: GainNode = context.createGain();
  gain.gain.setValueAtTime(S.silent, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + S.attack);
  gain.gain.exponentialRampToValueAtTime(S.silent, at + S.attack + decay);
  return gain;
}

function rise(gain: GainNode, at: number, end: number, peak: number): void {
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak * S.riserFloor, at + S.riserFadeIn);
  gain.gain.exponentialRampToValueAtTime(peak, end);
}

export function seamRiser(context: BaseAudioContext, out: AudioNode, at: number, length: number): void {
  const end: number = at + Math.max(S.riserGap * 2, length - S.riserGap);
  const hiss: AudioBufferSourceNode = noiseSource(context, at, length);
  const band: BiquadFilterNode = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.setValueAtTime(S.riserNoiseFrom, at);
  band.frequency.exponentialRampToValueAtTime(S.riserNoiseTo, end);
  band.Q.setValueAtTime(S.riserQFrom, at);
  band.Q.linearRampToValueAtTime(S.riserQTo, end);
  const hissGain: GainNode = context.createGain();
  rise(hissGain, at, end, S.riserNoiseGain);
  hissGain.gain.setValueAtTime(S.riserNoiseGain, end);
  hissGain.gain.linearRampToValueAtTime(0, end + S.riserRelease);
  hiss.connect(band).connect(hissGain).connect(out);
  const toneGain: GainNode = context.createGain();
  rise(toneGain, at, end, S.riserToneGain);
  toneGain.gain.setValueAtTime(S.riserToneGain, end);
  toneGain.gain.linearRampToValueAtTime(0, end + S.riserRelease);
  const wobble: GainNode = context.createGain();
  wobble.gain.value = 1;
  const lfo: OscillatorNode = context.createOscillator();
  lfo.frequency.setValueAtTime(S.wobbleFrom, at);
  lfo.frequency.exponentialRampToValueAtTime(S.wobbleTo, end);
  const depth: GainNode = context.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(S.wobbleDepth, end);
  lfo.connect(depth).connect(wobble.gain);
  const low: BiquadFilterNode = context.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = S.riserToneCutoff;
  for (const detune of [1, S.riserDetune]) {
    const tone: OscillatorNode = context.createOscillator();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(S.riserToneFrom * detune, at);
    tone.frequency.exponentialRampToValueAtTime(S.riserToneTo * detune, end);
    tone.connect(low);
    tone.start(at);
    tone.stop(end + S.riserRelease * 2);
  }
  low.connect(wobble).connect(toneGain).connect(out);
  lfo.start(at);
  lfo.stop(end + S.riserRelease * 2);
}

export function seamHit(context: BaseAudioContext, out: AudioNode, at: number, back: boolean): void {
  const sub: OscillatorNode = context.createOscillator();
  sub.frequency.setValueAtTime(back ? S.backSubFrom : S.subFrom, at);
  sub.frequency.exponentialRampToValueAtTime(back ? S.backSubTo : S.subTo, at + S.subDrop);
  sub.connect(envelope(context, at, S.subGain, S.subDecay)).connect(out);
  sub.start(at);
  sub.stop(at + S.subDecay + S.attack * 2);
  const crack: AudioBufferSourceNode = noiseSource(context, at, S.crackDecay * 4);
  const high: BiquadFilterNode = context.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = S.crackCutoff;
  crack.connect(high).connect(envelope(context, at, S.crackGain, S.crackDecay)).connect(out);
  const stutter: AudioBufferSourceNode = noiseSource(context, at, S.stutterLength);
  const band: BiquadFilterNode = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = S.stutterCentre;
  band.Q.value = S.stutterQ;
  const gate: GainNode = context.createGain();
  const step: number = 1 / S.stutterRate;
  gate.gain.setValueAtTime(0, at);
  for (let time: number = 0, index: number = 0; time < S.stutterLength; time += step / 2, index += 1) {
    const level: number = index % 2 === 0 ? S.stutterGain * (1 - time / S.stutterLength) : 0;
    gate.gain.setValueAtTime(level, at + time);
  }
  gate.gain.setValueAtTime(0, at + S.stutterLength);
  stutter.connect(band).connect(gate).connect(out);
  const tick: OscillatorNode = context.createOscillator();
  tick.type = 'square';
  tick.frequency.setValueAtTime(back ? S.tickTo : S.tickFrom, at);
  tick.frequency.exponentialRampToValueAtTime(back ? S.tickFrom : S.tickTo, at + S.tickLength);
  tick.connect(envelope(context, at, S.tickGain, S.tickLength)).connect(out);
  tick.start(at);
  tick.stop(at + S.tickLength + S.attack * 2);
}

export function seamReturn(context: BaseAudioContext, out: AudioNode, at: number): void {
  const air: AudioBufferSourceNode = noiseSource(context, at, S.swellLength);
  const low: BiquadFilterNode = context.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(S.swellFromHz, at);
  low.frequency.exponentialRampToValueAtTime(S.swellToHz, at + S.swellLength);
  const gain: GainNode = context.createGain();
  gain.gain.setValueAtTime(S.swellGain, at);
  gain.gain.exponentialRampToValueAtTime(S.silent, at + S.swellLength);
  air.connect(low).connect(gain).connect(out);
  const tone: OscillatorNode = context.createOscillator();
  tone.frequency.value = S.swellToneHz;
  const toneGain: GainNode = context.createGain();
  toneGain.gain.setValueAtTime(S.swellToneGain, at);
  toneGain.gain.exponentialRampToValueAtTime(S.silent, at + S.swellLength);
  tone.connect(toneGain).connect(out);
  tone.start(at);
  tone.stop(at + S.swellLength);
}
