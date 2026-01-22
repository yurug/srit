// Pricing per 1M tokens (USD) - updated Jan 2026
const PRICING = {
  'gpt-5-mini': { input: 0.10, output: 0.40 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
};

const PROVIDERS = {
  openai: {
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    supportsLogprobs: true,
    // GPT-5 models don't support logprobs (reasoning models), use gpt-4o-mini for scoring
    scoringModel: 'gpt-4o-mini',
    scoringEndpoint: 'https://api.openai.com/v1/chat/completions',
  },
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-haiku-4-5',
    endpoint: 'https://api.anthropic.com/v1/messages',
    supportsLogprobs: false,
  },
  gemini: {
    envKey: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    supportsLogprobs: true,
    // Use stable model for logprobs scoring
    scoringModel: 'gemini-2.0-flash',
  },
};

function detectProvider() {
  for (const [name, config] of Object.entries(PROVIDERS)) {
    if (process.env[config.envKey]) {
      return { provider: name, apiKey: process.env[config.envKey] };
    }
  }
  return null;
}

function getProviderConfig(providerName) {
  const config = PROVIDERS[providerName];
  if (!config) {
    throw new Error(`Unknown provider: ${providerName}. Supported: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    throw new Error(`API key not found. Set ${config.envKey} environment variable.`);
  }
  return { ...config, apiKey };
}

async function callLLM(prompt, options = {}) {
  const providerName = options.provider || detectProvider()?.provider;
  if (!providerName) {
    throw new Error('No API key found. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY.');
  }

  const config = getProviderConfig(providerName);
  const model = options.model || config.defaultModel;

  switch (providerName) {
    case 'openai':
      return callOpenAI(config, model, prompt);
    case 'anthropic':
      return callAnthropic(config, model, prompt);
    case 'gemini':
      return callGemini(config, model, prompt);
    default:
      throw new Error(`Provider ${providerName} not implemented`);
  }
}

async function callOpenAI(config, model, prompt) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callAnthropic(config, model, prompt) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callGemini(config, model, prompt) {
  const url = `${config.endpoint}/${model}:generateContent?key=${config.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

/**
 * Score tokens with logprobs for SAP (Semantic Adaptive Pacing)
 * @param {string} contextText - Context before the chunk
 * @param {string} chunkText - Text to score
 * @param {object} options - Provider options
 * @returns {Promise<Array<{token: string, logprob: number, startChar: number, endChar: number}>>}
 */
async function scoreTokens(contextText, chunkText, options = {}) {
  const providerName = options.provider || detectProvider()?.provider;
  if (!providerName) {
    throw new Error('No API key found. Set OPENAI_API_KEY or GEMINI_API_KEY.');
  }

  const config = getProviderConfig(providerName);

  if (!config.supportsLogprobs) {
    throw new Error(`Provider ${providerName} does not support token logprobs. Use OpenAI or Gemini for --auto mode.`);
  }

  switch (providerName) {
    case 'openai':
      return scoreTokensOpenAI(config, contextText, chunkText);
    case 'gemini':
      return scoreTokensGemini(config, contextText, chunkText);
    default:
      throw new Error(`Token scoring not implemented for ${providerName}`);
  }
}

/**
 * Score tokens using OpenAI API with logprobs
 */
async function scoreTokensOpenAI(config, contextText, chunkText) {
  const model = config.scoringModel;

  // Use chat completions with logprobs
  // We prompt the model to continue the text and get logprobs on its output
  const systemPrompt = `You are a text continuation assistant. Your task is to continue the given text exactly as provided. Do not add any commentary or modifications. Simply output the exact continuation text.`;

  const userPrompt = contextText
    ? `Continue this text exactly:\n\n${contextText}\n\nThe exact continuation is:\n${chunkText}`
    : `Output this text exactly:\n${chunkText}`;

  const response = await fetch(config.scoringEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: Math.ceil(chunkText.length * 2), // Enough tokens for the chunk
      logprobs: true,
      top_logprobs: 1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.logprobs?.content || [];

  // Map tokens to our format with character positions
  const result = [];
  let charPos = 0;

  for (const tokenData of content) {
    const token = tokenData.token;
    const logprob = tokenData.logprob;

    result.push({
      token,
      logprob,
      startChar: charPos,
      endChar: charPos + token.length,
    });

    charPos += token.length;
  }

  return result;
}

/**
 * Score tokens using Gemini API with logprobs
 * See: https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/content-generation-parameters
 */
async function scoreTokensGemini(config, contextText, chunkText) {
  const model = config.scoringModel;
  const url = `${config.endpoint}/${model}:generateContent?key=${config.apiKey}`;

  const prompt = contextText
    ? `Continue this text exactly without any changes:\n\n${contextText}\n\nThe continuation is:\n${chunkText}`
    : `Output this text exactly:\n${chunkText}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: Math.ceil(chunkText.length * 2),
        responseLogprobs: true,
        logprobs: 1, // Number of top alternative tokens to return
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract logprobs from Gemini response
  const logprobsResult = data.candidates?.[0]?.logprobsResult;
  if (!logprobsResult?.chosenCandidates) {
    // Fallback: return empty array if no logprobs available
    return [];
  }

  const result = [];
  let charPos = 0;

  for (const candidate of logprobsResult.chosenCandidates) {
    const token = candidate.token || '';
    const logprob = candidate.logProbability || 0;

    result.push({
      token,
      logprob,
      startChar: charPos,
      endChar: charPos + token.length,
    });

    charPos += token.length;
  }

  return result;
}

/**
 * Check if a provider supports logprobs for SAP
 */
function supportsLogprobs(providerName) {
  const config = PROVIDERS[providerName];
  return config?.supportsLogprobs || false;
}

/**
 * Estimate cost for SAP processing
 * @param {string} text - The text to process
 * @param {object} options - Provider options
 * @param {object} sapParams - SAP parameters (chunk_size_words, chunk_overlap_context_words)
 * @returns {{inputTokens: number, outputTokens: number, cost: number, model: string}}
 */
function estimateSapCost(text, options = {}, sapParams = {}) {
  const providerName = options.provider || detectProvider()?.provider;
  if (!providerName) {
    return { inputTokens: 0, outputTokens: 0, cost: 0, model: 'unknown' };
  }

  const config = PROVIDERS[providerName];
  const model = config.scoringModel || config.defaultModel;
  const pricing = PRICING[model] || { input: 0.15, output: 0.60 }; // Default to gpt-4o-mini pricing

  // Estimate based on chunking strategy
  const chunkSizeWords = sapParams.chunk_size_words || 16;
  const overlapWords = sapParams.chunk_overlap_context_words || 12;

  // Rough word count
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Number of chunks
  const numChunks = Math.ceil(wordCount / chunkSizeWords);

  // Per chunk: system prompt (~50 tokens) + context (~overlap words * 1.5 tokens) + chunk (~chunkSize * 1.5 tokens)
  const systemPromptTokens = 50;
  const avgContextTokens = overlapWords * 1.5;
  const avgChunkTokens = chunkSizeWords * 1.5;
  const inputTokensPerChunk = systemPromptTokens + avgContextTokens + avgChunkTokens;

  // Output: model generates ~chunk text length in tokens
  const outputTokensPerChunk = avgChunkTokens;

  const totalInputTokens = Math.ceil(numChunks * inputTokensPerChunk);
  const totalOutputTokens = Math.ceil(numChunks * outputTokensPerChunk);

  // Cost in USD
  const inputCost = (totalInputTokens / 1_000_000) * pricing.input;
  const outputCost = (totalOutputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cost: totalCost,
    model,
  };
}

module.exports = { callLLM, detectProvider, PROVIDERS, scoreTokens, supportsLogprobs, estimateSapCost };
