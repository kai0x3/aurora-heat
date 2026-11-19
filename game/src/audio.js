// Synthesized sound, no audio files: every effect is an oscillator or a burst
// of filtered noise through the Web Audio API, and the music is a small bass
// loop with a pentatonic lead pluck. v4 adds a till cha-ching for shop
// purchases, a rising level-up motif for Respect, a nitro whoosh, an activity
// chime, and per-weapon shot character (the shotgun booms lower and wider
// than the pistol cracks). The engine climbs through stepped gears; two
// sirens sing at once — the cruisers close, and a distant wail across the
// city whenever the heat is on. Nothing starts until the first user gesture.

const BASS_NOTES = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
const LEAD_NOTES = [220, 261.63, 329.63, 392, 329.63, 293.66, 261.63, 220];

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let ambienceGain = null;
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
      startAmbience();
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

  function startAmbience() {
    const osc = context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 740;
    const lfo = context.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.11;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 170;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 850;
    ambienceGain = context.createGain();
    ambienceGain.gain.value = 0;
    osc.connect(filter);
    filter.connect(ambienceGain);
    ambienceGain.connect(master);
    osc.start();
    lfo.start();
  }

  function startScreech() {
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
    // Audio noise is texture, not gameplay: a fixed LCG keeps even this
    // deterministic and out of the game's seeded RNG stream.
    let s = 22222;
    for (let i = 0; i < length; i += 1) {
      s = (Math.imul(s, 1103515245) + 12345) | 0;
      data[i] = ((s >>> 9) / 8388608) - 1;
    }
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
    update({ driving, speed, wanted, sliding }) {
      if (!context) return;
      const now = context.currentTime;
      if (engineOsc) {
        const s = Math.abs(speed);
        const gear = Math.min(4, Math.floor(s / 170));
        const inGear = Math.min(1, (s - gear * 170) / 170);
        const freq = 46 + gear * 7 + inGear * 52;
        engineOsc.frequency.setTargetAtTime(freq, now, 0.08);
        engineGain.gain.setTargetAtTime(driving ? 0.05 + s * 0.00008 : 0.012, now, 0.1);
      }
      if (sirenOsc) {
        const target = wanted > 0 ? 0.045 : 0;
        sirenGain.gain.setTargetAtTime(target, now, 0.2);
        if (wanted > 0) {
          const phase = Math.floor(now * 2.4) % 2 === 0 ? 660 : 880;
          sirenOsc.frequency.setTargetAtTime(phase, now, 0.05);
        }
      }
      if (ambienceGain) {
        ambienceGain.gain.setTargetAtTime(wanted > 0 ? 0.011 + wanted * 0.0016 : 0, now, 0.4);
      }
      if (screechGain) {
        screechGain.gain.setTargetAtTime(sliding ? 0.11 : 0, now, 0.06);
      }
    },
    /** Weapon-aware shot: heavier weapons boom lower. */
    shot(weapon) {
      if (weapon === 'shotgun') burst(0.22, 700, 0.5);
      else if (weapon === 'rifle') burst(0.16, 1200, 0.42);
      else if (weapon === 'smg') burst(0.07, 2100, 0.26);
      else if (weapon === 'fists') burst(0.08, 400, 0.2);
      else burst(0.12, 1800, 0.35);
    },
    pickup() {
      tone(660, 0.1, 'sine', 0.25);
      window.setTimeout(() => tone(880, 0.14, 'sine', 0.25), 90);
    },
    checkpoint() {
      tone(880, 0.09, 'sine', 0.22);
      window.setTimeout(() => tone(1318, 0.16, 'sine', 0.22), 80);
    },
    honk() {
      tone(370, 0.17, 'square', 0.055);
      tone(466, 0.17, 'square', 0.045);
    },
    fail() {
      tone(220, 0.45, 'sawtooth', 0.16, 110);
      window.setTimeout(() => tone(165, 0.4, 'sawtooth', 0.13, 82), 130);
      burst(0.3, 240, 0.2);
    },
    missionComplete() {
      [523, 659, 784, 1047].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.22, 'triangle', 0.28), i * 110);
      });
    },
    /** The till at Aurora Arms / Torque & Tone. */
    purchase() {
      tone(988, 0.09, 'square', 0.16);
      window.setTimeout(() => tone(1319, 0.16, 'square', 0.16), 80);
    },
    /** Respect level-up: a rising fifth that says the street knows your name. */
    levelUp() {
      [392, 587, 784].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.24, 'triangle', 0.26), i * 100);
      });
    },
    /** Nitro ignition: a whoosh up. */
    nitro() {
      burst(0.4, 900, 0.3);
      tone(180, 0.4, 'sawtooth', 0.10, 520);
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
