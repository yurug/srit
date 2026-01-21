/**
 * SAP-N3: Semantic Adaptive Pacing with Neighbor Slowdown
 *
 * Adjusts per-word RSVP display duration using LLM token surprisal,
 * with a smooth slowdown "halo" around surprising tokens.
 */

const DEFAULT_PARAMS = {
  target_wpm: 360,
  chunk_size_words: 16,
  chunk_overlap_context_words: 12,
  context_window_tokens: 64,
  alpha: 1.0,
  beta: 2.0,
  e_max: 2.0,
  kernel_radius: 3,
  kernel_weights: [0.15, 0.30, 0.60, 1.00, 0.60, 0.30, 0.15],
  gamma: 0.6,
  min_ms: 80,
  max_ms: 800,
  comma_bonus_ms: 60,
  period_bonus_ms: 120,
  para_bonus_ms: 180
};

/**
 * Segment text into RSVP items (words with attached trailing punctuation)
 * @param {string} text - Input text
 * @returns {Array<{text: string, startChar: number, endChar: number, endsWith: string}>}
 */
function itemize(text) {
  const items = [];
  // Match words with optional trailing punctuation, preserving positions
  const regex = /\S+/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const word = match[0];
    const startChar = match.index;
    const endChar = match.index + word.length;

    // Determine ending punctuation type
    let endsWith = 'none';
    const lastChar = word[word.length - 1];

    // Check for paragraph break (newlines after this word)
    const afterWord = text.slice(endChar);
    const newlineMatch = afterWord.match(/^(\s*\n\s*\n)/);
    if (newlineMatch) {
      endsWith = 'para';
    } else if ('.!?'.includes(lastChar)) {
      endsWith = 'period';
    } else if (',;:'.includes(lastChar)) {
      endsWith = 'comma';
    }

    items.push({ text: word, startChar, endChar, endsWith });
  }

  return items;
}

/**
 * Create chunk plan for LLM scoring
 * @param {Array} items - RSVP items
 * @param {object} params - Parameters
 * @returns {Array<{startItem: number, endItem: number, contextStartItem: number}>}
 */
function chunkPlan(items, params = {}) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const chunks = [];

  let i = 0;
  while (i < items.length) {
    const startItem = i;
    const endItem = Math.min(i + p.chunk_size_words, items.length);
    const contextStartItem = Math.max(0, startItem - p.chunk_overlap_context_words);

    chunks.push({ startItem, endItem, contextStartItem });
    i = endItem;
  }

  return chunks;
}

/**
 * Align LLM tokens to RSVP items based on character positions
 * @param {Array} items - RSVP items
 * @param {Array<{token: string, logprob: number, startChar: number, endChar: number}>} lmTokens
 * @param {number} textStartChar - Starting character offset of the scored text
 * @returns {Array<number>} - Maps token index to item index
 */
function alignTokensToItems(items, lmTokens, textStartChar) {
  const tokenToItem = [];

  for (const token of lmTokens) {
    const tokenStart = textStartChar + token.startChar;
    const tokenEnd = textStartChar + token.endChar;

    // Find overlapping item
    let foundItem = -1;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Check overlap
      if (tokenStart < item.endChar && tokenEnd > item.startChar) {
        foundItem = i;
        break;
      }
    }
    tokenToItem.push(foundItem);
  }

  return tokenToItem;
}

/**
 * Compute median of array
 */
function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute Median Absolute Deviation
 */
function mad(arr, med) {
  if (arr.length === 0) return 0;
  const deviations = arr.map(x => Math.abs(x - med));
  return median(deviations);
}

/**
 * Compute durations for all items based on surprisal values
 * @param {Array} items - RSVP items
 * @param {Array<number>} surprisalBits - Per-item surprisal in bits
 * @param {object} params - Parameters
 * @returns {Array<number>} - Duration in ms for each item
 */
