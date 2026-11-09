// 開始ボタンの操作で音声を解放する。Safariで自動再生に失敗してもゲームは止めない。
export class Soundscape {
  constructor() {
    this.context = null; this.master = null; this.volume = .58; this.muted = false;
    this.buffers = new Map(); this.loaded = false; this.active = new Set(); this.lastStep = 0;
  }
  async unlock() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      if (!this.context) {
        this.context = new Audio(); this.master = this.context.createGain(); this.master.gain.value = this.muted ? 0 : this.volume * .65; this.master.connect(this.context.destination);
        // 非常に短い無音をユーザー操作の同期部分で再生する。
        const source = this.context.createBufferSource(); source.buffer = this.context.createBuffer(1, 1, 22050); source.connect(this.master); source.start();
        this.startAmbience();
      }
      await this.context.resume();
      if (!this.loaded) { this.loaded = true; void this.loadVoices(); }
      return true;
    } catch { return false; }
  }
  async loadVoices() {
    await Promise.allSettled(['threat', 'name', 'found'].map(async name => {
      const response = await fetch(new URL(`../assets/voice-${name}.mp3`, import.meta.url));
      if (!response.ok) return;
      const buffer = await this.context.decodeAudioData(await response.arrayBuffer()); this.buffers.set(name, buffer);
    }));
  }
  setVolume(value) { this.volume = Math.max(0, Math.min(1, value)); this.applyVolume(); }
  setMuted(value) { this.muted = value; this.applyVolume(); }
  applyVolume() { if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * .65, this.context.currentTime, .08); }
  track(source) { this.active.add(source); source.addEventListener('ended', () => this.active.delete(source), { once: true }); return source; }
  noise(duration, level, filterType = 'lowpass', frequency = 1500) {
    if (!this.context) return;
    const a = this.context, n = Math.ceil(a.sampleRate * duration), buffer = a.createBuffer(1, n, a.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / n * 5);
    const source = a.createBufferSource(), gain = a.createGain(), filter = a.createBiquadFilter(); source.buffer = buffer;
    filter.type = filterType; filter.frequency.value = frequency; gain.gain.value = level;
    source.connect(filter).connect(gain).connect(this.master); this.track(source).start();
  }
  tone(from, to, duration, level = .1, type = 'sine', delay = 0) {
    if (!this.context) return;
    const a = this.context, now = a.currentTime + delay, source = a.createOscillator(), gain = a.createGain();
    source.type = type; source.frequency.setValueAtTime(from, now); source.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(Math.max(.0002, level), now + .02); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(gain).connect(this.master); this.track(source).start(now); source.stop(now + duration + .03);
  }
  startAmbience() {
    const a = this.context, duration = 3.7, buffer = a.createBuffer(1, a.sampleRate * duration, a.sampleRate), data = buffer.getChannelData(0);
    let low = 0; for (let i = 0; i < data.length; i++) { low = low * .98 + (Math.random() * 2 - 1) * .02; data[i] = low; }
    const rain = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain(); rain.buffer = buffer; rain.loop = true;
    filter.type = 'lowpass'; filter.frequency.value = 1100; gain.gain.value = .32;
    rain.connect(filter).connect(gain).connect(this.master); rain.start(); this.rain = rain;
    this.drone = a.createOscillator(); const droneGain = a.createGain(); this.drone.type = 'sine'; this.drone.frequency.value = 47; droneGain.gain.value = .023; this.drone.connect(droneGain).connect(this.master); this.drone.start();
  }
  shatter() {
    this.noise(1.9, .55, 'highpass', 2100);
    for (let i = 0; i < 11; i++) this.tone(900 + i * 327, 500 + i * 81, .25 + i * .055, .025, 'triangle', i * .027);
    this.tone(74, 24, .9, .32);
  }
  growl() { this.noise(1.1, .2, 'bandpass', 450); this.tone(112, 38, 1.3, .18, 'sawtooth'); this.tone(168, 65, 1.2, .08, 'triangle'); }
  voice(name = 'threat') {
    if (!this.context || this.muted) return;
    const buffer = this.buffers.get(name);
    if (buffer) {
      const source = this.context.createBufferSource(), gain = this.context.createGain(); source.buffer = buffer;
      source.playbackRate.value = name === 'found' ? .95 : 1; gain.gain.value = .8;
      source.connect(gain).connect(this.master); this.track(source).start();
      this.tone(78, 43, Math.min(2, buffer.duration), .035, 'triangle');
    } else if ('speechSynthesis' in window) {
      try {
        const line = new SpeechSynthesisUtterance(name === 'found' ? 'みいつけた。' : name === 'name' ? 'プリモドリ。プリモドリ。' : 'プリンにしちゃうぞ。');
        line.lang = 'ja-JP'; line.pitch = .45; line.rate = .73; line.volume = this.volume * .65;
        const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('ja')); if (voice) line.voice = voice;
        speechSynthesis.cancel(); speechSynthesis.speak(line); this.growl();
      } catch { this.growl(); }
    } else this.growl();
  }
  step(running = false) { this.noise(.12, running ? .10 : .055, 'lowpass', 900); this.tone(75, 40, .12, running ? .075 : .04); }
  enemyStep(distance) { const level = Math.max(.015, .2 - distance * .016); this.tone(60, 23, .2, level); this.noise(.15, level * .4, 'lowpass', 600); }
  creak() { this.tone(112, 160, 1.3, .035, 'triangle'); this.tone(180, 80, 1, .025, 'sawtooth', .2); }
  collect() { for (let i = 0; i < 3; i++) this.tone([440, 554, 660][i], [440, 554, 660][i], .75, .07, 'sine', i * .12); }
  shot() { this.noise(.35, .13, 'bandpass', 1000); this.tone(630, 55, .55, .15, 'sawtooth'); }
  death() { this.growl(); this.tone(140, 22, 2, .24, 'sawtooth'); this.voice('threat'); }
  win() { [220, 277, 330, 440].forEach((f, i) => this.tone(f, f, 2.8, .08, 'sine', i * .3)); }
  async pause() { try { if ('speechSynthesis' in window) speechSynthesis.cancel(); for (const source of this.active) try { source.stop(); } catch {} this.active.clear(); if (this.context?.state === 'running') await this.context.suspend(); } catch {} }
  async resume() { try { if (this.context?.state === 'suspended') await this.context.resume(); } catch {} }
}
