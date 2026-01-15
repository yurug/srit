const EventEmitter = require('events');
const readline = require('readline');

// ANSI escape codes
const ANSI = {
  clear: '\x1b[2J',
  home: '\x1b[H',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',
  reset: '\x1b[0m',
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

class SpeedReader extends EventEmitter {
  constructor(text, config, isPipeMode = false) {
    super();
    this.words = parseWords(text);
    this.config = { ...config };
    this.isPipeMode = isPipeMode;
    this.currentIndex = 0;
    this.running = false;
    this.paused = false;
    this.timer = null;
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
    this.setupKeyboardInput();

    // Hide cursor and clear screen
    process.stdout.write(ANSI.hideCursor);

    // Handle resize
    process.stdout.on('resize', () => this.render());

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
      this.once('done', resolve);
    });
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

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

    this.emit('done');
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
      }
    });

    process.stdin.resume();
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

  scheduleNext() {
    if (!this.running || this.paused) return;

    const word = this.words[this.currentIndex];
    const hasPunctuation = PUNCTUATION_CHARS.some((p) => word.endsWith(p));
    const delay = this.delayMs + (hasPunctuation ? PUNCTUATION_PAUSE_MS : 0);

    this.render();

    this.timer = setTimeout(() => {
      if (this.currentIndex < this.words.length - 1) {
        this.currentIndex++;
        this.scheduleNext();
      } else {
        // Reached the end
        setTimeout(() => this.stop(), 1000);
      }
    }, delay);
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

    // Draw WPM indicator at top right
    const wpmText = `${this.wpm} WPM${this.paused ? ' [PAUSED]' : ''}`;
    process.stdout.write(`\x1b[1;${columns - wpmText.length}H`);
    process.stdout.write(wpmText);

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

module.exports = { SpeedReader, parseWords, getMedianIndex };
