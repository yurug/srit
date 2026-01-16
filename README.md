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

## Comprehension Check Mode

Test your reading comprehension with AI-generated questions:

![demo-check](https://raw.githubusercontent.com/yurug/srit/main/demo-check.gif)

```bash
srit --check document.txt
```

Questions appear throughout your reading, placed at sentence boundaries to avoid interrupting the flow. Answer with number keys (1-4). At the end, you'll see your score and total reading time.

### Options

| Option | Description |
|--------|-------------|
| `--questions N` | Number of questions (default: 10) |
| `--frequency N` | Target words between questions |
| `--provider NAME` | LLM provider: `openai`, `anthropic`, or `gemini` |
| `--model NAME` | Specific model to use |

### API Keys

Set one of these environment variables:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GEMINI_API_KEY=...
```

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
