/**
 * Sentiment Analysis module
 * Processes reviews to extract themes, sentiment, and feature requests
 */

const { chat, extractJSON } = require('./llmClient');

/**
 * Prepare a condensed review sample for LLM analysis
 * Balances across rating buckets to get representative coverage
 */
function sampleReviews(reviews, maxReviews = 100) {
  if (!reviews || reviews.length === 0) return [];

  // Group by rating
  const byRating = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const r of reviews) {
    const rating = Math.round(r.score || r.rating || 3);
    if (byRating[rating]) byRating[rating].push(r);
  }

  // Sample proportionally, prioritizing 1-star and 5-star for signal
  const sampled = [];
  const targets = { 1: 25, 2: 10, 3: 10, 4: 15, 5: 40 };

  for (const [rating, target] of Object.entries(targets)) {
    const pool = byRating[rating];
    const picked = pool.slice(0, target);
    sampled.push(...picked);
  }

  return sampled.slice(0, maxReviews);
}

/**
 * Format reviews for LLM prompt
 */
function formatReviewsForPrompt(reviews) {
  return reviews
    .map((r, i) => {
      const rating = r.score || r.rating || '?';
      const title = r.title || '';
      const text = r.text || r.content || '';
      return `[${i + 1}] ★${rating} — ${title}\n${text}`;
    })
    .join('\n\n');
}

/**
 * Run sentiment analysis on a set of reviews using Claude
 */
async function analyzeSentiment(appName, platform, reviews) {
  const sample = sampleReviews(reviews, 100);

  if (sample.length === 0) {
    return {
      loves: ['No review data available'],
      hates: ['No review data available'],
      featureRequests: ['No review data available'],
      bugs: ['No review data available'],
      overallSentiment: 'Unknown',
      sentimentScore: null,
      keyThemes: [],
    };
  }

  const reviewText = formatReviewsForPrompt(sample);

  const prompt = `You are a senior product manager analyzing user reviews for the app "${appName}" on ${platform}.

Below are ${sample.length} user reviews (sampled across all rating levels):

---
${reviewText}
---

Analyze these reviews and return a JSON object with exactly this structure:
{
  "loves": ["list of 5-8 specific things users love most, be concrete not generic"],
  "hates": ["list of 5-8 specific pain points users complain about most"],
  "featureRequests": ["list of 5-8 features users are explicitly asking for"],
  "bugs": ["list of 3-5 recurring bugs or technical issues mentioned"],
  "overallSentiment": "Positive | Mixed | Negative",
  "sentimentScore": <number 1-10 representing overall user happiness>,
  "keyThemes": ["list of 5-6 overarching themes in the feedback"],
  "notableQuotes": ["2-3 verbatim quotes that best capture the user experience"]
}

Be specific and actionable. Avoid vague statements like "users want better performance" — instead say "users report the app crashes when switching between tabs on iOS 17".

Return ONLY the JSON object, no other text.`;

  const response = await chat(prompt, 2000);
  const jsonStr = extractJSON(response);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[Sentiment] Failed to parse LLM response:', jsonStr);
    return {
      loves: ['Analysis parsing failed'],
      hates: ['Analysis parsing failed'],
      featureRequests: [],
      bugs: [],
      overallSentiment: 'Unknown',
      sentimentScore: null,
      keyThemes: [],
      notableQuotes: [],
    };
  }
}

/**
 * Compute rating distribution percentages from histogram
 */
function computeRatingDistribution(histogram) {
  if (!histogram) return null;

  const total = Object.values(histogram).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const dist = {};
  for (const [star, count] of Object.entries(histogram)) {
    dist[star] = {
      count,
      percentage: ((count / total) * 100).toFixed(1),
    };
  }

  return dist;
}

module.exports = { analyzeSentiment, computeRatingDistribution, sampleReviews };
