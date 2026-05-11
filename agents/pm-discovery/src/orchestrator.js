/**
 * Orchestrator — the brain of the PM Discovery Agent
 * Coordinates all modules: scraping → analysis → publishing
 */

const { chat, extractJSON } = require('./llmClient');
const { pullAppData: pullPlayStore } = require('./playStoreScraper');
const { pullAppData: pullAppStore } = require('./appStoreScraper');
const { analyzeSentiment, computeRatingDistribution } = require('./sentimentAnalyzer');
const { findCompetitors, mergeCompetitors } = require('./competitorFinder');
const { extractFeatures, compareFeatures } = require('./featureAnalyzer');
const { analyzeASO, compareASO } = require('./asoAnalyzer');
const { publishToConfluence } = require('./confluencePublisher');

/**
 * Pull data for a single app from both stores
 * Gracefully handles failures on either platform
 */
async function pullBothStores(appName) {
  console.log(`\n📦 Pulling data for: ${appName}`);

  const [iosResult, androidResult] = await Promise.allSettled([
    pullAppStore(appName),
    pullPlayStore(appName),
  ]);

  const ios = iosResult.status === 'fulfilled' ? iosResult.value : null;
  const android = androidResult.status === 'fulfilled' ? androidResult.value : null;

  if (iosResult.status === 'rejected') {
    console.warn(`  ⚠️  App Store failed for "${appName}": ${iosResult.reason?.message}`);
  }
  if (androidResult.status === 'rejected') {
    console.warn(`  ⚠️  Play Store failed for "${appName}": ${androidResult.reason?.message}`);
  }

  if (!ios && !android) {
    throw new Error(`Could not find "${appName}" on either App Store or Play Store`);
  }

  return { ios, android };
}

/**
 * Run full analysis for a single app
 */
async function analyzeApp(appName, storeData) {
  const { ios, android } = storeData;

  console.log(`  🔬 Analyzing: ${appName}`);

  // Combine reviews from both platforms
  const allReviews = [
    ...(ios?.reviews || []),
    ...(android?.reviews || []),
  ];

  // Run sentiment analysis
  const sentiment = await analyzeSentiment(
    appName,
    [ios ? 'iOS' : '', android ? 'Android' : ''].filter(Boolean).join(' & '),
    allReviews
  );

  // Extract features
  const description = ios?.details?.description || android?.details?.description || '';
  const features = await extractFeatures(appName, description, allReviews);

  // Compute rating distributions
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
 * Generate executive summary using LLM
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
 * Generate strategic recommendations
 */
async function generateRecommendations(targetApp, featureGaps, asoAnalysis) {
  const prompt = `You are a senior product manager. Based on this analysis of "${targetApp.name}", provide 5-7 strategic recommendations.

**Sentiment Insights:**
- Users love: ${(targetApp.sentiment?.loves || []).slice(0, 3).join('; ')}
- Users hate: ${(targetApp.sentiment?.hates || []).slice(0, 3).join('; ')}
- Top requests: ${(targetApp.sentiment?.featureRequests || []).slice(0, 3).join('; ')}

**Feature Gaps (High Impact):**
${(featureGaps?.gaps || []).filter((g) => g.impact === 'High').map((g) => `- ${g.feature}: ${g.reasoning}`).join('\n') || 'None'}

**ASO Quick Wins:**
${(asoAnalysis?.quickWins || []).slice(0, 3).join('\n') || 'None'}

Return a JSON array of 5-7 recommendation strings. Each should be actionable and specific.
Example: "Add offline mode for core features — 23% of 1-star reviews mention connectivity issues"

Return ONLY the JSON array, no other text.`;

  const response = await chat(prompt, 800);
  const jsonStr = extractJSON(response);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return ['See detailed analysis sections above for recommendations.'];
  }
}

/**
 * Main entry point — run the full discovery analysis
 *
 * @param {string} targetAppName - The primary app to analyze
 * @param {string[]} competitorNames - Optional list of competitor app names
 * @param {string} confluenceParentPageId - Confluence page ID to publish under
 */
