/**
 * J.A.R.V.I.S. SYSTEM CONTROLLER - CLIENT ENGINE
 * Handles Holographic Arc Reactor visualizer, Web Speech recognition/synthesis,
 * real-time WebSocket telemetry, and macOS automation execution.
 */

// ===================================================================
// 1. SOUND SYNTHESIZER (WEB AUDIO API - ZERO DEPENDENCY)
// ===================================================================
class JarvisAudioFX {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, gainVal = 0.1) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio context may be restricted before user gesture
    }
  }

  bootSound() {
    this.playTone(440, 'sine', 0.15, 0.08);
    setTimeout(() => this.playTone(880, 'sine', 0.25, 0.1), 120);
    setTimeout(() => this.playTone(1760, 'sine', 0.4, 0.12), 260);
  }

  listenChime() {
    this.playTone(520, 'triangle', 0.1, 0.08);
    setTimeout(() => this.playTone(1040, 'sine', 0.18, 0.1), 80);
  }

  ackChime() {
    this.playTone(800, 'sine', 0.08, 0.08);
    setTimeout(() => this.playTone(1200, 'triangle', 0.15, 0.1), 90);
  }

  errorChime() {
    this.playTone(280, 'sawtooth', 0.2, 0.1);
    setTimeout(() => this.playTone(220, 'sawtooth', 0.3, 0.12), 150);
  }

  tick() {
    this.playTone(1800, 'square', 0.02, 0.03);
  }
}

const audioFX = new JarvisAudioFX();

