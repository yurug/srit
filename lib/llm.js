const PROVIDERS = {
  openai: {
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
  },
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-haiku-4-5',
    endpoint: 'https://api.anthropic.com/v1/messages',
  },
  gemini: {
    envKey: 'GEMINI_API_KEY',
    defaultModel: 'gemini-3-flash-preview',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
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
      temperature: 0.7,
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

module.exports = { callLLM, detectProvider, PROVIDERS };
