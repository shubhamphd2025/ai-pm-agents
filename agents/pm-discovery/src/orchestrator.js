/**
 * Orchestrator
 * Coordinates the full discovery pipeline: scraping, analysis, publishing
 */

const { chat, extractJSON } = require('./llmClient');
const { pullAppData: pullPlayStore } = require('./playStoreScraper');
const { pullAppData: pullAppStore } = require('./appStoreScraper');
const { analyzeSentiment, computeRatingDistribution } = require('./sentimentAnalyzer');
const { findCompetitors, mergeCompetitors } = require('./competitorFinder');
const { extractFeatures, compareFeatures } = require('./featureAnalyzer');
const { analyzeASO, compareASO } = require('./asoAnalyzer');
const { publishToConfluence, saveAsMarkdown } = require('./confluencePublisher');

/**
 * Pull data for a single app from both stores in parallel.
 * Succeeds as long as at least one store returns data.
 */
async function pullBothStores(appName) {
  console.log(`[orchestrator] Pulling data for: ${appName}`);

  const [iosResult, androidResult] = await Promise.allSettled([
    pullAppStore(appName),
    pullPlayStore(appName),
  ]);

  const ios = iosResult.status === 'fulfilled' ? iosResult.value : null;
  const android = androidResult.status === 'fulfilled' ? androidResult.value : null;

  if (iosResult.status === 'rejected') {
    console.warn(`[orchestrator] App Store failed for "${appName}": ${iosResult.reason?.message}`);
  }
  if (androidResult.status === 'rejected') {
    console.warn(`[orchestrator] Play Store failed for "${appName}": ${androidResult.reason?.message}`);
  }

  if (!ios && !android) {
    throw new Error(`Could not find "${appName}" on either App Store or Play Store`);
  }

  return { ios, android };
}

/**
 * Run sentiment analysis, feature extraction, and rating distribution for one app.
 */
async function analyzeApp(appName, storeData) {
  const { ios, android } = storeData;

  console.log(`[orchestrator] Analyzing: ${appName}`);

  const allReviews = [
    ...(ios?.reviews || []),
    ...(android?.reviews || []),
  ];

  const platforms = [ios ? 'iOS' : '', android ? 'Android' : ''].filter(Boolean).join(' & ');
  const sentiment = await analyzeSentiment(appName, platforms, allReviews);

  const description = ios?.details?.description || android?.details?.description || '';
  const features = await extractFeatures(appName, description, allReviews);

  const iosRatingDist = ios ? computeRatingDistribution(ios.details.histogram) : null;
  const androidRatingDist = android ? computeRatingDistribution(android.details.histogram) : null;

  return {
    name: appName,
    ios,
    android,
    sentiment,
    features,
    iosRatingDist,
    androidRatingDist,
  };
}

/**
 * Generate a 3-4 sentence executive summary for the discovery document.
 */
async function generateExecutiveSummary(targetApp, competitors, featureGaps) {
  const competitorNames = competitors.map((c) => c.name).join(', ');
  const topGaps = (featureGaps?.gaps || [])
    .filter((g) => g.impact === 'High')
    .map((g) => g.feature)
    .slice(0, 3)
    .join(', ');

  const prompt = `Write a 3-4 sentence executive summary for a product discovery analysis of "${targetApp.name}".

Key facts:
- iOS Rating: ${targetApp.ios?.details?.score || 'N/A'}/5
- Android Rating: ${targetApp.android?.details?.score || 'N/A'}/5
- Overall Sentiment: ${targetApp.sentiment?.overallSentiment || 'N/A'}
- Competitors analyzed: ${competitorNames || 'None'}
- High-impact feature gaps: ${topGaps || 'None identified'}
- Top user complaint: ${targetApp.sentiment?.hates?.[0] || 'N/A'}
- Top user praise: ${targetApp.sentiment?.loves?.[0] || 'N/A'}

Write for a product manager audience. Be direct and insightful. No fluff.`;

  return await chat(prompt, 300);
}

/**
 * Generate 5-7 actionable strategic recommendations grounded in the analysis data.
 */
async function generateRecommendations(targetApp, featureGaps, asoAnalysis) {
  const prompt = `You are a senior product manager. Based on this analysis of "${targetApp.name}", provide 5-7 strategic recommendations.

Sentiment:
- Users love: ${(targetApp.sentiment?.loves || []).slice(0, 3).join('; ')}
- Users hate: ${(targetApp.sentiment?.hates || []).slice(0, 3).join('; ')}
- Top requests: ${(targetApp.sentiment?.featureRequests || []).slice(0, 3).join('; ')}

High-impact feature gaps:
${(featureGaps?.gaps || []).filter((g) => g.impact === 'High').map((g) => `- ${g.feature}: ${g.reasoning}`).join('\n') || 'None'}

ASO quick wins:
${(asoAnalysis?.quickWins || []).slice(0, 3).join('\n') || 'None'}

Return a JSON array of 5-7 recommendation strings. Each should be actionable and specific.
Example: "Add offline mode for core features — 23% of 1-star reviews mention connectivity issues"

Return ONLY the JSON array, no other text.`;

  const response = await chat(prompt, 800);
  const jsonStr = extractJSON(response);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('[orchestrator] Could not parse recommendations, using fallback');
    return ['See detailed analysis sections above for recommendations.'];
  }
}

/**
 * Check whether all required Confluence env vars are present.
 */
