const fs = require('fs');
const path = require('path');

const SUPPORTED_FORMATS = ['txt', 'md', 'pdf', 'doc', 'docx'];

async function extractText(source) {
  // Handle stdin
  if (source === '-') {
    return readStdin();
  }

  // Handle URL
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return extractFromUrl(source);
  }

  // Handle file
  if (!fs.existsSync(source)) {
    throw new Error(`File not found: ${source}`);
  }

  const ext = path.extname(source).toLowerCase().slice(1);

  if (!SUPPORTED_FORMATS.includes(ext)) {
    throw new Error(
      `Unsupported format: .${ext}\nSupported formats: ${SUPPORTED_FORMATS.join(', ')}`
    );
  }

  switch (ext) {
    case 'txt':
      return fs.readFileSync(source, 'utf-8');

    case 'md':
      return stripMarkdown(fs.readFileSync(source, 'utf-8'));

    case 'pdf':
      return extractFromPdf(source);

    case 'doc':
    case 'docx':
      return extractFromDoc(source);

    default:
      throw new Error(`Unsupported format: .${ext}`);
  }
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data);
    });

    process.stdin.on('error', (err) => {
      reject(new Error(`Failed to read from stdin: ${err.message}`));
    });
  });
}

async function extractFromUrl(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();

    // If HTML, try to extract text content
    if (contentType.includes('text/html')) {
      return extractTextFromHtml(text);
    }

    return text;
  } catch (err) {
    throw new Error(`Failed to fetch URL: ${err.message}`);
  }
}

function extractTextFromHtml(html) {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

async function extractFromPdf(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (err) {
    throw new Error(`Failed to extract text from PDF: ${err.message}`);
  }
}

async function extractFromDoc(filePath) {
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (err) {
    throw new Error(`Failed to extract text from DOC/DOCX: ${err.message}`);
  }
}

function stripMarkdown(text) {
  const { marked } = require('marked');
  const html = marked(text);
  return extractTextFromHtml(html);
}

module.exports = { extractText, SUPPORTED_FORMATS };
