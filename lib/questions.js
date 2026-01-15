const { callLLM } = require('./llm.js');

const QUESTION_PROMPT = `You are a reading comprehension assistant. Given the following text, generate exactly {count} multiple-choice questions to test the reader's comprehension.

For each question:
- Create a clear question about the content
- Provide 2-4 answer choices (labeled A, B, C, D)
- Indicate the correct answer
- Write the question and choices in the SAME LANGUAGE as the text
- IMPORTANT: Generate questions in SEQUENTIAL ORDER following the text flow. Question 1 should be about content near the beginning, question 2 about content that comes after, and so on. Each question should only reference content that appears BEFORE it in the text.

IMPORTANT: Output ONLY valid JSON in this exact format, no other text:
{
  "questions": [
    {
      "question": "What is the main topic?",
      "choices": ["Choice A", "Choice B", "Choice C"],
      "correct": 0
    }
  ]
}

The "correct" field is the 0-based index of the correct answer in the choices array.

TEXT:
{text}`;

async function generateQuestions(text, options = {}) {
  const count = options.questionCount || 10;
  const prompt = QUESTION_PROMPT
    .replace('{count}', count)
    .replace('{text}', text);

  const response = await callLLM(prompt, {
    provider: options.provider,
    model: options.model,
  });

  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    const data = JSON.parse(jsonStr.trim());
    if (!data.questions || !Array.isArray(data.questions)) {
      throw new Error('Invalid response format: missing questions array');
    }

    // Validate each question
    for (const q of data.questions) {
      if (!q.question || !q.choices || typeof q.correct !== 'number') {
        throw new Error('Invalid question format');
      }
      if (q.correct < 0 || q.correct >= q.choices.length) {
        throw new Error('Invalid correct answer index');
      }
    }

    return data.questions;
  } catch (err) {
    throw new Error(`Failed to parse LLM response: ${err.message}`);
  }
}

function findSentenceEndPositions(words) {
  const positions = [];
  const sentenceEnders = ['.', '!', '?'];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (sentenceEnders.some(end => word.endsWith(end))) {
      positions.push(i);
    }
  }

  return positions;
}

function distributeQuestions(words, questions, options = {}) {
  const sentenceEnds = findSentenceEndPositions(words);

  if (sentenceEnds.length === 0) {
    // No sentence endings found, put all questions at the end
    return [{ wordIndex: words.length - 1, questions }];
  }

  const questionPositions = [];
  const totalQuestions = questions.length;

  if (options.frequency) {
    // Distribute based on word frequency
    let nextQuestionAt = options.frequency;
    let questionIndex = 0;

    for (const sentenceEnd of sentenceEnds) {
      if (sentenceEnd >= nextQuestionAt && questionIndex < totalQuestions) {
        questionPositions.push({
          wordIndex: sentenceEnd,
          question: questions[questionIndex],
        });
        questionIndex++;
        nextQuestionAt = sentenceEnd + options.frequency;
      }
    }

    // Add remaining questions distributed among remaining sentence ends
    while (questionIndex < totalQuestions) {
      const remainingSentenceEnds = sentenceEnds.filter(
        pos => !questionPositions.some(qp => qp.wordIndex === pos)
      );
      if (remainingSentenceEnds.length === 0) break;

      const randomIndex = Math.floor(Math.random() * remainingSentenceEnds.length);
      questionPositions.push({
        wordIndex: remainingSentenceEnds[randomIndex],
        question: questions[questionIndex],
      });
      questionIndex++;
    }
  } else {
    // Distribute evenly across the text, maintaining question order
    const interval = Math.floor(sentenceEnds.length / (totalQuestions + 1));

    for (let i = 0; i < totalQuestions; i++) {
      // Place each question at evenly spaced intervals, in order
      const sentenceIndex = Math.min((i + 1) * interval, sentenceEnds.length - 1);

      questionPositions.push({
        wordIndex: sentenceEnds[sentenceIndex],
        question: questions[i],
      });
    }
  }

  // Sort by word index
  questionPositions.sort((a, b) => a.wordIndex - b.wordIndex);

  return questionPositions;
}

module.exports = { generateQuestions, distributeQuestions, findSentenceEndPositions };