function isConfluenceConfigured() {
  return !!(
    process.env.CONFLUENCE_BASE_URL &&
    process.env.CONFLUENCE_EMAIL &&
    process.env.CONFLUENCE_API_TOKEN &&
    process.env.CONFLUENCE_SPACE_KEY &&
    process.env.CONFLUENCE_PARENT_PAGE_ID
  );
}

/**
 * Run the full discovery analysis pipeline.
 *
 * @param {string} targetAppName - The primary app to analyze
 * @param {string[]} competitorNames - Competitor app names (auto-discovered if empty)
 * @param {string} confluenceParentPageId - Confluence page ID to publish under
 */
async function runDiscovery({ targetAppName, competitorNames = [], confluenceParentPageId }) {
  if (!targetAppName || !targetAppName.trim()) {
    throw new Error('targetAppName is required');
  }

  console.log(`[orchestrator] Starting discovery: ${targetAppName}`);
  console.log(`[orchestrator] Competitors: ${competitorNames.length > 0 ? competitorNames.join(', ') : 'auto-discover'}`);

  // Step 1: Pull target app data
  const targetStoreData = await pullBothStores(targetAppName);
  const targetAnalysis = await analyzeApp(targetAppName, targetStoreData);

  // Step 2: Resolve competitor list
  const similarApps = [
    ...(targetStoreData.ios?.similar || []),
    ...(targetStoreData.android?.similar || []),
  ];

  let finalCompetitorNames = competitorNames;

  if (competitorNames.length === 0) {
    console.log('[orchestrator] Auto-discovering competitors...');
    const category = targetStoreData.ios?.details?.primaryGenre || targetStoreData.android?.details?.genre || 'App';
    try {
      const discovered = await findCompetitors(targetAppName, category, similarApps, 3);
      finalCompetitorNames = discovered.map((c) => c.name);
      console.log(`[orchestrator] Discovered: ${finalCompetitorNames.join(', ')}`);
    } catch (err) {
      console.warn(`[orchestrator] Competitor auto-discovery failed: ${err.message}`);
      finalCompetitorNames = similarApps.slice(0, 3).map((a) => a.title || a.name).filter(Boolean);
      console.log(`[orchestrator] Using store suggestions: ${finalCompetitorNames.join(', ') || 'none'}`);
    }
  } else {
    finalCompetitorNames = mergeCompetitors(competitorNames, [], 4);
  }

  // Step 3: Pull and analyze competitor data
  const competitorAnalyses = [];
  for (const compName of finalCompetitorNames) {
    try {
      const compStoreData = await pullBothStores(compName);
      const compAnalysis = await analyzeApp(compName, compStoreData);
      competitorAnalyses.push(compAnalysis);
    } catch (err) {
      console.warn(`[orchestrator] Skipping competitor "${compName}": ${err.message}`);
    }
  }

  // Step 4: Feature gap analysis
  console.log('[orchestrator] Running feature gap analysis...');
  let featureGaps = null;
  if (competitorAnalyses.length > 0) {
    featureGaps = await compareFeatures(
      { name: targetAppName, features: targetAnalysis.features },
      competitorAnalyses.map((c) => ({ name: c.name, features: c.features }))
    );
  }

  // Step 5: ASO analysis
  console.log('[orchestrator] Running ASO analysis...');
  const asoAnalysis = await analyzeASO(targetStoreData);

  let asoComparison = null;
  if (competitorAnalyses.length > 0) {
    const allAppsForASO = [
      targetStoreData,
      ...competitorAnalyses.map((c) => ({ details: c.ios?.details || c.android?.details })),
    ];
    asoComparison = await compareASO(allAppsForASO);
  }

  // Step 6: Executive summary and recommendations
  console.log('[orchestrator] Generating summary and recommendations...');
  const executiveSummary = await generateExecutiveSummary(targetAnalysis, competitorAnalyses, featureGaps);
  const strategicRecommendations = await generateRecommendations(targetAnalysis, featureGaps, asoAnalysis);

  targetAnalysis.executiveSummary = executiveSummary;
  targetAnalysis.strategicRecommendations = strategicRecommendations;

  // Step 7: Publish to Confluence, or fall back to a local Markdown file
  const analysisData = {
    targetApp: targetAnalysis,
    competitors: competitorAnalyses,
    featureGaps,
    asoAnalysis,
    asoComparison,
    generatedAt: new Date().toISOString(),
  };

  if (!isConfluenceConfigured()) {
    console.log('[orchestrator] Confluence not configured — saving output as a local Markdown file...');
    const filePath = saveAsMarkdown(analysisData);
    console.log(`[orchestrator] Done. Output saved to: ${filePath}`);
    return { analysisData, markdownPath: filePath };
  }

  console.log('[orchestrator] Publishing to Confluence...');
  let confluencePage = null;
  try {
    confluencePage = await publishToConfluence(analysisData, confluenceParentPageId);
    console.log(`[orchestrator] Done. Confluence: ${confluencePage._links?.webui || confluencePage.url || 'published'}`);
  } catch (err) {
    console.warn(`[orchestrator] Confluence publish failed (${err.message}) — saving output as a local Markdown file instead...`);
    const filePath = saveAsMarkdown(analysisData);
    console.log(`[orchestrator] Done. Output saved to: ${filePath}`);
    return { analysisData, markdownPath: filePath };
  }

  return { analysisData, confluencePage };
}

module.exports = { runDiscovery };