async function runDiscovery({ targetAppName, competitorNames = [], confluenceParentPageId }) {
  console.log(`\n🚀 Starting PM Discovery Analysis`);
  console.log(`   Target: ${targetAppName}`);
  console.log(`   Competitors provided: ${competitorNames.length > 0 ? competitorNames.join(', ') : 'Auto-discover'}`);
  console.log(`   Confluence Parent: ${confluenceParentPageId}\n`);

  // ── STEP 1: Pull target app data ─────────────────────────────────────────────
  const targetStoreData = await pullBothStores(targetAppName);
  const targetAnalysis = await analyzeApp(targetAppName, targetStoreData);

  // ── STEP 2: Discover competitors if not provided ─────────────────────────────
  const similarApps = [
    ...(targetStoreData.ios?.similar || []),
    ...(targetStoreData.android?.similar || []),
  ];

  let finalCompetitorNames = competitorNames;

  if (competitorNames.length === 0) {
    console.log(`\n🔍 Auto-discovering competitors...`);
    const category = targetStoreData.ios?.details?.primaryGenre || targetStoreData.android?.details?.genre || 'App';
    try {
      const discovered = await findCompetitors(targetAppName, category, similarApps, 3);
      finalCompetitorNames = discovered.map((c) => c.name);
      console.log(`   Found: ${finalCompetitorNames.join(', ')}`);
    } catch (err) {
      console.warn(`  ⚠️  Competitor auto-discovery failed: ${err.message}`);
      // Fall back to store-provided similar apps
      finalCompetitorNames = similarApps.slice(0, 3).map((a) => a.title || a.name).filter(Boolean);
      console.log(`   Using store suggestions: ${finalCompetitorNames.join(', ') || 'none'}`);
    }
  } else {
    finalCompetitorNames = mergeCompetitors(competitorNames, [], 4);
  }

  // ── STEP 3: Pull and analyze competitor data ─────────────────────────────────
  const competitorAnalyses = [];

  for (const compName of finalCompetitorNames) {
    try {
      const compStoreData = await pullBothStores(compName);
      const compAnalysis = await analyzeApp(compName, compStoreData);
      competitorAnalyses.push(compAnalysis);
    } catch (err) {
      console.warn(`  ⚠️  Skipping competitor "${compName}": ${err.message}`);
    }
  }

  // ── STEP 4: Feature gap analysis ─────────────────────────────────────────────
  console.log(`\n🔧 Running feature gap analysis...`);
  let featureGaps = null;

  if (competitorAnalyses.length > 0) {
    featureGaps = await compareFeatures(
      { name: targetAppName, features: targetAnalysis.features },
      competitorAnalyses.map((c) => ({ name: c.name, features: c.features }))
    );
  }

  // ── STEP 5: ASO analysis ─────────────────────────────────────────────────────
  console.log(`\n🔑 Running ASO analysis...`);
  const asoAnalysis = await analyzeASO(targetStoreData);

  let asoComparison = null;
  if (competitorAnalyses.length > 0) {
    const allAppsForASO = [
      targetStoreData,
      ...competitorAnalyses.map((c) => ({ details: c.ios?.details || c.android?.details })),
    ];
    asoComparison = await compareASO(allAppsForASO);
  }

  // ── STEP 6: Generate executive summary & recommendations ─────────────────────
  console.log(`\n✍️  Generating executive summary and recommendations...`);
  const executiveSummary = await generateExecutiveSummary(targetAnalysis, competitorAnalyses, featureGaps);
  const strategicRecommendations = await generateRecommendations(targetAnalysis, featureGaps, asoAnalysis);

  targetAnalysis.executiveSummary = executiveSummary;
  targetAnalysis.strategicRecommendations = strategicRecommendations;

  // ── STEP 7: Assemble final analysis object ───────────────────────────────────
  const analysisData = {
    targetApp: targetAnalysis,
    competitors: competitorAnalyses,
    featureGaps,
    asoAnalysis,
    asoComparison,
    generatedAt: new Date().toISOString(),
  };

  // ── STEP 8: Publish to Confluence ────────────────────────────────────────────
  console.log(`\n📄 Publishing to Confluence...`);
  const page = await publishToConfluence(analysisData, confluenceParentPageId);

  console.log(`\n✅ Analysis complete!`);
  console.log(`   📄 Confluence page: ${page.url || page._links?.webui || 'Published'}`);

  return { analysisData, confluencePage: page };
}

module.exports = { runDiscovery };
