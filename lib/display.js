const EventEmitter = require('events');
const readline = require('readline');

// ANSI escape codes
const ANSI = {
  clear: '\x1b[2J',
  home: '\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  colors: {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  },
};

const PUNCTUATION_CHARS = ['.', ',', '!', '?', ';', ':', '-', '(', ')', '"', "'"];
const PUNCTUATION_PAUSE_MS = 200;
const WPM_INCREMENT = 10;
const MIN_WPM = 50;
const MAX_WPM = 1000;
const GAMMA_INCREMENT = 0.1;
const MIN_GAMMA = 0.0;
const MAX_GAMMA = 2.0;

class SpeedReader extends EventEmitter {
  constructor(text, config, isPipeMode = false, maxWords = 0, questionPositions = [], options = {}) {
    super();
    this.words = parseWords(text);
    this.config = { ...config };
    this.isPipeMode = isPipeMode;
    this.maxWords = maxWords;
    this.questionPositions = questionPositions;
    this.currentIndex = 0;
    this.running = false;
    this.paused = false;
    this.timer = null;

    // Question mode state
    this.inQuestionMode = false;
    this.currentQuestion = null;
    this.questionIndex = 0;
    this.score = 0;
    this.totalQuestions = questionPositions.length;

    // Timing
    this.startTime = null;
    this.elapsedTime = 0;

    // Auto mode (SAP) - variable durations per word
    this.autoMode = options.autoMode || false;
    this.durations = options.durations || null; // Per-word durations in ms
    this.gamma = options.gamma || 0.6;
    this.baseGamma = options.gamma || 0.6; // Original gamma for recalculation
    this.baseWpm = options.targetWpm || config.wpm; // Original target WPM for scaling

    // Stats for auto mode
    this.totalDisplayTime = 0;
    this.wordsDisplayed = 0;
  }

  get wpm() {
    return this.config.wpm;
  }

  set wpm(value) {
    this.config.wpm = Math.max(MIN_WPM, Math.min(MAX_WPM, value));
    this.emit('configChange', this.config);
  }

  get delayMs() {
    return Math.round(60000 / this.wpm);
  }

