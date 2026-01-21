#!/usr/bin/env node

const { extractText } = require('../lib/extractors.js');
const { SpeedReader } = require('../lib/display.js');
const { loadConfig, saveConfig } = require('../lib/config.js');
const { generateQuestions, distributeQuestions } = require('../lib/questions.js');
const { detectProvider, scoreTokens, supportsLogprobs, estimateSapCost } = require('../lib/llm.js');
const readline = require('readline');
const { processText, computeDurations, DEFAULT_PARAMS } = require('../lib/sap.js');
const { getCache, setCache } = require('../lib/cache.js');
const { version } = require('../package.json');

/**
 * Prompt user for confirmation
 * @param {string} message - The prompt message
 * @returns {Promise<boolean>} - True if user confirmed
 */
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function parseArgs(args) {
  const options = {
    source: null,
    demo: false,
    check: false,
    auto: false,
    questions: 10,
    frequency: null,
    model: null,
    provider: null,
    gamma: null,
    targetWpm: null,
    maxCost: 1.0, // Default $1 threshold
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--demo') {
      options.demo = true;
    } else if (arg === '--check') {
      options.check = true;
    } else if (arg === '--auto') {
      options.auto = true;
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
    } else if (arg === '--gamma') {
      options.gamma = parseFloat(args[++i]);
      if (isNaN(options.gamma) || options.gamma < 0 || options.gamma > 2) {
        throw new Error('--gamma requires a number between 0 and 2');
      }
    } else if (arg === '--target-wpm') {
      options.targetWpm = parseInt(args[++i], 10);
      if (isNaN(options.targetWpm) || options.targetWpm < 50 || options.targetWpm > 1000) {
        throw new Error('--target-wpm requires a number between 50 and 1000');
      }
    } else if (arg === '--max-cost') {
      options.maxCost = parseFloat(args[++i]);
      if (isNaN(options.maxCost) || options.maxCost < 0) {
        throw new Error('--max-cost requires a non-negative number');
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
  console.error('  --auto               Enable semantic adaptive pacing (requires OpenAI/Gemini)');
  console.error('  --gamma N            Slowdown intensity for --auto (0.0-2.0, default: 0.6)');
  console.error('  --target-wpm N       Target WPM for --auto mode (default: 360)');
  console.error('  --max-cost N         Max cost in USD before confirmation (default: 1.0)');
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

  // Check for API key if --check or --auto mode
  if (options.check || options.auto) {
    const detected = detectProvider();
    if (!detected && !options.provider) {
      console.error(`Error: --${options.auto ? 'auto' : 'check'} requires an LLM API key.`);
      console.error('Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY environment variable.');
      process.exit(1);
    }

    // For --auto, check that provider supports logprobs
    if (options.auto) {
      const providerName = options.provider || detected?.provider;
      if (!supportsLogprobs(providerName)) {
        console.error(`Error: --auto requires a provider with logprobs support (OpenAI or Gemini).`);
        console.error(`Provider '${providerName}' does not support token logprobs.`);
        process.exit(1);
      }
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
    let sapDurations = null;
    const sapGamma = options.gamma ?? config.gamma ?? DEFAULT_PARAMS.gamma;
    const sapTargetWpm = options.targetWpm ?? config.targetWpm ?? DEFAULT_PARAMS.target_wpm;

    // Process with SAP if --auto mode
    if (options.auto) {
      const sapParams = {
        target_wpm: sapTargetWpm,
        gamma: sapGamma,
      };

      // Check cache first
      const cached = getCache(text);
      if (cached && cached.items && cached.surprisalBits) {
        console.log('Using cached semantic analysis...');
        // Recompute durations with current params (in case gamma changed)
        sapDurations = computeDurations(cached.items, cached.surprisalBits, sapParams);
        console.log(`Loaded ${cached.items.length} words from cache. Starting...`);
      } else {
        // Estimate cost before processing
        const costEstimate = estimateSapCost(text, {
          provider: options.provider,
        }, sapParams);

        console.log(`Estimated cost: $${costEstimate.cost.toFixed(4)} (${costEstimate.inputTokens} input + ${costEstimate.outputTokens} output tokens, model: ${costEstimate.model})`);

        if (costEstimate.cost > options.maxCost) {
          const confirmed = await confirm(`Cost exceeds $${options.maxCost.toFixed(2)} threshold. Continue?`);
          if (!confirmed) {
            console.log('Aborted.');
            process.exit(0);
          }
        }

        console.log('Analyzing text for semantic adaptive pacing...');

        // Create scoring function for LLM
        const scoreFn = async (contextText, chunkText) => {
          return scoreTokens(contextText, chunkText, {
            provider: options.provider,
            model: options.model,
          });
        };

        let lastProgress = -1;
        const onProgress = (current, total) => {
          const percent = Math.round((current / total) * 100);
          if (percent !== lastProgress && percent % 10 === 0) {
            process.stdout.write(`\rProcessing: ${percent}%`);
            lastProgress = percent;
          }
        };

        const sapResult = await processText(text, scoreFn, sapParams, onProgress);

        // Cache the result (items and surprisalBits, not durations)
        setCache(text, {
          items: sapResult.items,
          surprisalBits: sapResult.surprisalBits,
        });

        sapDurations = sapResult.durations;

        process.stdout.write('\r');
        console.log(`Processed ${sapResult.items.length} words. Starting...`);
      }
    }

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
      questionPositions,
      {
        autoMode: options.auto,
        durations: sapDurations,
        gamma: sapGamma,
        targetWpm: sapTargetWpm,
      }
    );

    reader.on('configChange', (newConfig) => {
      if (!options.demo) {
        saveConfig(newConfig);
      }
    });

    reader.on('gammaChange', (newGamma) => {
      if (!options.demo) {
        config.gamma = newGamma;
        saveConfig(config);
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
