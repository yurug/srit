# Implementation Questions for srit

Please answer these questions to clarify the implementation details:

## 1. Language & Dependencies

The README says "no dependencies" but also `npm i -g @yurug/srit`.
- **Should I use Node.js?** Or would you prefer a different language (Python, Go, Rust)?
- **PDF/DOC parsing** inherently requires libraries. Should I:
  - a) Drop PDF/DOC support to maintain zero dependencies
  - b) Use external tools (like `pdftotext`, `antiword`) as optional system commands
  - c) Allow npm dependencies for these formats only

Answer:
Forget about "no dependencies" replace with "minimal dependencies".

## 2. Display & Highlighting

- **Median letter color**: What color for highlighting? (red, yellow, inverse, bold, etc.)

Default is red.

- **Background**: Should the terminal be cleared to black, or use the terminal's default background?

Just keep it the way it is, by default, and allow configuration in the config file.

## 3. Pace Settings

- **Default pace**: What words-per-minute to start with? (e.g., 250 WPM, 300 WPM?)

300 WPM

- **Pace increment**: How much should up/down arrows change the pace? (e.g., ±25 WPM, ±50 WPM?)

+10 WPM

- **Punctuation pause**: How long? (e.g., 1.5x normal delay, 2x, fixed 300ms?)

fixed 300ms

## 4. Word Parsing

- **Hyphenated words**: Treat "self-contained" as one word or two?
One

- **Numbers**: Display "12345" as a single "word"?
Yes

- **Contractions**: Keep "don't" together?
Yes

## 5. Progress Bar

- **Style**: Simple `[=====>    ]` or something else?

Simple.

- **Position**: Bottom of screen? How many lines from bottom?

One line from bottom.

## 6. Error Handling

- **Invalid file**: Exit with error message, or prompt for another file?

Exit with error message.

- **URL fetch failure**: Retry? Exit?

Exit with error message.

- **Unsupported format**: What message to show?

Exit with error message (unsupported format, and list support formats)

---

Please edit this file with your answers, or respond with your preferences.
