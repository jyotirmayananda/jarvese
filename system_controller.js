const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Ensure screenshots directory exists
const SCREENSHOTS_DIR = path.join(__dirname, 'public', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// CPU usage tracking
let prevCpuTimes = null;

function getCpuUsage() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }

  if (!prevCpuTimes) {
    prevCpuTimes = { idle, total };
    return 15; // Initial estimation
  }

  const idleDelta = idle - prevCpuTimes.idle;
  const totalDelta = total - prevCpuTimes.total;
  prevCpuTimes = { idle, total };

  if (totalDelta <= 0) return 0;
  const usage = 100 - Math.round((idleDelta / totalDelta) * 100);
  return Math.min(100, Math.max(0, usage));
}

// Execute shell command with promise
function runExec(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message, stdout, stderr });
      } else {
        resolve({ success: true, stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}

// Battery information from pmset
async function getBatteryInfo() {
  try {
    const res = await runExec('pmset -g batt');
    if (!res.success || !res.stdout) {
      return { level: 100, charging: false, status: 'AC Power' };
    }
    const match = res.stdout.match(/(\d+)%/);
    const level = match ? parseInt(match[1], 10) : 100;
    const charging = res.stdout.includes('charging') || res.stdout.includes('AC Power');
    const plugged = res.stdout.includes('AC Power');
    return { level, charging, plugged, raw: res.stdout.split('\n')[0] };
  } catch (err) {
    return { level: 100, charging: false, plugged: true, raw: 'Unknown' };
  }
}

// Volume status via osascript
async function getVolume() {
  try {
    const res = await runExec('osascript -e "output volume of (get volume settings)"');
    const muteRes = await runExec('osascript -e "output muted of (get volume settings)"');
    const volume = res.success ? parseInt(res.stdout, 10) : 50;
    const muted = muteRes.success && muteRes.stdout === 'true';
    return { volume: isNaN(volume) ? 50 : volume, muted };
  } catch (err) {
    return { volume: 50, muted: false };
  }
}

// Set volume (0-100)
async function setVolume(level) {
  const target = Math.max(0, Math.min(100, parseInt(level, 10)));
  const script = `osascript -e "set volume output volume ${target}"`;
  const res = await runExec(script);
  return { success: res.success, volume: target };
}

// Change volume by delta (+/-)
async function adjustVolume(delta) {
  const current = await getVolume();
  const target = Math.max(0, Math.min(100, current.volume + delta));
  return await setVolume(target);
}

// Toggle mute
async function toggleMute(mute) {
  const script = `osascript -e "set volume output muted ${mute ? 'true' : 'false'}"`;
  return await runExec(script);
}

// Full System Vitals
async function getSystemVitals() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsage = Math.round((usedMem / totalMem) * 100);

  const cpuUsage = getCpuUsage();
  const battery = await getBatteryInfo();
  const volume = await getVolume();

  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model.trim() : 'Apple Silicon / Intel';

  return {
    cpu: {
      usage: cpuUsage,
      cores: cpus.length,
      model: cpuModel
    },
    memory: {
      total: (totalMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
      used: (usedMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
      free: (freeMem / 1024 / 1024 / 1024).toFixed(1) + ' GB',
      percentage: memUsage
    },
    battery,
    volume,
    system: {
      platform: os.platform(),
      release: os.release(),
      uptime: Math.round(os.uptime()),
      hostname: os.hostname(),
      user: os.userInfo().username
    }
  };
}

// App Name Resolver
const APP_MAP = {
  'chrome': 'Google Chrome',
  'google chrome': 'Google Chrome',
  'browser': 'Google Chrome',
  'safari': 'Safari',
  'firefox': 'Firefox',
  'code': 'Visual Studio Code',
  'vscode': 'Visual Studio Code',
  'vs code': 'Visual Studio Code',
  'terminal': 'Terminal',
  'iterm': 'iTerm',
  'iterm2': 'iTerm2',
  'finder': 'Finder',
  'spotify': 'Spotify',
  'music': 'Music',
  'apple music': 'Music',
  'calculator': 'Calculator',
  'notes': 'Notes',
  'calendar': 'Calendar',
  'settings': 'System Settings',
  'system settings': 'System Settings',
  'system preferences': 'System Settings',
  'slack': 'Slack',
  'discord': 'Discord',
  'messages': 'Messages',
  'mail': 'Mail',
  'maps': 'Maps',
  'photos': 'Photos',
  'reminders': 'Reminders',
  'app store': 'App Store'
};

async function openApp(appName) {
  const normalized = appName.toLowerCase().trim();
  const targetApp = APP_MAP[normalized] || appName;
  const cmd = `open -a "${targetApp}"`;
  const res = await runExec(cmd);
  if (!res.success) {
    // Try generic open in case it's a bundle or path
    const fallbackRes = await runExec(`open -a "${appName}"`);
    return { success: fallbackRes.success, app: targetApp, error: fallbackRes.error };
  }
  return { success: true, app: targetApp };
}

// Media playback control
async function controlMedia(action) {
  // Try Spotify first, fallback to Music
  let script = '';
  if (action === 'playpause' || action === 'play' || action === 'pause') {
    script = `
      try
        tell application "Spotify" to playpause
      on error
        try
          tell application "Music" to playpause
        end try
      end try
    `;
  } else if (action === 'next') {
    script = `
      try
        tell application "Spotify" to next track
      on error
        try
          tell application "Music" to next track
        end try
      end try
    `;
  } else if (action === 'previous') {
    script = `
      try
        tell application "Spotify" to previous track
      on error
        try
          tell application "Music" to previous track
        end try
      end try
    `;
  }

  const res = await runExec(`osascript -e '${script.replace(/\n/g, ' ')}'`);
  return { success: res.success, action };
}

// Capture screenshot
async function takeScreenshot() {
  const filename = `screenshot_${Date.now()}.png`;
  const filePath = path.join(SCREENSHOTS_DIR, filename);
  const cmd = `screencapture -x "${filePath}"`;
  const res = await runExec(cmd);
  if (res.success && fs.existsSync(filePath)) {
    return {
      success: true,
      filename,
      url: `/screenshots/${filename}`,
      path: filePath
    };
  }
  return { success: false, error: res.error || 'Failed to capture screen' };
}

// Web Search / URL opener
async function searchWeb(query, engine = 'google') {
  let url = '';
  const encoded = encodeURIComponent(query);
  if (engine === 'youtube') {
    url = `https://www.youtube.com/results?search_query=${encoded}`;
  } else if (engine === 'github') {
    url = `https://github.com/search?q=${encoded}`;
  } else if (engine === 'wikipedia') {
    url = `https://en.wikipedia.org/wiki/Special:Search?search=${encoded}`;
  } else {
    url = `https://www.google.com/search?q=${encoded}`;
  }
  const res = await runExec(`open "${url}"`);
  return { success: res.success, url, query };
}

// Open URL directly
async function openUrl(url) {
  let target = url.trim();
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    target = 'https://' + target;
  }
  const res = await runExec(`open "${target}"`);
  return { success: res.success, url: target };
}

// Open standard folder
async function openFolder(folderName) {
  const home = os.homedir();
  let target = home;
  const f = folderName.toLowerCase();
  if (f.includes('download')) target = path.join(home, 'Downloads');
  else if (f.includes('document')) target = path.join(home, 'Documents');
  else if (f.includes('desktop')) target = path.join(home, 'Desktop');
  else if (f.includes('picture') || f.includes('photo')) target = path.join(home, 'Pictures');
  else if (f.includes('music')) target = path.join(home, 'Music');
  else if (f.includes('project') || f.includes('workspace')) target = process.cwd();

  const res = await runExec(`open "${target}"`);
  return { success: res.success, path: target };
}

// Lock screen / Sleep display
async function lockScreen() {
  const res = await runExec('pmset displaysleepnow');
  return { success: res.success, message: 'Display locked/put to sleep' };
}

// Run terminal command
async function executeTerminalCommand(command) {
  // Prevent destructive commands without confirmation
  const trimmed = command.trim();
  if (trimmed.startsWith('rm -rf /') || trimmed.startsWith('mkfs') || trimmed.startsWith(':(){ :|:& };:')) {
    return { success: false, output: 'Execution prevented: Command flagged by safety protocols.' };
  }
  const res = await runExec(trimmed);
  return {
    success: res.success,
    output: res.stdout || res.stderr || (res.success ? 'Command completed with no output.' : 'Execution failed')
  };
}

// Natural Language Intent Processor
async function processIntent(rawText) {
  const text = rawText.trim();
  const lower = text.toLowerCase().replace(/^(jarvis|hey jarvis|ok jarvis|jarves|hey jarves)[,\s]*/i, '').trim();

  // 1. Screenshot
  if (lower.includes('screenshot') || lower.includes('capture screen') || lower.includes('snap screen')) {
    const result = await takeScreenshot();
    return {
      intent: 'screenshot',
      spoken: 'Screenshot captured and rendered on your HUD, sir.',
      data: result
    };
  }

  // 2. Battery / Power
  if (lower.includes('battery') || lower.includes('power level') || lower.includes('charging status')) {
    const batt = await getBatteryInfo();
    return {
      intent: 'battery',
      spoken: `Battery is currently at ${batt.level} percent${batt.charging ? ' and actively charging' : ''}, sir.`,
      data: batt
    };
  }

  // 3. System Vitals / Status
  if (lower.includes('system status') || lower.includes('vitals') || lower.includes('diagnostics') || lower.includes('cpu usage') || lower.includes('ram usage')) {
    const vitals = await getSystemVitals();
    return {
      intent: 'vitals',
      spoken: `Diagnostics online. CPU load is at ${vitals.cpu.usage} percent. Memory utilization is ${vitals.memory.percentage} percent. All auxiliary systems operating within normal parameters.`,
      data: vitals
    };
  }

  // 4. Volume control
  if (lower.includes('mute')) {
    await toggleMute(true);
    return {
      intent: 'volume_mute',
      spoken: 'Audio output muted, sir.',
      data: { muted: true }
    };
  }
  if (lower.includes('unmute')) {
    await toggleMute(false);
    return {
      intent: 'volume_unmute',
      spoken: 'Audio output unmuted, sir.',
      data: { muted: false }
    };
  }
  if (lower.includes('volume')) {
    // Check for exact number: "set volume to 70" or "volume 50"
    const numMatch = lower.match(/\b(\d{1,3})\b/);
    if (numMatch) {
      const level = parseInt(numMatch[1], 10);
      const res = await setVolume(level);
      return {
        intent: 'set_volume',
        spoken: `Volume calibrated to ${res.volume} percent, sir.`,
        data: res
      };
    }
    if (lower.includes('up') || lower.includes('increase') || lower.includes('higher') || lower.includes('boost')) {
      const res = await adjustVolume(15);
      return {
        intent: 'volume_up',
        spoken: `Volume increased to ${res.volume} percent, sir.`,
        data: res
      };
    }
    if (lower.includes('down') || lower.includes('decrease') || lower.includes('lower') || lower.includes('reduce')) {
      const res = await adjustVolume(-15);
      return {
        intent: 'volume_down',
        spoken: `Volume reduced to ${res.volume} percent, sir.`,
        data: res
      };
    }
  }

  // 5. Media control
  if (lower.includes('play music') || lower.includes('resume music') || lower.includes('pause music') || lower.includes('stop music') || lower === 'play' || lower === 'pause') {
    const res = await controlMedia('playpause');
    return {
      intent: 'media_playpause',
      spoken: 'Media playback toggled, sir.',
      data: res
    };
  }
  if (lower.includes('next song') || lower.includes('next track') || lower.includes('skip song')) {
    const res = await controlMedia('next');
    return {
      intent: 'media_next',
      spoken: 'Skipping to next audio track, sir.',
      data: res
    };
  }
  if (lower.includes('previous song') || lower.includes('previous track')) {
    const res = await controlMedia('previous');
    return {
      intent: 'media_previous',
      spoken: 'Reverting to previous track, sir.',
      data: res
    };
  }

  // 6. YouTube Search
  if (lower.startsWith('search youtube for') || lower.startsWith('youtube')) {
    const query = lower.replace(/^(search youtube for|youtube for|youtube)\s*/, '');
    const res = await searchWeb(query, 'youtube');
    return {
      intent: 'search_youtube',
      spoken: `Streaming YouTube query for "${query}", sir.`,
      data: res
    };
  }

  // 7. GitHub Search
  if (lower.startsWith('search github for') || lower.startsWith('github')) {
    const query = lower.replace(/^(search github for|github for|github)\s*/, '');
    const res = await searchWeb(query, 'github');
    return {
      intent: 'search_github',
      spoken: `Querying GitHub repositories for "${query}", sir.`,
      data: res
    };
  }

  // 8. General Web Search
  if (lower.startsWith('search google for') || lower.startsWith('search for') || lower.startsWith('google') || lower.startsWith('search web for')) {
    const query = lower.replace(/^(search google for|search web for|search for|google)\s*/, '');
    const res = await searchWeb(query, 'google');
    return {
      intent: 'search_google',
      spoken: `Searching the global network for "${query}", sir.`,
      data: res
    };
  }

  // 9. Open Website / URL
  if (lower.startsWith('open url') || lower.startsWith('go to') || (lower.startsWith('open ') && (lower.includes('.com') || lower.includes('.org') || lower.includes('.io') || lower.includes('.dev') || lower.includes('.net')))) {
    const rawUrl = lower.replace(/^(open url|go to|open)\s*/, '');
    const res = await openUrl(rawUrl);
    return {
      intent: 'open_url',
      spoken: `Navigating to ${res.url}, sir.`,
      data: res
    };
  }

  // 10. Open Application
  if (lower.startsWith('open ') || lower.startsWith('launch ') || lower.startsWith('start ')) {
    const appCandidate = lower.replace(/^(open|launch|start)\s+/, '').trim();
    
    // Check if it's a folder first
    if (appCandidate.includes('folder') || appCandidate.includes('download') || appCandidate.includes('document') || appCandidate.includes('desktop')) {
      const res = await openFolder(appCandidate);
      return {
        intent: 'open_folder',
        spoken: `Opening ${appCandidate} in Finder, sir.`,
        data: res
      };
    }

    const res = await openApp(appCandidate);
    if (res.success) {
      return {
        intent: 'open_app',
        spoken: `Initiating ${res.app}, sir.`,
        data: res
      };
    } else {
      return {
        intent: 'open_app_failed',
        spoken: `Unable to locate application "${appCandidate}", sir. Please verify its installation.`,
        data: res
      };
    }
  }

  // 11. Folder open (e.g. "show my downloads")
  if (lower.includes('downloads') || lower.includes('documents') || lower.includes('desktop folder')) {
    const res = await openFolder(lower);
    return {
      intent: 'open_folder',
      spoken: 'Opening directory in Finder, sir.',
      data: res
    };
  }

  // 12. Lock Screen
  if (lower.includes('lock screen') || lower.includes('lock my computer') || lower.includes('lock mac') || lower.includes('sleep display')) {
    const res = await lockScreen();
    return {
      intent: 'lock_screen',
      spoken: 'Securing workstation and putting display to sleep, sir.',
      data: res
    };
  }

  // 13. Time / Date
  if (lower.includes('what time is it') || lower.includes('current time') || lower.includes("what's the time")) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return {
      intent: 'time',
      spoken: `The current time is ${timeStr}, sir.`,
      data: { time: timeStr }
    };
  }
  if (lower.includes("what's the date") || lower.includes('what date is it') || lower.includes("today's date") || lower.includes('current date')) {
    const now = new Date();
    const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return {
      intent: 'date',
      spoken: `Today is ${dateStr}, sir.`,
      data: { date: dateStr }
    };
  }

  // 14. Terminal execution (e.g. "run command git status", "exec ls -la", "terminal echo hello")
  if (lower.startsWith('run command ') || lower.startsWith('terminal ') || lower.startsWith('execute ') || lower.startsWith('cmd ')) {
    const cmd = text.replace(/^(jarvis|hey jarvis)[,\s]*/i, '').replace(/^(run command|terminal|execute|cmd)\s+/i, '');
    const res = await executeTerminalCommand(cmd);
    return {
      intent: 'execute_command',
      spoken: res.success ? 'Command executed successfully, sir.' : 'Command execution reported errors, sir.',
      data: res
    };
  }

  // 15. Greetings / Identity
  if (lower.includes('who are you') || lower.includes('what are you') || lower.includes('introduce yourself')) {
    return {
      intent: 'identity',
      spoken: 'I am J.A.R.V.I.S., Just A Rather Very Intelligent System. I oversee your workstation telemetry, application management, and system automation.',
      data: { identity: 'JARVIS' }
    };
  }
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('good morning') || lower.includes('good evening')) {
    const username = os.userInfo().username || 'sir';
    return {
      intent: 'greeting',
      spoken: `Good day, ${username}. All protocols are operational. How may I assist you?`,
      data: { user: username }
    };
  }

  // Default fallback: search web or intelligent answer
  const searchRes = await searchWeb(text, 'google');
  return {
    intent: 'general_query',
    spoken: `I have opened an online search for "${text}", sir. Standing by for further commands.`,
    data: searchRes
  };
}

// Speak via macOS native speech synthesizer
async function speakNative(text, voice = 'Daniel') {
  const clean = text.replace(/["`$\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return { success: true };
  const cmd = `say -v "${voice}" "${clean}"`;
  return await runExec(cmd);
}

module.exports = {
  getSystemVitals,
  getBatteryInfo,
  getVolume,
  setVolume,
  adjustVolume,
  toggleMute,
  openApp,
  controlMedia,
  takeScreenshot,
  searchWeb,
  openUrl,
  openFolder,
  lockScreen,
  executeTerminalCommand,
  processIntent,
  speakNative
};
