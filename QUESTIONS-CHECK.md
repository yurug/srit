# Questions for --check Feature

## 1. LLM Provider

- **Which LLM API?** OpenAI, Anthropic, or support multiple providers?

Support multiple providers, use env variables to get API keys and
command line to specify providers and models. If nothing is specified,
use the first API key that you find with a fast model.

- **API key handling**: Environment variable (`SRIT_API_KEY`)? Config file (`~/.srit.json`)?

No, use the standard names : OPENAI_API_KEY, GEMINI_API_KEY, etc

- **Model choice**: Specific model (e.g., gpt-4o-mini, claude-3-haiku) or configurable?

configurable

## 2. Question Generation

- **When to generate?** Pre-generate all questions before reading starts, or generate on-the-fly?

Before reading, to avoid any latency issue.

- **Question frequency**: Every N words? Every paragraph? Fixed number of questions per text?

Random but we want to have 10 questions in a run by default. This is
configurable using a command line option:
- --questions 10   "10 questions"
- --frequency 500  "on average a question every 500 words"

- **Question placement**: After sentences only, or can interrupt mid-paragraph?

After sentences only.


## 3. Question Display

- **How to show questions?**
  - a) Replace the word display with question text
  - b) Show below the current word
  - c) Full-screen question mode (clear and center the question)

c

- **Choice selection**: Number keys (1-4)? Arrow keys + Enter?

Number keys

## 4. Scoring

- **Points system**: +1 per correct answer? Weighted by difficulty?

Simple: +1 per correct answer.

- **Wrong answer penalty**: Lose points? Just no points gained?

No points

- **Final score format**: "7/10 correct" or percentage or both?

Both.

## 5. Timing

- **Reading pause**: Does the reading auto-pause when a question appears?

Yes

- **Time limit per question**: Unlimited? Fixed timeout (e.g., 10 seconds)?

Unlimited by the final score line displays the full time taken to complete the run.

- **Time tracking**: Total elapsed time? Or just reading time (excluding question time)?

Total elapsed time

## 6. Error Handling

- **No API key**: Skip questions and read normally? Exit with error?

If --check is provided, exit with error

- **API failure mid-read**: Continue without remaining questions? Retry?

That's why we want to decide all questions before starting read.

- **Offline mode**: Cache questions for previously-read files?

Nope, the random questions are important for the game.

---

Please edit this file with your answers.
