# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`srit` (Speed Read It!) is a Node.js CLI tool for speed reading text. It displays one word at a time centered on the terminal, with the median letter highlighted in red and fixed in position.

## Build and Run Commands

```bash
npm install           # Install dependencies
npm run lint          # Run ESLint
npm test              # Run tests
srit <file|url|->     # Run the tool
```

**Run directly without linking:**
```bash
node bin/srit.js <file>
```

## Architecture

```
bin/srit.js           # CLI entry point - parses args, orchestrates flow
lib/
  cache.js            # File-based cache for SAP results (~/.cache/srit/)
  config.js           # Config management (~/.srit.json)
  display.js          # Terminal display, word parsing, keyboard handling, questions
  extractors.js       # Text extraction from txt/md/pdf/doc/docx/URL/stdin
  llm.js              # Multi-provider LLM abstraction (OpenAI, Anthropic, Gemini)
  questions.js        # Question generation and distribution logic
  sap.js              # Semantic Adaptive Pacing (SAP-N3) for --auto mode
test/
  display.test.js     # Unit tests for parsing functions
```

### Key Components

**SpeedReader class** (`lib/display.js`): Main class that handles:
- Word-by-word display with ANSI escape codes for terminal control
- Median letter calculation and highlighting
- Keyboard input via readline in raw mode
- Progress bar rendering (disabled in pipe mode)
- Question display and scoring (when --check mode enabled)

**LLM Module** (`lib/llm.js`):
- Multi-provider support: OpenAI, Anthropic, Gemini, Ollama
- Auto-detects available API key from environment
- Standard env vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OLLAMA_HOST`
- Token logprobs scoring for SAP (OpenAI, Gemini, Ollama)

**SAP Module** (`lib/sap.js`):
- Semantic Adaptive Pacing with Neighbor Slowdown (SAP-N3)
- Computes per-word display durations using LLM token surprisal
- Applies smooth "halo" slowdown around surprising words
- Chunks text for bounded LLM usage
- Results cached in `~/.cache/srit/` (by text content hash)

**Question Generator** (`lib/questions.js`):
- Uses LLM to generate multiple-choice comprehension questions
- Distributes questions at sentence boundaries
- Supports fixed count (`--questions N`) or frequency (`--frequency N`)

### Configuration

Stored in `~/.srit.json`:
- `wpm`: words per minute (default: 300)
- `highlightColor`: ANSI color name (default: "red")
- `gamma`: slowdown intensity for --auto mode (default: 0.6)
- `targetWpm`: target WPM for --auto mode (default: 360)

### CLI Options

```
srit [options] <file|url|->

--auto               Enable semantic adaptive pacing (requires OpenAI/Gemini)
--gamma N            Slowdown intensity for --auto (0.0-2.0, default: 0.6)
--target-wpm N       Target WPM for --auto mode (default: 360)
--max-cost N         Cost threshold in USD before confirmation (default: 1.0)
--check              Enable comprehension check mode (requires LLM API key)
--questions N        Number of questions (default: 10)
--frequency N        Average words between questions
--provider NAME      LLM provider (openai, anthropic, gemini)
--model NAME         LLM model to use
--demo               Demo mode (fast, limited words)
```

### Constants

- Default pace: 300 WPM
- Pace increment: ±10 WPM (range: 50-1000)
- Punctuation pause: 200ms
- Supported formats: txt, md, pdf, doc, docx

### User Controls

- Left/Right arrows: navigate words
- Up/Down arrows: adjust speed
- +/- keys: adjust gamma (in --auto mode)
- Space: pause/resume
- Escape: exit
- 1-4 keys: answer questions (in --check mode)
