# Questions for --check Feature

## 1. LLM Provider

- **Which LLM API?** OpenAI, Anthropic, or support multiple providers?
- **API key handling**: Environment variable (`SRIT_API_KEY`)? Config file (`~/.srit.json`)?
- **Model choice**: Specific model (e.g., gpt-4o-mini, claude-3-haiku) or configurable?

## 2. Question Generation

- **When to generate?** Pre-generate all questions before reading starts, or generate on-the-fly?
- **Question frequency**: Every N words? Every paragraph? Fixed number of questions per text?
- **Question placement**: After sentences only, or can interrupt mid-paragraph?

## 3. Question Display

- **How to show questions?**
  - a) Replace the word display with question text
  - b) Show below the current word
  - c) Full-screen question mode (clear and center the question)
- **Choice selection**: Number keys (1-4)? Arrow keys + Enter?

## 4. Scoring

- **Points system**: +1 per correct answer? Weighted by difficulty?
- **Wrong answer penalty**: Lose points? Just no points gained?
- **Final score format**: "7/10 correct" or percentage or both?

## 5. Timing

- **Reading pause**: Does the reading auto-pause when a question appears?
- **Time limit per question**: Unlimited? Fixed timeout (e.g., 10 seconds)?
- **Time tracking**: Total elapsed time? Or just reading time (excluding question time)?

## 6. Error Handling

- **No API key**: Skip questions and read normally? Exit with error?
- **API failure mid-read**: Continue without remaining questions? Retry?
- **Offline mode**: Cache questions for previously-read files?

---

Please edit this file with your answers.
