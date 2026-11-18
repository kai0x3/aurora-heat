// Synthesized sound, no audio files: every effect is an oscillator or a burst of
// filtered noise through the Web Audio API, and the music is a small bass loop
// with a pentatonic lead pluck over it, scheduled ahead of time. A looping band
// of noise screeches while the player's tyres slide. Nothing starts until the
// player first interacts — browsers require a user gesture before audio may play.

const BASS_NOTES = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
// A pentatonic lead over the bass: sparse plucks, one every few steps.
const LEAD_NOTES = [220, 261.63, 329.63, 392, 329.63, 293.66, 261.63, 220];

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let screechGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      startEngine();
      startSiren();
      startScreech();
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function startEngine() {
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 50;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }

  function startSiren() {
    sirenOsc = context.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 660;
    sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  function startScreech() {
    // Looping noise through a high band: silent until the tyres start sliding.
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer();
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950;
    filter.Q.value = 2.5;
    screechGain = context.createGain();
    screechGain.gain.value = 0;
    noise.connect(filter);
    filter.connect(screechGain);
    screechGain.connect(master);
    noise.start();
  }

  function startMusic() {
    // A slow bass loop: one note every half second, scheduled a step at a time,
    // with a soft hat on the off-beat and a lead pluck every fourth step.
    musicTimer = window.setInterval(() => {
      if (!context || muted) return;
      const note = BASS_NOTES[musicStep % BASS_NOTES.length];
      musicStep += 1;
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = note;
      const gain = context.createGain();
      const now = context.currentTime;
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.5);
      // A soft hat tick on the off-beat keeps the loop moving.
      if (musicStep % 2 === 0) {
        const noise = context.createBufferSource();
        noise.buffer = noiseBuffer();
        const hat = context.createGain();
        hat.gain.setValueAtTime(0.03, now + 0.25);
        hat.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        noise.connect(hat);
        hat.connect(master);
        noise.start(now + 0.25);
        noise.stop(now + 0.33);
      }
      // The lead: a quiet pentatonic pluck, triangle with a fast fall.
      if (musicStep % 4 === 0) {
        const lead = context.createOscillator();
        lead.type = 'triangle';
        lead.frequency.value = LEAD_NOTES[(musicStep / 4) % LEAD_NOTES.length];
        const leadGain = context.createGain();
        leadGain.gain.setValueAtTime(0.055, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        lead.connect(leadGain);
        leadGain.connect(master);
        lead.start(now);
        lead.stop(now + 0.4);
      }
    }, 500);
  }

  let cachedNoise = null;
  function noiseBuffer() {
    if (cachedNoise) return cachedNoise;
    const length = context.sampleRate * 0.5;
    cachedNoise = context.createBuffer(1, length, context.sampleRate);
    const data = cachedNoise.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return cachedNoise;
  }

  function burst(duration, filterFreq, volume) {
    if (!context) return;
    const now = context.currentTime;
    const noise = context.createBufferSource();
    noise.buffer = noiseBuffer();
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);
    noise.stop(now + duration);
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!context) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration);
  }

  return {
    /** Call from any user gesture: creates the context and resumes it. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Call every frame: engine pitch follows speed, the siren wails while wanted, the screech follows the slide. */
    update({ driving, speed, wanted, sliding }) {
      if (!context) return;
      const now = context.currentTime;
      if (engineOsc) {
        engineOsc.frequency.setTargetAtTime(48 + Math.abs(speed) * 0.22, now, 0.08);
        engineGain.gain.setTargetAtTime(driving ? 0.05 + Math.abs(speed) * 0.00008 : 0.012, now, 0.1);
      }
      if (sirenOsc) {
        const target = wanted > 0 ? 0.045 : 0;
        sirenGain.gain.setTargetAtTime(target, now, 0.2);
        if (wanted > 0) {
          const phase = Math.floor(now * 2.4) % 2 === 0 ? 660 : 880;
          sirenOsc.frequency.setTargetAtTime(phase, now, 0.05);
        }
      }
      if (screechGain) {
        screechGain.gain.setTargetAtTime(sliding ? 0.11 : 0, now, 0.06);
      }
    },
    shot() {
      burst(0.12, 1800, 0.35);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.25);
      window.setTimeout(() => tone(880, 0.14, 'sine', 0.25), 90);
    },
    checkpoint() {
      tone(880, 0.09, 'sine', 0.22);
      window.setTimeout(() => tone(1318, 0.16, 'sine', 0.22), 80);
    },
    fail() {
      tone(220, 0.45, 'sawtooth', 0.16, 110);
      burst(0.3, 240, 0.2);
    },
    missionComplete() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.22, 'triangle', 0.28), i * 110);
      });
    },
    crash() {
      burst(0.25, 300, 0.4);
    },
    click() {
      tone(440, 0.06, 'square', 0.12);
    },
    stopMusic() {
      if (musicTimer !== null) window.clearInterval(musicTimer);
      musicTimer = null;
    },
  };
}
