# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`srit` (Speed Read It!) is a Node.js CLI tool for speed reading text. It displays one word at a time centered on the terminal, with the median letter highlighted in red and fixed in position.

## Build and Run Commands

```bash
npm install           # Install dependencies
npm link              # Link globally for development
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
  extractors.js       # Text extraction from txt/md/pdf/doc/docx/URL/stdin
  display.js          # Terminal display, word parsing, keyboard handling
```

### Key Components

**SpeedReader class** (`lib/display.js`): Main class that handles:
- Word-by-word display with ANSI escape codes for terminal control
- Median letter calculation and highlighting
- Keyboard input via readline in raw mode
- Progress bar rendering (disabled in pipe mode)

**Text Extractors** (`lib/extractors.js`):
- Plain text/markdown: direct file read
- PDF: uses `pdf-parse`
- DOC/DOCX: uses `mammoth`
- URL: built-in `fetch` with HTML tag stripping
- Stdin: streaming read

### Configuration

Stored in `~/.srit.json`:
- `wpm`: words per minute (default: 300)
- `highlightColor`: ANSI color name (default: "red")

### Constants

- Default pace: 300 WPM
- Pace increment: ±10 WPM (range: 50-1000)
- Punctuation pause: 300ms
- Supported formats: txt, md, pdf, doc, docx

### User Controls

- Left/Right arrows: navigate words
- Up/Down arrows: adjust speed
- Space: pause/resume
- Escape: exit
