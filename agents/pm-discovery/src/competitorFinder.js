/**
 * Competitor Discovery module
 * Automatically identifies top competitors for an app
 * Uses both store "similar apps" data and LLM reasoning
 */

const { chat, extractJSON } = require('./llmClient');

/**
 * Use LLM to identify top competitors for an app
 * Falls back to store-provided similar apps
 */
async function findCompetitors(appName, category, similarApps = [], maxCompetitors = 4) {
  const similarNames = similarApps
    .slice(0, 10)
    .map((a) => a.title || a.name)
    .filter(Boolean);

  const prompt = `You are a product strategist. I need to identify the top ${maxCompetitors} direct competitors for the app "${appName}" in the "${category}" category.

${similarNames.length > 0 ? `The app store suggests these similar apps: ${similarNames.join(', ')}` : ''}

Return a JSON array of the top ${maxCompetitors} competitors. Each item should have:
{
  "name": "App Name",
  "reason": "One sentence on why this is a direct competitor",
  "differentiator": "Their main differentiating feature vs ${appName}"
}

Focus on apps that:
- Serve the same core user need
- Target the same audience
- Are available on both iOS and Android
- Are well-known (not obscure apps)

Return ONLY the JSON array, no other text.`;

  const response = await chat(prompt, 800);
  const jsonStr = extractJSON(response);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('[Competitors] Failed to parse LLM response:', raw);
    // Fall back to similar apps from store
    return similarNames.slice(0, maxCompetitors).map((name) => ({
      name,
      reason: 'Identified as similar by app store',
      differentiator: 'Unknown',
    }));
  }
}

/**
 * Merge user-provided competitors with auto-discovered ones
 * User-provided always take priority
 */
function mergeCompetitors(userProvided = [], autoDiscovered = [], maxTotal = 4) {
  const merged = [...userProvided];
  const userNames = new Set(userProvided.map((c) => c.toLowerCase()));

  for (const auto of autoDiscovered) {
    const name = (auto.name || auto).toLowerCase();
    if (!userNames.has(name) && merged.length < maxTotal) {
      merged.push(auto.name || auto);
    }
  }

  return merged.slice(0, maxTotal);
}

module.exports = { findCompetitors, mergeCompetitors };
