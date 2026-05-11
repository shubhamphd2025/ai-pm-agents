/**
 * Feature Gap Analysis module
 * Compares features across multiple apps to identify gaps and opportunities
 */

const { chat, extractJSON } = require('./llmClient');

/**
 * Extract key features from app descriptions and reviews
 */
async function extractFeatures(appName, description, reviews) {
  const reviewSample = reviews
    .slice(0, 50)
    .map((r) => r.text || r.content || '')
    .join('\n');

  const prompt = `You are a product analyst. Extract the key features of the app "${appName}" based on its description and user reviews.

**App Description:**
${description}

**Sample User Reviews:**
${reviewSample}

Return a JSON array of 8-12 key features. Each feature should be:
{
  "feature": "Feature name (concise)",
  "description": "One sentence describing what it does",
  "userMentioned": true/false (whether users explicitly mention it in reviews)
}

Focus on concrete features, not marketing fluff. Examples:
- "Offline mode" not "Seamless experience"
- "Dark mode" not "Beautiful design"
- "Collaborative editing" not "Work together"

Return ONLY the JSON array, no other text.`;

  const response = await chat(prompt, 2000);
  const jsonStr = extractJSON(response);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // LLM may have truncated mid-JSON — try to salvage a partial array
    try {
      const partial = jsonStr.substring(0, jsonStr.lastIndexOf('}') + 1) + ']';
      return JSON.parse(partial);
    } catch (_) {
      console.error('[Features] Failed to parse LLM response, returning empty list');
      return [];
    }
  }
}

/**
 * Compare features across multiple apps to identify gaps
 */
async function compareFeatures(targetApp, competitorApps) {
  const allFeatures = [targetApp, ...competitorApps];

  const featureList = allFeatures
    .map((app) => {
      const features = app.features.map((f) => f.feature).join(', ');
      return `**${app.name}**: ${features}`;
    })
    .join('\n\n');

  const prompt = `You are a product strategist analyzing feature gaps.

Below are the key features of ${targetApp.name} and its competitors:

${featureList}

Analyze this and return a JSON object:
{
  "gaps": [
    {
      "feature": "Feature name",
      "presentIn": ["Competitor A", "Competitor B"],
      "missingFrom": ["${targetApp.name}"],
      "impact": "High | Medium | Low",
      "reasoning": "Why this gap matters"
    }
  ],
  "uniqueToTarget": [
    {
      "feature": "Feature name",
      "advantage": "Why this is a competitive advantage"
    }
  ],
  "parity": ["List of features where all apps are roughly equal"]
}

Focus on meaningful gaps, not trivial differences.

Return ONLY the JSON object, no other text.`;

  const response = await chat(prompt, 2000);
  const jsonStr = extractJSON(response);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[Feature Comparison] Failed to parse LLM response:', jsonStr);
    return { gaps: [], uniqueToTarget: [], parity: [] };
  }
}

module.exports = { extractFeatures, compareFeatures };
