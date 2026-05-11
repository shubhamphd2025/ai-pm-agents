/**
 * ASO (App Store Optimization) Analysis module
 * Analyzes keywords, store listing quality, and ranking signals
 */

const { chat, extractJSON } = require('./llmClient');

/**
 * Analyze ASO signals for an app
 */
async function analyzeASO(appData) {
  // appData is { ios: { details, reviews, similar }, android: { details, reviews, similar } }
  const details = appData.ios?.details || appData.android?.details;

  if (!details) return null;

  const prompt = `You are an ASO (App Store Optimization) expert. Analyze the store listing for "${details.title}" and provide optimization insights.

**App Details:**
- Title: ${details.title}
- Developer: ${details.developer}
- Category: ${details.genre || details.primaryGenre}
- Rating: ${details.score}/5 (${details.ratings?.toLocaleString() || 'N/A'} ratings)
- Installs/Downloads: ${details.installs || details.reviews || 'N/A'}
- Description (first 500 chars): ${(details.description || '').substring(0, 500)}

Return a JSON object:
{
  "titleAnalysis": {
    "score": <1-10>,
    "keywords": ["keywords found in title"],
    "suggestions": ["improvement suggestions"]
  },
  "descriptionAnalysis": {
    "score": <1-10>,
    "keywordsFound": ["important keywords in description"],
    "missingKeywords": ["keywords that should be added"],
    "suggestions": ["improvement suggestions"]
  },
  "topKeywords": [
    {
      "keyword": "keyword phrase",
      "relevance": "High | Medium | Low",
      "inTitle": true/false,
      "inDescription": true/false
    }
  ],
  "overallASOScore": <1-10>,
  "quickWins": ["3-5 immediate improvements that would boost visibility"],
  "ratingHealthAnalysis": {
    "assessment": "Excellent | Good | Average | Poor",
    "insight": "What the rating pattern tells us"
  }
}

Return ONLY the JSON object, no other text.`;

  const response = await chat(prompt, 2000);
  const jsonStr = extractJSON(response);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[ASO] Failed to parse LLM response:', response);
    return null;
  }
}

/**
 * Compare ASO across multiple apps
 */
async function compareASO(apps) {
  const appSummaries = apps
    .map((app) => {
      // Handle both { details } and { ios, android } shapes
      const d = app.details || app.ios?.details || app.android?.details;
      if (!d) return null;
      return `- ${d.title}: Rating ${d.score}/5, ${d.ratings?.toLocaleString() || 'N/A'} ratings, Category: ${d.genre || d.primaryGenre}`;
    })
    .filter(Boolean)
    .join('\n');

  const prompt = `You are an ASO expert. Compare the store presence of these apps:

${appSummaries}

Return a JSON object:
{
  "rankings": [
    {
      "appName": "App name",
      "asoStrength": "Strong | Average | Weak",
      "keyAdvantage": "Their main ASO advantage"
    }
  ],
  "industryBenchmarks": {
    "averageRating": <number>,
    "topPerformerRating": <number>,
    "insight": "What good looks like in this category"
  },
  "recommendations": ["3-5 strategic ASO recommendations based on competitive landscape"]
}

Return ONLY the JSON object, no other text.`;

  const response = await chat(prompt, 800);
  const jsonStr = extractJSON(response);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[ASO Compare] Failed to parse LLM response:', jsonStr);
    return null;
  }
}

module.exports = { analyzeASO, compareASO };