// ===================================================================
// 2. LUMINOUS AI BRAIN ORB & SINE WAVE RIBBON VISUALIZER
// ===================================================================
class AIBrainVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.state = 'idle'; // 'idle', 'listening', 'speaking', 'processing'
    this.phase = 0;
    this.targetAmp = 20;
    this.currentAmp = 20;

    // Stars / floating quantum particles inside orb
    this.particles = [];
    for (let i = 0; i < 35; i++) {
      this.particles.push({
        x: (Math.random() - 0.5) * 280,
        y: (Math.random() - 0.5) * 280,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.7 + 0.2
      });
    }

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const size = Math.min(rect.width || 380, 480);
    this.canvas.width = size;
    this.canvas.height = size;
    this.centerX = size / 2;
    this.centerY = size / 2;
    this.radius = size * 0.44; // Orb boundary radius
  }

  setMicVolume(level) {
    if (level > 2) {
      this.targetAmp = Math.min(65, 26 + level * 0.8);
    }
  }

  setState(state) {
    this.state = state;
    const container = document.getElementById('brainContainer');
    const stateText = document.getElementById('brainStateText');
    const tapTip = document.getElementById('brainTapTip');

    if (container) {
      container.classList.toggle('listening', state === 'listening');
      container.classList.toggle('speaking', state === 'speaking');
    }

    if (tapTip) {
      if (state === 'listening') {
        tapTip.innerHTML = '<span class="tip-dot"></span> VOICE ONLINE // LISTENING';
      } else if (state === 'speaking') {
        tapTip.innerHTML = '<span class="tip-dot"></span> JARVIS SPEAKING...';
      } else if (state === 'processing') {
        tapTip.innerHTML = '<span class="tip-dot"></span> PROCESSING DIRECTIVE...';
      } else {
        tapTip.innerHTML = '<span class="tip-dot"></span> TAP ORB TO SPEAK WITH JARVIS';
      }
    }

    if (stateText) {
      stateText.className = `brain-state-text ${state}`;
      if (state === 'listening') {
        stateText.textContent = 'Listening...';
      } else if (state === 'speaking') {
        stateText.textContent = 'Speaking...';
      } else if (state === 'processing') {
        stateText.textContent = 'Processing...';
      } else {
        stateText.textContent = 'Standing By';
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const { ctx, canvas, centerX, centerY, radius } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamic speeds & amplitudes based on state
    let speed = 0.035;
    if (this.state === 'listening') {
      speed = 0.07;
      this.targetAmp = 45;
    } else if (this.state === 'speaking') {
      speed = 0.055;
      this.targetAmp = 52;
    } else if (this.state === 'processing') {
      speed = 0.09;
      this.targetAmp = 38;
    } else {
      speed = 0.03;
      this.targetAmp = 26;
    }

    this.phase += speed;
    this.currentAmp += (this.targetAmp - this.currentAmp) * 0.12;

    // 1. Soft inner cyan aura glow
    this.drawAura(centerX, centerY, radius);

    // 2. Ambient floating stardust particles
    this.drawParticles(centerX, centerY, radius);

    // 3. Multi-frequency parameters (giving 2.5 to 3.5 cycles across orb)
    const baseFreq = (Math.PI * 4.8) / (radius * 2);
    const harmFreq = (Math.PI * 3.2) / (radius * 2);

    // Ribbon 1: Primary Cyan & Electric Blue Silk Ribbon
    this.drawSineRibbon({
      cx: centerX,
      cy: centerY,
      radius: radius * 0.9,
      freq: baseFreq,
      harmFreq: harmFreq,
      harmPhase: this.phase * 0.75,
      phase: this.phase,
      amp: this.currentAmp,
      strands: 28,
      strandSpread: 24,
      baseHue: 'cyan-blue',
      hasSpine: true
    });

    // Ribbon 2: Interlaced Magenta/Violet Wave (Exact match to reference image)
    this.drawSineRibbon({
      cx: centerX,
      cy: centerY,
      radius: radius * 0.88,
      freq: baseFreq * 1.15,
      harmFreq: harmFreq * 0.9,
      harmPhase: this.phase * 0.85 + 1.5,
      phase: this.phase * 0.92 + Math.PI * 0.45,
      amp: this.currentAmp * 0.9,
      strands: 24,
      strandSpread: 20,
      baseHue: 'violet-magenta',
      hasSpine: true
    });

    // Ribbon 3: Fine Harmonic Glow Overlay
    this.drawSineRibbon({
      cx: centerX,
      cy: centerY,
      radius: radius * 0.85,
      freq: baseFreq * 0.85,
      harmFreq: harmFreq * 1.3,
      harmPhase: this.phase * 1.2 + 3.0,
      phase: this.phase * 1.1 + Math.PI,
      amp: this.currentAmp * 0.7,
      strands: 14,
      strandSpread: 12,
      baseHue: 'cyan-glow',
      hasSpine: false
    });
  }

  drawAura(cx, cy, r) {
    const { ctx } = this;
    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.95);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
    grad.addColorStop(0.6, 'rgba(0, 102, 255, 0.05)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawParticles(cx, cy, maxRadius) {
    const { ctx } = this;
    ctx.save();
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      const dist = Math.sqrt(p.x * p.x + p.y * p.y);
      if (dist > maxRadius * 0.85) {
        p.x *= -0.8;
        p.y *= -0.8;
      }

      ctx.beginPath();
      ctx.arc(cx + p.x, cy + p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 240, 255, ${p.alpha * 0.6})`;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Renders a luminous 3D undulating wireframe sine ribbon
   */
  drawSineRibbon(opts) {
    const { ctx } = this;
    const { cx, cy, radius, freq, harmFreq, harmPhase, phase, amp, strands, strandSpread, baseHue, hasSpine } = opts;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const startX = cx - radius;
    const endX = cx + radius;
    const step = 3; // High horizontal precision

    for (let s = 0; s < strands; s++) {
      const strandRatio = (s / (strands - 1)) - 0.5; // -0.5 to 0.5
      const strandOffset = strandRatio * strandSpread;
      const isSpine = hasSpine && (s === Math.floor(strands / 2));

      ctx.beginPath();
      let firstPoint = true;

      for (let x = startX; x <= endX; x += step) {
        const normX = (x - cx) / radius;
        if (Math.abs(normX) >= 1) continue;

        // Smooth cosine envelope for natural wave pinch at orb edges
        const envelope = Math.pow(Math.cos(normX * Math.PI * 0.5), 1.2);

        // Harmonic dual sine modulation
        const wave1 = Math.sin((x - startX) * freq + phase);
        const wave2 = Math.cos((x - startX) * harmFreq + harmPhase) * 0.4;
        const totalWave = (wave1 + wave2) * amp * envelope;

        const y = cy + totalWave + (strandOffset * envelope);

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Linear gradient across ribbon matching user reference image
      const grad = ctx.createLinearGradient(startX, cy, endX, cy);
      if (baseHue === 'cyan-blue') {
        grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        grad.addColorStop(0.15, 'rgba(0, 240, 255, 0.7)');
        grad.addColorStop(0.5, 'rgba(0, 140, 255, 0.85)');
        grad.addColorStop(0.75, 'rgba(160, 68, 255, 0.75)');
        grad.addColorStop(0.9, 'rgba(217, 70, 239, 0.6)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      } else if (baseHue === 'violet-magenta') {
        grad.addColorStop(0, 'rgba(120, 60, 255, 0)');
        grad.addColorStop(0.2, 'rgba(0, 210, 255, 0.5)');
        grad.addColorStop(0.55, 'rgba(180, 80, 255, 0.8)');
        grad.addColorStop(0.8, 'rgba(236, 72, 153, 0.85)');
        grad.addColorStop(0.95, 'rgba(217, 70, 239, 0.7)');
        grad.addColorStop(1, 'rgba(120, 60, 255, 0)');
      } else {
        grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
        grad.addColorStop(0.25, 'rgba(0, 240, 255, 0.7)');
        grad.addColorStop(0.75, 'rgba(0, 255, 210, 0.6)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      }

      ctx.strokeStyle = grad;
      ctx.lineWidth = isSpine ? 2.2 : 1.1;

      if (isSpine) {
        ctx.shadowColor = baseHue === 'cyan-blue' ? '#00f0ff' : '#ec4899';
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 4;
      }

      ctx.stroke();
    }

    ctx.restore();
  }
}

// ===================================================================
// 3. SPEECH RECOGNITION & SYNTHESIS (JARVIS VOICE ENGINE)
// ===================================================================
class JarvisVoiceManager {
  constructor(onCommandDetected) {
    this.onCommand = onCommandDetected;
    this.recognition = null;
    this.synthesis = window.speechSynthesis;
    this.isListening = false;
    this.autoRestart = true;
    this.preferredVoice = null;
    this.isMuted = false;

    this.initSpeechRecognition();
    this.initSpeechSynthesis();
  }

  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRec();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      document.getElementById('btnVoiceToggle').classList.add('active');
      brainVisualizer.setState('listening');
      document.getElementById('voiceTranscript').textContent = '"Listening..."';
    };

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const display = final || interim;
      if (display.trim()) {
        document.getElementById('voiceTranscript').textContent = `"${display.trim()}"`;
        audioFX.tick();
      }

      if (final.trim()) {
        this.handleTranscribedCommand(final.trim());
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error !== 'no-speech') {
        console.warn('Speech recognition error:', event.error);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.autoRestart) {
        try {
          this.recognition.start();
        } catch (e) {}
      } else {
        document.getElementById('btnVoiceToggle').classList.remove('active');
        brainVisualizer.setState('idle');
      }
    };
  }

  initSpeechSynthesis() {
    const setVoice = () => {
      const voices = this.synthesis.getVoices();
      // Search for British or refined AI voice
      this.preferredVoice = voices.find(v => 
        v.name.includes('Daniel') || 
        v.name.includes('Alex') || 
        v.name.includes('Oliver') ||
        v.name.includes('Google UK English Male') ||
        v.lang === 'en-GB'
      ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    };

    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = setVoice;
    }
    setVoice();
  }

  setupAudioAnalyser(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!audioFX.ctx) audioFX.ctx = new AudioCtx();
      if (audioFX.ctx.state === 'suspended') audioFX.ctx.resume();

      const source = audioFX.ctx.createMediaStreamSource(stream);
      this.analyser = audioFX.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      const updateMic = () => {
        if (this.isListening && !this.isSpeaking && this.analyser) {
          this.analyser.getByteFrequencyData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) sum += buffer[i];
          const avg = sum / buffer.length;
          brainVisualizer.setMicVolume(avg);
        }
        requestAnimationFrame(updateMic);
      };
      updateMic();
    } catch (e) {
      console.warn('Audio analyser setup error:', e);
    }
  }

  activateVoiceConversation() {
    audioFX.bootSound();

    // Unlock microphone & setup reactive audio waves
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        this.setupAudioAnalyser(stream);
      }).catch((e) => {
        console.warn('Mic access:', e);
      });
    }

    if (!this.isListening) {
      this.startListening();
    }

    // Greet user with Daniel British voice
    const welcome = "All systems operational, sir. How may I assist you?";
    this.speak(welcome);
    showAIResponse(welcome);
  }

  startListening() {
    this.autoRestart = true;
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
        audioFX.listenChime();
      } catch (e) {}
    }
  }

  stopListening() {
    this.autoRestart = false;
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    document.getElementById('btnVoiceToggle').classList.remove('active');
    brainVisualizer.setState('idle');
  }

  toggleListening() {
    if (this.isListening) {
      this.stopListening();
    } else {
      this.activateVoiceConversation();
    }
  }

  handleTranscribedCommand(text) {
    const clean = text.trim();
    if (clean.length > 0 && !this.isSpeaking) {
      this.onCommand(clean);
    }
  }

  async speak(text) {
    if (this.isMuted || !text) return;
    this.isSpeaking = true;
    brainVisualizer.setState('speaking');

    // 1. Play out loud through macOS hardware speaker using Daniel voice
    try {
      fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'Daniel' })
      }).catch(() => {});
    } catch (e) {}

    // 2. Play through browser Web Speech API
    if (this.synthesis) {
      if (this.synthesis.speaking) {
        this.synthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
      }
      utterance.pitch = 0.95;
      utterance.rate = 1.05;

      const finishSpeaking = () => {
        this.isSpeaking = false;
        if (this.autoRestart) {
          brainVisualizer.setState('listening');
          document.getElementById('voiceTranscript').textContent = '"Listening..."';
          audioFX.ackChime();
          try {
            this.recognition.start();
          } catch (e) {}
        } else {
          brainVisualizer.setState('idle');
        }
      };

      utterance.onend = finishSpeaking;
      utterance.onerror = finishSpeaking;

      this.synthesis.speak(utterance);
    } else {
      // Fallback timer for native speak
      const estimatedDuration = Math.max(2000, (text.split(' ').length / 2.5) * 1000);
      setTimeout(() => {
        this.isSpeaking = false;
        brainVisualizer.setState('listening');
        document.getElementById('voiceTranscript').textContent = '"Listening..."';
        audioFX.ackChime();
      }, estimatedDuration);
    }
  }
}

// ===================================================================
// 4. MAIN HUD APPLICATION CONTROLLER
// ===================================================================
let brainVisualizer;
let voiceManager;
let socket;
let isTerminalOpen = false;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize AI Brain Visualizer
  brainVisualizer = new AIBrainVisualizer('brainCanvas');

  // Initialize Voice Manager
  voiceManager = new JarvisVoiceManager((cmd) => {
    executeJarvisCommand(cmd);
  });

  // Start clock
  startClock();

  // Initialize WebSocket for real-time macOS telemetry
  initWebSocket();

  // Setup Event Listeners
  setupEventListeners();

  // Initial sound on first interaction
  document.body.addEventListener('click', () => {
    audioFX.init();
  }, { once: true });

  // Add initial welcome log
  addActivityFeed('CORE', 'All neural pathways linked. Awaiting directives.');
  logTerminal('sys', '[SYSTEM] J.A.R.V.I.S. Core Online. Telemetry & Automation ready.');
});

// CLOCK & DATE
function startClock() {
  function update() {
    const now = new Date();
    document.getElementById('hudClock').textContent = now.toTimeString().split(' ')[0];
    const options = { month: 'short', day: '2-digit', year: 'numeric' };
    document.getElementById('hudDate').textContent = now.toLocaleDateString('en-US', options).toUpperCase();
  }
  update();
  setInterval(update, 1000);
}

// REAL-TIME WEBSOCKET TELEMETRY
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    document.getElementById('hudStatusBadge').classList.add('online');
    document.getElementById('systemStatusText').textContent = 'ONLINE // ALL PROTOCOLS ARMED';
    logTerminal('sys', '[WS] Telemetry channel connected to local host.');
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'vitals') {
        updateHUDVitals(msg.data);
      } else if (msg.type === 'command_processed' || msg.type === 'command_result') {
        handleCommandResult(msg.result);
      }
    } catch (e) {
      console.error('WS parse error:', e);
    }
  };

  socket.onclose = () => {
    document.getElementById('hudStatusBadge').classList.remove('online');
    document.getElementById('systemStatusText').textContent = 'RECONNECTING TELEMETRY...';
    setTimeout(initWebSocket, 3000);
  };
}

// UPDATE HUD VITALS
function updateHUDVitals(v) {
  if (!v) return;

  // CPU
  if (v.cpu) {
    document.getElementById('cpuUsageVal').textContent = `${v.cpu.usage}%`;
    document.getElementById('cpuUsageFill').style.width = `${v.cpu.usage}%`;
    document.getElementById('cpuModelLabel').textContent = `${v.cpu.model} (${v.cpu.cores} Cores)`;
  }

  // Memory
  if (v.memory) {
    document.getElementById('ramUsageVal').textContent = `${v.memory.percentage}%`;
    document.getElementById('ramUsageFill').style.width = `${v.memory.percentage}%`;
    document.getElementById('ramInfoLabel').textContent = `${v.memory.used} / ${v.memory.total}`;
  }

  // Battery
  if (v.battery) {
    document.getElementById('batteryVal').textContent = `${v.battery.level}%`;
    document.getElementById('batteryFill').style.width = `${v.battery.level}%`;
    document.getElementById('batteryStatusLabel').textContent = 
      v.battery.charging ? 'AC Connected (Charging)' : (v.battery.plugged ? 'AC Connected' : 'Discharging');
  }

  // Volume
  if (v.volume) {
    document.getElementById('volumeVal').textContent = `${v.volume.volume}%`;
    const volSlider = document.getElementById('volumeSlider');
    if (!volSlider.matches(':active')) {
      volSlider.value = v.volume.volume;
    }
  }

  // System
  if (v.system) {
    document.getElementById('telemetryHost').textContent = (v.system.hostname || 'MAC-HOST').toUpperCase();
    document.getElementById('telemetryUser').textContent = (v.system.user || 'OPERATOR').toUpperCase();

    const sec = v.system.uptime || 0;
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    document.getElementById('telemetryUptime').textContent = `${h}:${m}:${s}`;
  }
}

// EXECUTE JARVIS COMMAND (VOICE OR TEXT)
async function executeJarvisCommand(commandText) {
  if (!commandText || !commandText.trim()) return;
  const text = commandText.trim();

  // Visual & Sound Feedback
  audioFX.ackChime();
  brainVisualizer.setState('processing');
  document.getElementById('voiceTranscript').textContent = `"${text}"`;
  document.getElementById('aiSpeechBubble').textContent = `Processing directive: "${text}"...`;
  logTerminal('cmd', `$ jarvis execute "${text}"`);
  addActivityFeed('CMD', text);

  try {
    const res = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const json = await res.json();
    if (json.success) {
      handleCommandResult(json.result);
    } else {
      showAIResponse(`Protocol error: ${json.error}`);
      audioFX.errorChime();
    }
  } catch (err) {
    showAIResponse(`System communication failure: ${err.message}`);
    audioFX.errorChime();
  }
}

// HANDLE COMMAND RESULT
function handleCommandResult(result) {
  if (!result) return;

  const spoken = result.spoken || 'Protocol executed successfully, sir.';
  showAIResponse(spoken);
  voiceManager.speak(spoken);

  logTerminal('res', `[JARVIS] ${spoken}`);

  // Special UI actions based on result intent
  if (result.intent === 'screenshot' && result.data && result.data.url) {
    showScreenshotModal(result.data.url, result.data.path);
  }

  if (result.intent === 'execute_command' && result.data) {
    logTerminal('res', result.data.output || 'No output returned.');
    if (!isTerminalOpen) toggleTerminal(true);
  }

  addActivityFeed('ACK', result.intent.toUpperCase());
}

// AI RESPONSE DISPLAY
function showAIResponse(text) {
  const bubble = document.getElementById('aiSpeechBubble');
  bubble.textContent = `"${text}"`;
  bubble.style.transform = 'scale(1.02)';
  setTimeout(() => bubble.style.transform = 'scale(1)', 200);
}

// ACTIVITY FEED HELPER
function addActivityFeed(tag, message) {
  const feed = document.getElementById('activityFeed');
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `<span class="feed-time">[${tag}]</span> <span class="feed-msg">${message}</span>`;

  feed.insertBefore(item, feed.firstChild);
  if (feed.children.length > 20) {
    feed.removeChild(feed.lastChild);
  }
}

// TERMINAL DRAWER HELPER
function logTerminal(type, text) {
  const body = document.getElementById('terminalLogs');
  const line = document.createElement('div');
  line.className = `term-line ${type}`;
  line.textContent = text;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

function toggleTerminal(forceOpen = null) {
  const drawer = document.getElementById('terminalDrawer');
  if (forceOpen !== null) {
    isTerminalOpen = forceOpen;
  } else {
    isTerminalOpen = !isTerminalOpen;
  }

  if (isTerminalOpen) {
    drawer.classList.add('open');
    document.getElementById('terminalCommandInput').focus();
  } else {
    drawer.classList.remove('open');
  }
  audioFX.tick();
}

// SCREENSHOT MODAL
function showScreenshotModal(url, filepath) {
  const modal = document.getElementById('screenshotModal');
  const img = document.getElementById('screenshotImg');
  const meta = document.getElementById('screenshotMeta');
  const dl = document.getElementById('downloadScreenshotBtn');

  img.src = url;
  meta.textContent = filepath ? `Saved to: ${filepath}` : 'Screen capture archived';
  dl.href = url;
  modal.classList.add('open');
  audioFX.ackChime();
}

function closeScreenshotModal() {
  document.getElementById('screenshotModal').classList.remove('open');
  audioFX.tick();
}

// ===================================================================
// 5. EVENT LISTENERS SETUP
// ===================================================================
function setupEventListeners() {
  // Center AI Brain Orb click -> Toggle Voice
  const brainContainer = document.getElementById('brainContainer');
  if (brainContainer) {
    brainContainer.addEventListener('click', () => {
      voiceManager.activateVoiceConversation();
    });
  }

  // Top Voice Button Toggle
  document.getElementById('btnVoiceToggle').addEventListener('click', () => {
    voiceManager.toggleListening();
  });

  // Mute AI Voice Button
  const muteBtn = document.getElementById('btnMuteSpeech');
  muteBtn.addEventListener('click', () => {
    voiceManager.isMuted = !voiceManager.isMuted;
    audioFX.isMuted = voiceManager.isMuted;
    muteBtn.classList.toggle('active', voiceManager.isMuted);
    muteBtn.style.color = voiceManager.isMuted ? 'var(--color-danger)' : 'var(--cyan-bright)';
    showAIResponse(voiceManager.isMuted ? 'Speech feedback suppressed, sir.' : 'Speech feedback active, sir.');
  });

  // Terminal Toggle Button
  document.getElementById('btnTerminalToggle').addEventListener('click', () => toggleTerminal());
  document.getElementById('btnCloseTerminal').addEventListener('click', () => toggleTerminal(false));
  document.getElementById('btnClearTerminal').addEventListener('click', () => {
    document.getElementById('terminalLogs').innerHTML = '<div class="term-line sys">[SYSTEM] Buffer cleared.</div>';
    audioFX.tick();
  });

  // Send Command Input
  const cmdInput = document.getElementById('commandInput');
  const sendBtn = document.getElementById('btnSendCommand');

  const handleSend = () => {
    const val = cmdInput.value;
    if (val.trim()) {
      executeJarvisCommand(val);
      cmdInput.value = '';
    }
  };

  sendBtn.addEventListener('click', handleSend);
  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSend();
  });

  // Suggestion Chips
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.getAttribute('data-cmd');
      executeJarvisCommand(cmd);
    });
  });

  // App Matrix Buttons
  document.querySelectorAll('.matrix-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const target = btn.getAttribute('data-target');
      if (action === 'app') {
        executeJarvisCommand(`Open ${target}`);
      } else if (action === 'folder') {
        executeJarvisCommand(`Open ${target} folder`);
      }
    });
  });

  // Screenshot Action Button
  document.getElementById('btnTakeScreenshot').addEventListener('click', () => {
    executeJarvisCommand('Take screenshot');
  });

  // Lock Screen Action Button
  document.getElementById('btnLockScreen').addEventListener('click', () => {
    executeJarvisCommand('Lock screen');
  });

  // Media Playback Buttons
  document.querySelectorAll('.media-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const mediaAction = btn.getAttribute('data-media');
      audioFX.ackChime();
      try {
        await fetch('/api/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'media', payload: { mediaAction } })
        });
        addActivityFeed('MEDIA', `Triggered ${mediaAction}`);
        showAIResponse(`Media protocol ${mediaAction} dispatched, sir.`);
      } catch (e) {}
    });
  });

  // Volume Slider
  const volSlider = document.getElementById('volumeSlider');
  let volTimeout = null;
  volSlider.addEventListener('input', (e) => {
    const level = e.target.value;
    document.getElementById('volumeVal').textContent = `${level}%`;
    clearTimeout(volTimeout);
    volTimeout = setTimeout(async () => {
      audioFX.tick();
      await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_volume', payload: { level } })
      });
      addActivityFeed('VOL', `Set to ${level}%`);
    }, 200);
  });

  // Quick Mute Button
  document.getElementById('btnQuickMute').addEventListener('click', async () => {
    audioFX.tick();
    await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Mute' })
    });
  });

  // Quick Search
  const searchInput = document.getElementById('quickSearchInput');
  let selectedEngine = 'google';

  document.querySelectorAll('.engine-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      document.querySelectorAll('.engine-tag').forEach(t => t.classList.remove('active'));
      tag.classList.add('active');
      selectedEngine = tag.getAttribute('data-engine');
      audioFX.tick();
    });
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchInput.value.trim()) {
      const query = searchInput.value.trim();
      executeJarvisCommand(`Search ${selectedEngine} for ${query}`);
      searchInput.value = '';
    }
  });

  // Raw Terminal Input Run
  const termInput = document.getElementById('terminalCommandInput');
  const termRunBtn = document.getElementById('btnRunTerminal');

  const handleTermRun = async () => {
    const cmd = termInput.value.trim();
    if (!cmd) return;
    termInput.value = '';
    logTerminal('cmd', `$ ${cmd}`);
    audioFX.ackChime();

    try {
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminal', payload: { command: cmd } })
      });
      const data = await res.json();
      if (data.success && data.result) {
        logTerminal(data.result.success ? 'res' : 'err', data.result.output);
      } else {
        logTerminal('err', data.error || 'Execution failure');
      }
    } catch (e) {
      logTerminal('err', e.message);
    }
  };

  termRunBtn.addEventListener('click', handleTermRun);
  termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTermRun();
  });

  // Modal Close
  document.getElementById('btnCloseModal').addEventListener('click', closeScreenshotModal);
  document.getElementById('modalBackdrop').addEventListener('click', closeScreenshotModal);
}