function computeDurations(items, surprisalBits, params = {}) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const n = items.length;

  // Base duration from target WPM
  const baseMs = Math.round(60000 / p.target_wpm);

  // If no surprisal data, return base durations with punctuation bonuses
  if (!surprisalBits || surprisalBits.length === 0) {
    return items.map(item => {
      let duration = baseMs;
      if (item.endsWith === 'para') duration += p.para_bonus_ms;
      else if (item.endsWith === 'period') duration += p.period_bonus_ms;
      else if (item.endsWith === 'comma') duration += p.comma_bonus_ms;
      return Math.min(Math.max(duration, p.min_ms), p.max_ms);
    });
  }

  // Step 4: Robust normalization (per chunk in practice, but here globally)
  const m = median(surprisalBits);
  const madVal = mad(surprisalBits, m);
  const sigma = Math.max(1e-6, 1.4826 * madVal);

  // Compute excess surprise e for each item
  const e = surprisalBits.map(s => {
    const z = (s - (m + p.alpha * sigma)) / (p.beta * sigma);
    return Math.max(0, Math.min(z, p.e_max));
  });

  // Step 5: Neighbor slowdown field with kernel
  const u = new Array(n).fill(0);
  const radius = p.kernel_radius;
  const weights = p.kernel_weights;

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let d = -radius; d <= radius; d++) {
      const j = i + d;
      if (j >= 0 && j < n) {
        sum += e[j] * weights[d + radius];
      }
    }
    u[i] = sum;
  }

  // Step 6: Convert to duration
  const durations = items.map((item, i) => {
    // Slowdown multiplier with tanh saturation
    const mult = 1 + p.gamma * Math.tanh(u[i]);

    // Punctuation bonus
    let punctBonus = 0;
    if (item.endsWith === 'para') punctBonus = p.para_bonus_ms;
    else if (item.endsWith === 'period') punctBonus = p.period_bonus_ms;
    else if (item.endsWith === 'comma') punctBonus = p.comma_bonus_ms;

    const duration = Math.round(baseMs * mult + punctBonus);
    return Math.min(Math.max(duration, p.min_ms), p.max_ms);
  });

  return durations;
}

/**
 * Process text and compute durations using LLM scoring
 * @param {string} text - Input text
 * @param {function} scoreTokensFn - Async function (contextText, chunkText) => Array<{token, logprob, startChar, endChar}>
 * @param {object} params - SAP parameters
 * @param {function} onProgress - Optional progress callback (chunkIndex, totalChunks)
 * @returns {Promise<{items: Array, durations: Array<number>}>}
 */
async function processText(text, scoreTokensFn, params = {}, onProgress = null) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const items = itemize(text);
  const n = items.length;

  if (n === 0) {
    return { items: [], durations: [] };
  }

  // Plan chunks
  const chunks = chunkPlan(items, p);

  // Initialize per-item surprisal accumulator
  const surprisalBits = new Array(n).fill(0);

  // Process each chunk
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];

    if (onProgress) {
      onProgress(ci, chunks.length);
    }

    // Build context text (from overlap items)
    const contextItems = items.slice(chunk.contextStartItem, chunk.startItem);
    const contextText = contextItems.map(it => it.text).join(' ');

    // Build chunk text (items to score)
    const chunkItems = items.slice(chunk.startItem, chunk.endItem);
    const chunkText = chunkItems.map(it => it.text).join(' ');

    if (chunkText.trim().length === 0) continue;

    try {
      // Get token logprobs from LLM
      const lmTokens = await scoreTokensFn(contextText, chunkText);

      if (lmTokens && lmTokens.length > 0) {
        // Align tokens to items
        // For chunk text, startChar is relative to chunk start
        const chunkStartChar = chunkItems[0]?.startChar || 0;
        const tokenToItem = alignTokensToItems(items, lmTokens, chunkStartChar);

        // Accumulate surprisal per item
        const ln2 = Math.log(2);
        for (let ti = 0; ti < lmTokens.length; ti++) {
          const itemIdx = tokenToItem[ti];
          if (itemIdx >= 0 && itemIdx < n) {
            // Convert logprob (natural log) to bits
            const bits = -lmTokens[ti].logprob / ln2;
            surprisalBits[itemIdx] += bits;
          }
        }
      }
    } catch (err) {
      // On error, this chunk gets no surprisal data (fallback to uniform)
      console.error(`Warning: LLM scoring failed for chunk ${ci + 1}: ${err.message}`);
    }
  }

  if (onProgress) {
    onProgress(chunks.length, chunks.length);
  }

  // Compute durations from surprisal
  const durations = computeDurations(items, surprisalBits, p);

  return { items, durations, surprisalBits };
}

/**
 * Get words and durations from processed result
 * @param {{items: Array, durations: Array<number>}} result
 * @returns {{words: Array<string>, durations: Array<number>}}
 */
function getWordsAndDurations(result) {
  return {
    words: result.items.map(it => it.text),
    durations: result.durations
  };
}

module.exports = {
  DEFAULT_PARAMS,
  itemize,
  chunkPlan,
  alignTokensToItems,
  computeDurations,
  processText,
  getWordsAndDurations
};
