#!/usr/bin/env node

const { extractText } = require('../lib/extractors.js');
const { SpeedReader } = require('../lib/display.js');
const { loadConfig, saveConfig } = require('../lib/config.js');

async function main() {
  const args = process.argv.slice(2);
  const demoMode = args.includes('--demo');
  const filteredArgs = args.filter(a => a !== '--demo');

  if (filteredArgs.length === 0) {
    console.error('Usage: srit <file|url|->\n');
    console.error('Supported formats: txt, md, pdf, doc, docx');
    console.error('Use - to read from stdin');
    process.exit(1);
  }

  const source = filteredArgs[0];

  if (!process.stdout.isTTY) {
    console.error('Error: srit requires an interactive terminal');
    process.exit(1);
  }

  try {
    const text = await extractText(source);

    if (!text || text.trim().length === 0) {
      console.error('Error: No text content found');
      process.exit(1);
    }

    const config = loadConfig();
    if (demoMode) {
      config.wpm = 400;
    }
    const reader = new SpeedReader(text, config, source === '-', demoMode ? 30 : 0);

    reader.on('configChange', (newConfig) => {
      if (!demoMode) {
        saveConfig(newConfig);
      }
    });

    await reader.start();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