  async start() {
    if (this.words.length === 0) {
      throw new Error('No words to display');
    }

    this.running = true;
    this.startTime = Date.now();
    this.setupKeyboardInput();

    // Hide cursor and clear screen
    process.stdout.write(ANSI.hideCursor);

    // Handle resize
    process.stdout.on('resize', () => {
      if (this.inQuestionMode) {
        this.renderQuestion();
      } else {
        this.render();
      }
    });

    // Handle unexpected exits
    const cleanup = () => this.stop();
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', () => {
      // Ensure terminal is restored even on unexpected exit
      if (process.stdin.isTTY && process.stdin.isRaw) {
        process.stdin.setRawMode(false);
      }
      process.stdout.write(ANSI.showCursor);
      process.stdout.write(ANSI.reset);
    });

    // Start the display loop
    this.scheduleNext();

    // Wait until done
    return new Promise((resolve) => {
      this.once('done', (result) => resolve(result));
    });
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.elapsedTime = Date.now() - this.startTime;

    // Restore terminal state
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();

    // Show cursor and clear screen
    process.stdout.write(ANSI.showCursor);
    process.stdout.write(ANSI.clear);
    process.stdout.write(ANSI.home);
    process.stdout.write(ANSI.reset);

    const result = this.totalQuestions > 0 ? {
      score: this.score,
      total: this.totalQuestions,
      elapsedTime: this.elapsedTime,
    } : null;

    this.emit('done', result);
  }

  setupKeyboardInput() {
    readline.emitKeypressEvents(process.stdin);

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdin.on('keypress', (str, key) => {
      if (!key) return;

      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) {
        this.stop();
        return;
      }

      // Handle question mode input
      if (this.inQuestionMode) {
        this.handleQuestionInput(str, key);
        return;
      }

      switch (key.name) {
        case 'left':
          this.goBack();
          break;
        case 'right':
          this.goForward();
          break;
        case 'up':
          this.increaseSpeed();
          break;
        case 'down':
          this.decreaseSpeed();
          break;
        case 'space':
          this.togglePause();
          break;
        default:
          // Handle +/- for gamma in auto mode
          if (this.autoMode && (str === '+' || str === '=')) {
            this.increaseGamma();
          } else if (this.autoMode && (str === '-' || str === '_')) {
            this.decreaseGamma();
          }
          break;
      }
    });

    process.stdin.resume();
  }

  handleQuestionInput(str, _key) {
    const num = parseInt(str, 10);
    if (num >= 1 && num <= this.currentQuestion.choices.length) {
      const answerIndex = num - 1;
      const isCorrect = answerIndex === this.currentQuestion.correct;

      if (isCorrect) {
        this.score++;
      }

      // Show brief feedback
      this.showAnswerFeedback(isCorrect);

      // Exit question mode after brief delay
      setTimeout(() => {
        this.inQuestionMode = false;
        this.currentQuestion = null;
        this.questionIndex++;
        this.scheduleNext();
      }, 800);
    }
  }

  showAnswerFeedback(isCorrect) {
    const rows = process.stdout.rows || 24;
    const columns = process.stdout.columns || 80;

    process.stdout.write(ANSI.clear);
    process.stdout.write(ANSI.home);

    const centerRow = Math.floor(rows / 2);

    const feedbackText = isCorrect
      ? `${ANSI.colors.green}${ANSI.bold}Correct!${ANSI.reset}`
      : `${ANSI.colors.red}${ANSI.bold}Wrong!${ANSI.reset} The answer was: ${this.currentQuestion.choices[this.currentQuestion.correct]}`;

    const plainText = isCorrect ? 'Correct!' : `Wrong! The answer was: ${this.currentQuestion.choices[this.currentQuestion.correct]}`;
    const col = Math.max(1, Math.floor((columns - plainText.length) / 2));

    process.stdout.write(`\x1b[${centerRow};${col}H`);
    process.stdout.write(feedbackText);

    // Show current score
    const scoreText = `Score: ${this.score}/${this.questionIndex + 1}`;
    const scoreCol = Math.max(1, Math.floor((columns - scoreText.length) / 2));
    process.stdout.write(`\x1b[${centerRow + 2};${scoreCol}H`);
    process.stdout.write(scoreText);
  }

  goBack() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
      this.reschedule();
    }
  }

  goForward() {
    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.render();
      this.reschedule();
    }
  }

  increaseSpeed() {
    this.wpm += WPM_INCREMENT;
    this.render();
    this.reschedule();
  }

  decreaseSpeed() {
    this.wpm -= WPM_INCREMENT;
    this.render();
    this.reschedule();
  }

  increaseGamma() {
    this.gamma = Math.min(MAX_GAMMA, this.gamma + GAMMA_INCREMENT);
    this.emit('gammaChange', this.gamma);
    this.render();
    this.reschedule();
  }

  decreaseGamma() {
    this.gamma = Math.max(MIN_GAMMA, this.gamma - GAMMA_INCREMENT);
    this.emit('gammaChange', this.gamma);
    this.render();
    this.reschedule();
  }

  get currentDuration() {
    if (this.autoMode && this.durations && this.durations[this.currentIndex] !== undefined) {
      let duration = this.durations[this.currentIndex];

      // Scale by WPM ratio (higher WPM = shorter duration)
      const wpmScale = this.baseWpm / this.wpm;
      duration = duration * wpmScale;

      // Scale slowdown portion by gamma ratio if gamma changed
      if (this.gamma !== this.baseGamma) {
        const baseMs = Math.round(60000 / this.baseWpm) * wpmScale;
        const slowdownPortion = duration - baseMs;
        const scaledSlowdown = slowdownPortion * (this.gamma / this.baseGamma);
        duration = baseMs + scaledSlowdown;
      }

      return Math.round(duration);
    }
    // Fallback to WPM-based delay
    return this.delayMs;
  }

  get averageWPM() {
    if (this.wordsDisplayed === 0 || this.totalDisplayTime === 0) {
      return this.wpm;
    }
    // WPM = words / minutes = words / (totalDisplayTime_ms / 60000)
    return Math.round(this.wordsDisplayed / (this.totalDisplayTime / 60000));
  }

  get currentWPM() {
    const duration = this.currentDuration;
    if (duration === 0) return this.wpm;
    return Math.round(60000 / duration);
  }

  togglePause() {
    this.paused = !this.paused;
    if (!this.paused) {
      this.scheduleNext();
    } else if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.render();
  }

  reschedule() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.paused) {
      this.scheduleNext();
    }
  }

  checkForQuestion() {
    if (this.questionIndex >= this.questionPositions.length) {
      return null;
    }

    const nextQuestion = this.questionPositions[this.questionIndex];
    if (nextQuestion && this.currentIndex >= nextQuestion.wordIndex) {
      return nextQuestion.question;
    }

    return null;
  }

  scheduleNext() {
    if (!this.running || this.paused || this.inQuestionMode) return;

    // Check if we should show a question
    const question = this.checkForQuestion();
    if (question) {
      this.inQuestionMode = true;
      this.currentQuestion = question;
      this.renderQuestion();
      return;
    }

    const word = this.words[this.currentIndex];

    // Calculate delay: use per-word duration in auto mode, otherwise WPM-based
    let delay;
    if (this.autoMode && this.durations) {
      delay = this.currentDuration;
    } else {
      const hasPunctuation = PUNCTUATION_CHARS.some((p) => word.endsWith(p));
      delay = this.delayMs + (hasPunctuation ? PUNCTUATION_PAUSE_MS : 0);
    }

    // Track stats for auto mode
    if (this.autoMode) {
      this.totalDisplayTime += delay;
      this.wordsDisplayed++;
    }

    this.render();

    this.timer = setTimeout(() => {
      const reachedMaxWords = this.maxWords > 0 && this.currentIndex >= this.maxWords - 1;
      if (this.currentIndex < this.words.length - 1 && !reachedMaxWords) {
        this.currentIndex++;
        this.scheduleNext();
      } else {
        // Reached the end or maxWords limit
        setTimeout(() => this.stop(), 500);
      }
    }, delay);
  }

  renderQuestion() {
    const rows = process.stdout.rows || 24;
    const columns = process.stdout.columns || 80;
    const q = this.currentQuestion;

    process.stdout.write(ANSI.clear);
    process.stdout.write(ANSI.home);

    // Calculate starting row for centering
    const totalLines = 2 + q.choices.length + 2; // question + blank + choices + blank + instruction
    const startRow = Math.max(1, Math.floor((rows - totalLines) / 2));

    // Draw question number and text
    const questionHeader = `Question ${this.questionIndex + 1}/${this.totalQuestions}`;
    const headerCol = Math.max(1, Math.floor((columns - questionHeader.length) / 2));
    process.stdout.write(`\x1b[${startRow};${headerCol}H`);
    process.stdout.write(`${ANSI.bold}${questionHeader}${ANSI.reset}`);

    // Word wrap the question if needed
    const questionText = q.question;
    const maxWidth = Math.min(columns - 4, 70);
    const wrappedQuestion = wordWrap(questionText, maxWidth);

    let currentRow = startRow + 2;
    for (const line of wrappedQuestion) {
      const col = Math.max(1, Math.floor((columns - line.length) / 2));
      process.stdout.write(`\x1b[${currentRow};${col}H`);
      process.stdout.write(line);
      currentRow++;
    }

    currentRow++;

    // Draw choices
    for (let i = 0; i < q.choices.length; i++) {
      const choiceText = `${i + 1}. ${q.choices[i]}`;
      const col = Math.max(1, Math.floor((columns - choiceText.length) / 2));
      process.stdout.write(`\x1b[${currentRow};${col}H`);
      process.stdout.write(`${ANSI.colors.cyan}${i + 1}.${ANSI.reset} ${q.choices[i]}`);
      currentRow++;
    }

    currentRow++;

    // Draw instruction
    const instruction = 'Press 1-' + q.choices.length + ' to answer';
    const instrCol = Math.max(1, Math.floor((columns - instruction.length) / 2));
    process.stdout.write(`\x1b[${currentRow};${instrCol}H`);
    process.stdout.write(`${ANSI.colors.yellow}${instruction}${ANSI.reset}`);

    // Show score in corner
    const scoreText = `Score: ${this.score}/${this.questionIndex}`;
    process.stdout.write(`\x1b[1;${columns - scoreText.length}H`);
    process.stdout.write(scoreText);
  }

  render() {
    const rows = process.stdout.rows || 24;
    const columns = process.stdout.columns || 80;
    const word = this.words[this.currentIndex];
    const highlightColor = ANSI.colors[this.config.highlightColor] || ANSI.colors.red;

    // Clear screen
    process.stdout.write(ANSI.clear);
    process.stdout.write(ANSI.home);

    // Calculate median position
    const medianIndex = getMedianIndex(word);

    // Build the word with highlighted median letter
    let displayWord = '';
    for (let i = 0; i < word.length; i++) {
      if (i === medianIndex) {
        displayWord += highlightColor + word[i] + ANSI.reset;
      } else {
        displayWord += word[i];
      }
    }

    // Calculate position to center the median letter on screen
    const centerCol = Math.floor(columns / 2);
    const centerRow = Math.floor(rows / 2);

    // Position word so median letter is at center
    const wordStartCol = Math.max(0, centerCol - medianIndex);

    // Move cursor to center row and calculated column
    process.stdout.write(`\x1b[${centerRow};${wordStartCol}H`);
    process.stdout.write(displayWord);

    // Draw status indicator at top right
    let statusText;
    if (this.autoMode) {
      // In auto mode: show current WPM, average WPM, and gamma
      statusText = `${this.currentWPM} WPM (avg: ${this.averageWPM}) | γ=${this.gamma.toFixed(1)}`;
    } else {
      statusText = `${this.wpm} WPM`;
    }
    if (this.paused) {
      statusText += ' [PAUSED]';
    }
    if (this.totalQuestions > 0) {
      statusText = `Score: ${this.score}/${this.questionIndex} | ${statusText}`;
    }
    process.stdout.write(`\x1b[1;${Math.max(1, columns - statusText.length)}H`);
    process.stdout.write(statusText);

    // Draw progress bar at bottom (except in pipe mode)
    if (!this.isPipeMode) {
      this.renderProgressBar(rows, columns);
    }
  }

  renderProgressBar(rows, columns) {
    const progress = this.currentIndex / (this.words.length - 1);
    const barWidth = columns - 4; // Leave room for brackets and padding
    const filledWidth = Math.round(progress * barWidth);

    let bar = '[';
    for (let i = 0; i < barWidth; i++) {
      if (i < filledWidth) {
        bar += '=';
      } else if (i === filledWidth) {
        bar += '>';
      } else {
        bar += ' ';
      }
    }
    bar += ']';

    // Position at one line from bottom
    process.stdout.write(`\x1b[${rows - 1};1H`);
    process.stdout.write(bar);
  }
}

function parseWords(text) {
  // Split on whitespace, keeping words with punctuation, hyphens, apostrophes
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

function getMedianIndex(word) {
  // Get the index of the median letter (middle character)
  // For even length, use the character just before middle
  if (word.length === 0) return 0;
  if (word.length === 1) return 0;
  if (word.length === 2) return 0;
  return Math.floor((word.length - 1) / 2);
}

function wordWrap(text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

module.exports = { SpeedReader, parseWords, getMedianIndex };
