# Speed Read It!

[![npm version](https://img.shields.io/npm/v/@yurug-js/srit.svg)](https://www.npmjs.com/package/@yurug-js/srit)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A command line tool to speed read any text using RSVP (Rapid Serial Visual Presentation).

![demo](https://raw.githubusercontent.com/yurug/srit/main/demo.gif)

## Installation

```bash
npm i -g @yurug-js/srit
```

Requires Node.js 18 or higher.

## Features

- Read text, markdown, PDF, Word documents (.doc/.docx), and web pages
- Adjustable reading speed (words per minute)
- Median letter highlighting for optimal eye fixation
- Progress bar showing position in text
- Pipe mode for reading from stdin
- AI-powered adaptive pacing (slows on complex words)
- AI-powered comprehension testing

## Usage

```bash
srit document.txt          # Plain text file
srit article.md            # Markdown (rendered to plain text)
srit report.pdf            # PDF document
srit paper.doc             # Word document
srit paper.docx            # Word document (modern format)
srit https://example.com   # Web page
cat file.txt | srit -      # Read from stdin
```

The terminal clears and displays one word at a time, centered on screen. The median letter is highlighted in red to provide an optimal fixation point. Punctuation introduces a brief pause for natural reading rhythm.

### Keyboard Controls

| Key | Action |
|-----|--------|
| `←` | Previous word |
| `→` | Next word |
| `↑` | Increase speed |
| `↓` | Decrease speed |
| `Esc` | Exit |

## Adaptive Pacing Mode

Let AI adjust your reading speed based on text complexity:

![demo-auto](https://raw.githubusercontent.com/yurug/srit/main/demo-auto.gif)

```bash
srit --auto document.txt
```

Uses LLM token surprisal to slow down on complex or unusual words, with a smooth "halo" effect around surprising content. Results are cached for instant re-runs.

| Option | Description |
|--------|-------------|
| `--gamma N` | Slowdown intensity (0.0-2.0, default: 0.6) |
| `--target-wpm N` | Base target WPM (default: 360) |
| `--max-cost N` | Cost threshold before confirmation (default: $1) |

Controls: `+`/`-` adjust gamma, `↑`/`↓` adjust speed.

## Comprehension Check Mode

Test your reading comprehension with AI-generated questions:

![demo-check](https://raw.githubusercontent.com/yurug/srit/main/demo-check.gif)

```bash
srit --check document.txt
```

Questions appear throughout your reading, placed at sentence boundaries to avoid interrupting the flow. Answer with number keys (1-4). At the end, you'll see your score and total reading time.

| Option | Description |
|--------|-------------|
| `--questions N` | Number of questions (default: 10) |
| `--frequency N` | Target words between questions |

## API Keys

Both `--auto` and `--check` modes require an LLM provider.

**Cloud providers** (require API key):
```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GEMINI_API_KEY=...
```

**Local with Ollama** (free, no API key):
```bash
srit --auto --provider ollama document.txt
```
Requires [Ollama](https://ollama.com) running locally. Set `OLLAMA_HOST` to override the default `http://localhost:11434`.

Additional options: `--provider NAME` and `--model NAME` to override defaults.

## Configuration

Settings are stored in `~/.srit.json`:

```json
{
  "wpm": 300,
  "highlightColor": "red",
  "textColor": "white"
}
```

Available colors: black, red, green, yellow, blue, magenta, cyan, white.

## Other Options

```bash
srit --version    # Show version number
srit --help       # Show help (use -h)
```

## License

MIT

## Philosophy

This program follows the KISS principle: it does one specific thing and aims to do it right, with minimal dependencies and clear semantics. Contributions are welcome as long as they adhere to this philosophy!
