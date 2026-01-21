const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.srit.json');

const DEFAULT_CONFIG = {
  wpm: 300,
  highlightColor: 'red',
  // SAP (Semantic Adaptive Pacing) settings
  gamma: 0.6,
  targetWpm: 360,
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(data);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch {
    // Ignore errors, use defaults
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch {
    // Ignore save errors
  }
}

module.exports = { loadConfig, saveConfig, DEFAULT_CONFIG };
