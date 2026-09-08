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
      this.analyser.fftSize = 512; // 256 bins for sharp bass separation
      this.analyser.smoothingTimeConstant = 0.76;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -25;
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

  async startSystemOrTabAudio() {
    this.stop();
    this.initContext();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) {
        console.warn('No audio track shared. User must check "Share audio" when picking tab or screen.');
        alert('Tip: When selecting a browser tab (like YouTube or Spotify), make sure the "Also share tab audio" checkbox is checked!');
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }

      // Disable video rendering so it uses 0 CPU/GPU, but DO NOT stop it (stopping video terminates capture in Chromium)
      stream.getVideoTracks().forEach((t) => {
        t.enabled = false;
      });

      // If user stops sharing from browser bar
      audioTracks[0].onended = () => {
        this.stop();
      };

      this.micStream = stream;
      this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
      this.sourceNode.connect(this.analyser);
      this.mode = 'tab';
      return true;
    } catch (err) {
      console.warn('System/Tab audio capture cancelled or failed:', err);
      this.stop();
      return false;
    }
  }

  setExternalAudioData(bands, bass, mid, treble) {
    this.mode = 'system';
    if (typeof bass === 'number') this.bass = bass;
    if (typeof mid === 'number') this.mid = mid;
    if (typeof treble === 'number') this.treble = treble;
    this.overall = (this.bass + this.mid + this.treble) / 3;

    if (Array.isArray(bands) && bands.length === 32) {
      for (let i = 0; i < 32; i++) {
        this.frequencyBands[i] = bands[i];
      }
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
    if (this.mode === 'system') {
      // In system loopback mode, values are pushed from WASAPI capture. Apply subtle damping.
      this.bass *= 0.94;
      this.mid *= 0.94;
      this.treble *= 0.94;
      this.overall *= 0.94;
      for (let i = 0; i < 32; i++) {
        this.frequencyBands[i] *= 0.94;
      }
      return;
    }

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

    // Bins: 256 total across 0 to ~24kHz (each bin is ~93.75 Hz)
    // Sub-bass & Bass: Bins 0 to 6 (0 - 280 Hz) - Includes kick drum fundamental!
    let rawBass = 0;
    for (let i = 0; i <= 6; i++) rawBass += this.dataArray[i];
    rawBass = Math.min(1.0, (rawBass / (7 * 255)) * 1.6);

    // Mids: Bins 7 to 32 (~280 - 3,000 Hz) - Vocals, snare, synth chords
    let rawMid = 0;
    for (let i = 7; i <= 32; i++) rawMid += this.dataArray[i];
    rawMid = Math.min(1.0, (rawMid / (26 * 255)) * 1.4);

    // Treble: Bins 33 to 90 (~3,000 - 8,500 Hz) - Hi-hats, cymbals, air
    let rawTreble = 0;
    for (let i = 33; i <= 90; i++) rawTreble += this.dataArray[i];
    rawTreble = Math.min(1.0, (rawTreble / (58 * 255)) * 1.6);

    // Punchy bass attack with smooth release
    this.bass = Math.max(rawBass, this.bass * 0.80);
    this.mid = rawMid;
    this.treble = rawTreble;
    this.overall = (this.bass + this.mid + this.treble) / 3;

    // 32 Frequency bars across first 96 bins (3 bins per bar)
    for (let i = 0; i < 32; i++) {
      let sum = 0;
      for (let b = 0; b < 3; b++) {
        sum += this.dataArray[i * 3 + b] || 0;
      }
      const tilt = 1.0 + (i / 32) * 1.5;
      const val = Math.min(1.0, (sum / (3 * 255)) * 1.5 * tilt);
      this.frequencyBands[i] = Math.max(val, this.frequencyBands[i] * 0.76);
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
      const height = Math.max(0.06, val * 3.2);
      bars[i].scale.y = height;
      bars[i].position.y = height / 2;
      bars[i].material.emissiveIntensity = 0.5 + val * 2.0;
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
