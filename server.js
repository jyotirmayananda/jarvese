const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const system = require('./system_controller');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// REST Endpoints
app.get('/api/vitals', async (req, res) => {
  try {
    const vitals = await system.getSystemVitals();
    res.json({ success: true, data: vitals });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/command', async (req, res) => {
  try {
    const { text, nativeSpeak } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'Command text is required' });
    }
    const result = await system.processIntent(text);
    
    // Broadcast command to connected HUDs
    broadcast({
      type: 'command_processed',
      command: text,
      result
    });

    // Native macOS speech playback using Daniel voice (Iron Man JARVIS)
    if (result.spoken && nativeSpeak !== false) {
      system.speakNative(result.spoken, 'Daniel').catch(() => {});
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/speak', async (req, res) => {
  try {
    const { text, voice } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'Text required' });
    const result = await system.speakNative(text, voice || 'Daniel');
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/action', async (req, res) => {
  try {
    const { action, payload } = req.body;
    let result = null;

    switch (action) {
      case 'screenshot':
        result = await system.takeScreenshot();
        break;
      case 'open_app':
        result = await system.openApp(payload.app);
        break;
      case 'set_volume':
        result = await system.setVolume(payload.level);
        break;
      case 'adjust_volume':
        result = await system.adjustVolume(payload.delta);
        break;
      case 'mute':
        result = await system.toggleMute(payload.mute);
        break;
      case 'media':
        result = await system.controlMedia(payload.mediaAction);
        break;
      case 'search':
        result = await system.searchWeb(payload.query, payload.engine);
        break;
      case 'folder':
        result = await system.openFolder(payload.folder);
        break;
      case 'lock':
        result = await system.lockScreen();
        break;
      case 'terminal':
        result = await system.executeTerminalCommand(payload.command);
        break;
      default:
        return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    broadcast({
      type: 'action_executed',
      action,
      result
    });

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Broadcast helper for WebSocket
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// WebSocket Connection handling
wss.on('connection', async (ws) => {
  console.log('[JARVIS WS] Client connected to holographic HUD');

  // Send immediate vitals snapshot
  try {
    const vitals = await system.getSystemVitals();
    ws.send(JSON.stringify({ type: 'vitals', data: vitals }));
  } catch (e) {
    console.error('Error sending initial vitals:', e);
  }

  ws.on('message', async (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'command') {
        const result = await system.processIntent(parsed.text);
        ws.send(JSON.stringify({
          type: 'command_result',
          command: parsed.text,
          result
        }));
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });

  ws.on('close', () => {
    console.log('[JARVIS WS] Client disconnected');
  });
});

// Telemetry Broadcast Interval (Every 2 seconds)
setInterval(async () => {
  if (wss.clients.size > 0) {
    try {
      const vitals = await system.getSystemVitals();
      broadcast({ type: 'vitals', data: vitals });
    } catch (e) {
      // Ignore telemetry glitches
    }
  }
}, 2000);

server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`  J.A.R.V.I.S. PROTOCOL INITIALIZED`);
  console.log(`  Holographic HUD: http://localhost:${PORT}`);
  console.log(`  System Automation: ONLINE`);
  console.log(`=============================================`);
});
