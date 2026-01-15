#!/usr/bin/env node

const { extractText } = require('../lib/extractors.js');
const { SpeedReader } = require('../lib/display.js');
const { loadConfig, saveConfig } = require('../lib/config.js');
const { generateQuestions, distributeQuestions } = require('../lib/questions.js');
const { detectProvider } = require('../lib/llm.js');
const { version } = require('../package.json');

function parseArgs(args) {
  const options = {
    source: null,
    demo: false,
    check: false,
    questions: 10,
    frequency: null,
    model: null,
    provider: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--demo') {
      options.demo = true;
    } else if (arg === '--check') {
      options.check = true;
    } else if (arg === '--questions') {
      options.questions = parseInt(args[++i], 10);
      if (isNaN(options.questions) || options.questions < 1) {
        throw new Error('--questions requires a positive number');
      }
    } else if (arg === '--frequency') {
      options.frequency = parseInt(args[++i], 10);
      if (isNaN(options.frequency) || options.frequency < 1) {
        throw new Error('--frequency requires a positive number');
      }
    } else if (arg === '--model') {
      options.model = args[++i];
      if (!options.model) {
        throw new Error('--model requires a model name');
      }
    } else if (arg === '--provider') {
      options.provider = args[++i];
      if (!options.provider) {
        throw new Error('--provider requires a provider name (openai, anthropic, gemini)');
      }
    } else if (!arg.startsWith('-')) {
      options.source = arg;
    }
  }

  return options;
}

function printUsage() {
  console.error('Usage: srit [options] <file|url|->');
  console.error('');
  console.error('Options:');
  console.error('  --check              Enable comprehension check mode');
  console.error('  --questions N        Number of questions (default: 10)');
  console.error('  --frequency N        Average words between questions');
  console.error('  --provider NAME      LLM provider (openai, anthropic, gemini)');
  console.error('  --model NAME         LLM model to use');
  console.error('  --demo               Demo mode (fast, limited words)');
  console.error('  -v, --version        Show version number');
  console.error('');
  console.error('Supported formats: txt, md, pdf, doc, docx');
  console.error('Use - to read from stdin');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`srit v${version}`);
    process.exit(0);
  }

  let options;
  try {
    options = parseArgs(args);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    printUsage();
    process.exit(1);
  }

  if (!options.source) {
    printUsage();
    process.exit(1);
  }

  if (!process.stdout.isTTY) {
    console.error('Error: srit requires an interactive terminal');
    process.exit(1);
  }

  // Check for API key if --check mode
  if (options.check) {
    const detected = detectProvider();
    if (!detected && !options.provider) {
      console.error('Error: --check requires an LLM API key.');
      console.error('Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY environment variable.');
      process.exit(1);
    }
  }

  try {
    const text = await extractText(options.source);

    if (!text || text.trim().length === 0) {
      console.error('Error: No text content found');
      process.exit(1);
    }

    const config = loadConfig();
    if (options.demo) {
      config.wpm = 400;
    }

    let questionPositions = [];

    if (options.check) {
      console.log('Generating comprehension questions...');
      const questions = await generateQuestions(text, {
        questionCount: options.questions,
        provider: options.provider,
        model: options.model,
      });

      const { parseWords } = require('../lib/display.js');
      const words = parseWords(text);

      questionPositions = distributeQuestions(words, questions, {
        frequency: options.frequency,
      });
      console.log(`Generated ${questions.length} questions. Starting...`);
    }

    const reader = new SpeedReader(
      text,
      config,
      options.source === '-',
      options.demo ? 30 : 0,
      questionPositions
    );

    reader.on('configChange', (newConfig) => {
      if (!options.demo) {
        saveConfig(newConfig);
      }
    });

    const result = await reader.start();

    if (options.check && result) {
      const percentage = Math.round((result.score / result.total) * 100);
      const minutes = Math.floor(result.elapsedTime / 60000);
      const seconds = Math.floor((result.elapsedTime % 60000) / 1000);
      console.log('');
      console.log(`Score: ${result.score}/${result.total} (${percentage}%)`);
      console.log(`Time: ${minutes}m ${seconds}s`);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

main();
