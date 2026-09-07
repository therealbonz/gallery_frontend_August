import * as THREE from 'three';

export class AudioVisualizerManager {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.micStream = null;
    this.mode = 'off'; // 'off' | 'mic' | 'beat'
    this.dataArray = null;

    // Synth Beat Generator
    this.beatTimer = null;
    this.step = 0;

    // Smoothed metrics
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.overall = 0;
    this.frequencyBands = new Float32Array(32);
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256; // 128 bins
      this.analyser.smoothingTimeConstant = 0.8;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  async startMic() {
    this.stop();
    this.initContext();
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      this.sourceNode.connect(this.analyser);
      this.mode = 'mic';
      return true;
    } catch (err) {
      console.warn('Microphone permission denied or unavailable:', err);
      this.stop();
      return false;
    }
  }

  startDemoBeat() {
    this.stop();
    this.initContext();
    this.mode = 'beat';

    // Rhythmic 120 BPM drum machine: Kick, Snare, Hi-Hat
    const intervalMs = (60 / 120 / 4) * 1000; // 16th notes = 125ms
    this.step = 0;

    this.beatTimer = setInterval(() => {
      if (this.mode !== 'beat' || !this.audioCtx) return;
      const t = this.audioCtx.currentTime;

      // 4-on-the-floor Kick on steps 0, 4, 8, 12
      if (this.step % 4 === 0) {
        this._triggerKick(t);
      }
      // Snare on steps 4, 12
      if (this.step % 8 === 4) {
        this._triggerSnare(t);
      }
      // Hi-hat on every 8th note (steps 2, 6, 10, 14)
      if (this.step % 2 === 0) {
        this._triggerHiHat(t, this.step % 4 === 2);
      }

      this.step = (this.step + 1) % 16;
    }, intervalMs);

    return true;
  }

  _triggerKick(time) {
    if (!this.audioCtx || !this.analyser) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

    gain.gain.setValueAtTime(1.0, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);

    osc.connect(gain);
    gain.connect(this.analyser);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  _triggerSnare(time) {
    if (!this.audioCtx || !this.analyser) return;
    // Noise buffer
    const bufferSize = this.audioCtx.sampleRate * 0.18;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.analyser);
    gain.connect(this.audioCtx.destination);

    noise.start(time);
    noise.stop(time + 0.2);
  }

  _triggerHiHat(time, accent = false) {
    if (!this.audioCtx || !this.analyser) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(8000, time);

    const volume = accent ? 0.35 : 0.18;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(this.analyser);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.06);
  }

  stop() {
    this.mode = 'off';
    if (this.beatTimer) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }
    this.bass = 0;
    this.mid = 0;
    this.treble = 0;
    this.overall = 0;
    this.frequencyBands.fill(0);
  }

  update() {
    if (this.mode === 'off' || !this.analyser || !this.dataArray) {
      // Smooth decay to zero
      this.bass *= 0.88;
      this.mid *= 0.88;
      this.treble *= 0.88;
      this.overall *= 0.88;
      for (let i = 0; i < 32; i++) {
        this.frequencyBands[i] *= 0.88;
      }
      return;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    // Bins: 128 total across 0 to ~22kHz
    // Sub-bass & Bass: bins 1 to 5 (20 - 150 Hz)
    let rawBass = 0;
    for (let i = 1; i <= 5; i++) rawBass += this.dataArray[i];
    rawBass = rawBass / (5 * 255);

    // Mids: bins 6 to 22 (150 - 2000 Hz)
    let rawMid = 0;
    for (let i = 6; i <= 22; i++) rawMid += this.dataArray[i];
    rawMid = rawMid / (17 * 255);

    // Treble: bins 23 to 60 (2000 - 10000 Hz)
    let rawTreble = 0;
    for (let i = 23; i <= 60; i++) rawTreble += this.dataArray[i];
    rawTreble = rawTreble / (38 * 255);

    // Exponential punch curve
    this.bass = Math.max(rawBass * 1.3, this.bass * 0.85);
    this.mid = rawMid * 1.1;
    this.treble = rawTreble * 1.2;
    this.overall = (this.bass + this.mid + this.treble) / 3;

    // 32 Frequency bars
    const binStep = Math.floor(64 / 32);
    for (let i = 0; i < 32; i++) {
      let sum = 0;
      for (let b = 0; b < binStep; b++) {
        sum += this.dataArray[i * binStep + b] || 0;
      }
      const val = sum / (binStep * 255);
      this.frequencyBands[i] = Math.max(val, this.frequencyBands[i] * 0.82);
    }
  }
}

// -------------------------------------------------------------
// 3D Three.js Equalizer Ring on Floor Grid
// -------------------------------------------------------------
export function createEqualizerRing(scene) {
  const BAR_COUNT = 32;
  const RADIUS = 2.4;
  const bars = [];
  const barGeo = new THREE.BoxGeometry(0.12, 1, 0.08);

  const group = new THREE.Group();
  group.position.y = -2.48; // Sits on top of the cyberpunk floor grid

  for (let i = 0; i < BAR_COUNT; i++) {
    const angle = (i / BAR_COUNT) * Math.PI * 2;
    const x = Math.cos(angle) * RADIUS;
    const z = Math.sin(angle) * RADIUS;

    // Color gradient around the ring: cyan -> purple -> amber -> cyan
    const hue = (i / BAR_COUNT) * 0.75 + 0.5; // vibrant cyan/magenta range
    const color = new THREE.Color().setHSL(hue % 1.0, 0.9, 0.55);

    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.6,
      roughness: 0.3,
      metalness: 0.8
    });

    const mesh = new THREE.Mesh(barGeo, mat);
    mesh.position.set(x, 0.05, z);
    mesh.rotation.y = -angle; // Face outward
    mesh.scale.set(1, 0.08, 1);
    group.add(mesh);
    bars.push(mesh);
  }

  scene.add(group);

  function update(frequencyBands, isAudioActive) {
    if (!isAudioActive) {
      group.visible = false;
      return;
    }
    group.visible = true;

    // Slowly rotate the equalizer ring
    group.rotation.y += 0.005;

    for (let i = 0; i < BAR_COUNT; i++) {
      const val = frequencyBands[i] || 0;
      const height = Math.max(0.06, val * 1.8);
      bars[i].scale.y = height;
      bars[i].position.y = height / 2;
      bars[i].material.emissiveIntensity = 0.5 + val * 1.5;
    }
  }

  function dispose() {
    scene.remove(group);
    bars.forEach((b) => {
      b.material.dispose();
    });
    barGeo.dispose();
  }

  return { update, dispose };
}
