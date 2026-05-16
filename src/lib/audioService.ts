import { WeatherType } from './environment';

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let lfoGain: GainNode | null = null;
let lfo: OscillatorNode | null = null;
let isPlaying = false;
let currentWeather: WeatherType = 'cloudy';
/** 用户环境音量 0–1，与天气基底相乘 */
let ambientVolume = 0.35;

const weatherBaseGain: Record<WeatherType, number> = {
  rain: 0.4,
  snow: 0.2,
  sunny: 0.3,
  cloudy: 0.1,
};

export const getAmbientVolume = () => ambientVolume;

export const setAmbientVolume = (volume: number) => {
  ambientVolume = Math.max(0, Math.min(1, volume));
  if (!audioCtx || !gainNode) return;
  if (ambientVolume <= 0) {
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
    isPlaying = false;
    return;
  }
  if (!isPlaying) {
    isPlaying = true;
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  }
  applyWeatherToAudio(currentWeather);
};

export const initAudio = () => {
  if (audioCtx) return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  
  audioCtx = new AudioContextClass();
  
  // Pink noise generator for gentle wind/rain sound
  const bufferSize = 2 * audioCtx.sampleRate;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
      let white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5; 
  }

  const whiteNoise = audioCtx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;

  // Filter to make it sound like distant rain/wind
  filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400; // soft rumble

  // LFO for wind gust effect
  lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.05; // very slow
  
  lfoGain = audioCtx.createGain();
  lfoGain.gain.value = 200; // modulates filter frequency
  
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  gainNode = audioCtx.createGain();
  gainNode.gain.value = 0; // start muted

  whiteNoise.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  whiteNoise.start();
  
  applyWeatherToAudio(currentWeather);
};

export const setWeatherAudio = (weather: WeatherType) => {
    currentWeather = weather;
    if (audioCtx && isPlaying) {
        applyWeatherToAudio(weather);
    }
};

const applyWeatherToAudio = (weather: WeatherType) => {
    if (!filter || !audioCtx || !lfoGain) return;
    
    // Smooth transition between weathers
    const now = audioCtx.currentTime;
    
    switch (weather) {
        case 'rain':
            filter.frequency.setTargetAtTime(1000, now, 2);
            lfoGain.gain.setTargetAtTime(100, now, 2);
            break;
        case 'snow':
            filter.frequency.setTargetAtTime(300, now, 2);
            lfoGain.gain.setTargetAtTime(50, now, 2);
            break;
        case 'sunny':
            filter.frequency.setTargetAtTime(600, now, 2);
            lfoGain.gain.setTargetAtTime(300, now, 2);
            break;
        case 'cloudy':
        default:
            filter.frequency.setTargetAtTime(400, now, 2);
            lfoGain.gain.setTargetAtTime(200, now, 2);
            break;
    }
    if (gainNode && isPlaying) {
        const target = weatherBaseGain[weather] * ambientVolume;
        gainNode.gain.setTargetAtTime(target, now, 0.25);
    }
}

export const playAudio = () => {
    if (!audioCtx) initAudio();
    if (audioCtx?.state === 'suspended') {
        audioCtx.resume();
    }
    if (gainNode) {
        isPlaying = true;
        applyWeatherToAudio(currentWeather);
    }
};

export const duckVolume = (isTyping: boolean) => {
    if (!audioCtx || !gainNode || !isPlaying) return;
    const base = weatherBaseGain[currentWeather] * ambientVolume;
    if (isTyping) {
        gainNode.gain.setTargetAtTime(base * 0.45, audioCtx.currentTime, 0.5);
    } else {
        gainNode.gain.setTargetAtTime(base, audioCtx.currentTime, 0.5);
    }
};

export const muteAudio = () => {
    if (!audioCtx || !gainNode) return;
    gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5);
    isPlaying = false;
};

export const toggleAudio = (): boolean => {
    if (isPlaying && ambientVolume > 0) {
        muteAudio();
        return false;
    }
    if (ambientVolume <= 0) ambientVolume = 0.35;
    playAudio();
    return true;
};

