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
  config.js           # Config management (~/.srit.json)
  display.js          # Terminal display, word parsing, keyboard handling, questions
  extractors.js       # Text extraction from txt/md/pdf/doc/docx/URL/stdin
  llm.js              # Multi-provider LLM abstraction (OpenAI, Anthropic, Gemini)
  questions.js        # Question generation and distribution logic
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
- Multi-provider support: OpenAI, Anthropic, Gemini
- Auto-detects available API key from environment
- Standard env vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`

**Question Generator** (`lib/questions.js`):
- Uses LLM to generate multiple-choice comprehension questions
- Distributes questions at sentence boundaries
- Supports fixed count (`--questions N`) or frequency (`--frequency N`)

### Configuration

Stored in `~/.srit.json`:
- `wpm`: words per minute (default: 300)
- `highlightColor`: ANSI color name (default: "red")

### CLI Options

```
srit [options] <file|url|->

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
- Space: pause/resume
- Escape: exit
- 1-4 keys: answer questions (in check mode)
