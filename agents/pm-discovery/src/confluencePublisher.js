/**
 * Confluence Publisher module
 * Formats analysis data and publishes structured discovery documents
 */

const axios = require('axios');
require('dotenv').config();

const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL;
const CONFLUENCE_EMAIL = process.env.CONFLUENCE_EMAIL;
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN;
const CONFLUENCE_SPACE_KEY = process.env.CONFLUENCE_SPACE_KEY;
const CONFLUENCE_PARENT_PAGE_ID = process.env.CONFLUENCE_PARENT_PAGE_ID; // "Assistant PM — Discovery" page ID

/**
 * Create Confluence API client
 */
function getConfluenceClient() {
  return axios.create({
    baseURL: `${CONFLUENCE_BASE_URL}/wiki/rest/api`,
    auth: {
      username: CONFLUENCE_EMAIL,
      password: CONFLUENCE_API_TOKEN,
    },
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

/**
 * Format a star rating as emoji stars
 */
function formatStars(score) {
  if (!score) return 'N/A';
  const full = Math.round(score);
  return '★'.repeat(full) + '☆'.repeat(5 - full) + ` (${score.toFixed(1)})`;
}

/**
 * Format number with commas
 */
function formatNumber(n) {
  if (!n) return 'N/A';
  return Number(n).toLocaleString();
}

/**
 * Build the full Confluence page content in storage format (XHTML)
 */
function buildPageContent(analysisData) {
  const { targetApp, competitors, featureGaps, asoAnalysis, asoComparison, generatedAt } = analysisData;

  const allApps = [targetApp, ...competitors];

  // ── HEADER ──────────────────────────────────────────────────────────────────
  let content = `
<h1>App Discovery: ${targetApp.name}</h1>
<p><em>Generated ${new Date(generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} by Assistant PM — Discovery</em></p>
<hr/>

<h2>Executive Summary</h2>
<p>${targetApp.executiveSummary || 'Analysis complete. See sections below for detailed findings.'}</p>

<hr/>

<h2>App Overview</h2>
`;

  // ── APP METADATA TABLE ───────────────────────────────────────────────────────
  content += `
<table>
  <thead>
    <tr>
      <th>Field</th>
      ${allApps.map((a) => `<th>${a.name}</th>`).join('')}
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Platform</strong></td>
      ${allApps.map((a) => `<td>${[a.ios ? 'iOS' : '', a.android ? 'Android' : ''].filter(Boolean).join(' + ') || 'Both'}</td>`).join('')}
    </tr>
    <tr>
      <td><strong>Developer</strong></td>
      ${allApps.map((a) => `<td>${a.ios?.details?.developer || a.android?.details?.developer || 'N/A'}</td>`).join('')}
    </tr>
    <tr>
      <td><strong>Category</strong></td>
      ${allApps.map((a) => `<td>${a.ios?.details?.primaryGenre || a.android?.details?.genre || 'N/A'}</td>`).join('')}
    </tr>
    <tr>
      <td><strong>iOS Rating</strong></td>
      ${allApps.map((a) => `<td>${a.ios ? formatStars(a.ios.details.score) : 'N/A'}</td>`).join('')}
    </tr>
    <tr>
      <td><strong>Android Rating</strong></td>
      ${allApps.map((a) => `<td>${a.android ? formatStars(a.android.details.score) : 'N/A'}</td>`).join('')}
    </tr>
    <tr>
      <td><strong>iOS Reviews</strong></td>
      ${allApps.map((a) => `<td>${a.ios ? formatNumber(a.ios.details.ratings) : 'N/A'}</td>`).join('')}
    </tr>
    <tr>
      <td><strong>Android Installs</strong></td>
      ${allApps.map((a) => `<td>${a.android ? (a.android.details.installs || 'N/A') : 'N/A'}</td>`).join('')}
    </tr>
    <tr>
      <td><strong>Price</strong></td>
      ${allApps.map((a) => `<td>${(a.ios?.details?.free || a.android?.details?.free) ? 'Free' : `$${a.ios?.details?.price || a.android?.details?.price || '?'}`}</td>`).join('')}
    </tr>
    <tr>
      <td><strong>Last Updated</strong></td>
      ${allApps.map((a) => `<td>${a.ios?.details?.updated || a.android?.details?.updated || 'N/A'}</td>`).join('')}
    </tr>
  </tbody>
</table>

<hr/>
`;

  // ── SENTIMENT ANALYSIS ───────────────────────────────────────────────────────
  content += `<h2>User Sentiment</h2>`;

  for (const app of allApps) {
    const sentiment = app.sentiment;
    if (!sentiment) continue;

    content += `
<h3>${app.name}</h3>
<p><strong>Sentiment:</strong> ${sentiment.overallSentiment || 'N/A'} &nbsp;|&nbsp; <strong>Score:</strong> ${sentiment.sentimentScore || 'N/A'}/10</p>

<table>
  <thead>
    <tr>
      <th>What Users Love</th>
      <th>What Users Hate</th>
      <th>Feature Requests</th>
      <th>Reported Bugs</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><ul>${(sentiment.loves || []).map((l) => `<li>${l}</li>`).join('')}</ul></td>
      <td><ul>${(sentiment.hates || []).map((h) => `<li>${h}</li>`).join('')}</ul></td>
      <td><ul>${(sentiment.featureRequests || []).map((f) => `<li>${f}</li>`).join('')}</ul></td>
      <td><ul>${(sentiment.bugs || []).map((b) => `<li>${b}</li>`).join('')}</ul></td>
    </tr>
  </tbody>
</table>
`;

    if (sentiment.notableQuotes && sentiment.notableQuotes.length > 0) {
      content += `<p><strong>Notable User Quotes:</strong></p><blockquote>`;
      content += sentiment.notableQuotes.map((q) => `<p>"${q}"</p>`).join('');
      content += `</blockquote>`;
    }
  }

  content += `<hr/>`;

  // ── RATING DISTRIBUTION ──────────────────────────────────────────────────────
  content += `<h2>Rating Distribution</h2>`;

  for (const app of allApps) {
    const iosHist = app.ios?.ratingDistribution;
    const androidHist = app.android?.ratingDistribution;

    if (!iosHist && !androidHist) continue;

    content += `<h3>${app.name}</h3><table><thead><tr><th>Stars</th>`;
    if (iosHist) content += `<th>iOS Count</th><th>iOS %</th>`;
    if (androidHist) content += `<th>Android Count</th><th>Android %</th>`;
    content += `</tr></thead><tbody>`;

    for (let star = 5; star >= 1; star--) {
      content += `<tr><td>${'★'.repeat(star)}</td>`;
      if (iosHist) {
        const d = iosHist[star] || { count: 0, percentage: '0.0' };
        content += `<td>${formatNumber(d.count)}</td><td>${d.percentage}%</td>`;
      }
      if (androidHist) {
        const d = androidHist[star] || { count: 0, percentage: '0.0' };
        content += `<td>${formatNumber(d.count)}</td><td>${d.percentage}%</td>`;
      }
      content += `</tr>`;
    }

    content += `</tbody></table>`;
  }

  content += `<hr/>`;

  // ── FEATURE COMPARISON ───────────────────────────────────────────────────────
  content += `<h2>Feature Comparison</h2>`;

  if (allApps[0]?.features && allApps[0].features.length > 0) {
    // Build feature matrix
    const allFeatureNames = new Set();
    for (const app of allApps) {
      (app.features || []).forEach((f) => allFeatureNames.add(f.feature));
    }

    content += `<table><thead><tr><th>Feature</th>`;
    content += allApps.map((a) => `<th>${a.name}</th>`).join('');
    content += `</tr></thead><tbody>`;

    for (const featureName of allFeatureNames) {
      content += `<tr><td><strong>${featureName}</strong></td>`;
      for (const app of allApps) {
        const hasFeature = (app.features || []).some((f) => f.feature === featureName);
        content += `<td style="text-align:center">${hasFeature ? '✅' : '❌'}</td>`;
      }
      content += `</tr>`;
    }

    content += `</tbody></table>`;
  }

  // ── FEATURE GAPS ────────────────────────────────────────────────────────────
  if (featureGaps) {
    content += `<h3>Feature Gaps (missing from ${targetApp.name})</h3>`;

    if (featureGaps.gaps && featureGaps.gaps.length > 0) {
      content += `<table><thead><tr><th>Missing Feature</th><th>Present In</th><th>Impact</th><th>Why It Matters</th></tr></thead><tbody>`;
      for (const gap of featureGaps.gaps) {
        const impactColor = gap.impact === 'High' ? 'red' : gap.impact === 'Medium' ? 'orange' : 'gray';
        content += `<tr>
          <td><strong>${gap.feature}</strong></td>
          <td>${(gap.presentIn || []).join(', ')}</td>
          <td><span style="color:${impactColor}"><strong>${gap.impact}</strong></span></td>
          <td>${gap.reasoning}</td>
        </tr>`;
      }
      content += `</tbody></table>`;
    }

    if (featureGaps.uniqueToTarget && featureGaps.uniqueToTarget.length > 0) {
      content += `<h3>Unique Advantages of ${targetApp.name}</h3><ul>`;
      for (const u of featureGaps.uniqueToTarget) {
        content += `<li><strong>${u.feature}</strong>: ${u.advantage}</li>`;
      }
      content += `</ul>`;
    }
  }

  content += `<hr/>`;

  // ── ASO ANALYSIS ────────────────────────────────────────────────────────────
  content += `<h2>ASO & Keyword Analysis</h2>`;

  if (asoAnalysis) {
    content += `
<p><strong>Overall ASO Score:</strong> ${asoAnalysis.overallASOScore || 'N/A'}/10</p>

<h3>Top Keywords</h3>
<table>
  <thead>
    <tr><th>Keyword</th><th>Relevance</th><th>In Title</th><th>In Description</th></tr>
  </thead>
  <tbody>
    ${(asoAnalysis.topKeywords || [])
      .map(
        (k) => `<tr>
      <td>${k.keyword}</td>
      <td>${k.relevance}</td>
      <td>${k.inTitle ? '✅' : '❌'}</td>
      <td>${k.inDescription ? '✅' : '❌'}</td>
    </tr>`
      )
      .join('')}
  </tbody>
</table>

<h3>Quick Wins</h3>
<ul>
  ${(asoAnalysis.quickWins || []).map((w) => `<li>${w}</li>`).join('')}
</ul>
`;
  }

  if (asoComparison) {
    content += `<h3>Competitive ASO Comparison</h3>
<table>
  <thead>
    <tr><th>App</th><th>ASO Strength</th><th>Key Advantage</th></tr>
  </thead>
  <tbody>
    ${(asoComparison.rankings || [])
      .map(
        (r) => `<tr>
      <td>${r.appName}</td>
      <td>${r.asoStrength}</td>
      <td>${r.keyAdvantage}</td>
    </tr>`
      )
      .join('')}
  </tbody>
</table>

<h3>Strategic ASO Recommendations</h3>
<ul>
  ${(asoComparison.recommendations || []).map((r) => `<li>${r}</li>`).join('')}
</ul>`;
  }

  content += `<hr/>`;

  // ── STRATEGIC RECOMMENDATIONS ────────────────────────────────────────────────
  if (targetApp.strategicRecommendations) {
    content += `
<h2>Strategic Recommendations</h2>
<ul>
  ${targetApp.strategicRecommendations.map((r) => `<li>${r}</li>`).join('')}
</ul>
<hr/>
`;
  }

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  content += `
<p><em>Data sourced from Google Play Store and Apple App Store. Generated: ${new Date(generatedAt).toISOString()}</em></p>
`;

  return content;
}

/**
 * Publish the analysis document to Confluence
 */
async function publishToConfluence(analysisData, parentPageId) {
  const client = getConfluenceClient();
  const pageTitle = `Discovery: ${analysisData.targetApp.name} — ${new Date(analysisData.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const content = buildPageContent(analysisData);

  const payload = {
    type: 'page',
    title: pageTitle,
    ancestors: [{ id: parentPageId || CONFLUENCE_PARENT_PAGE_ID }],
    space: { key: CONFLUENCE_SPACE_KEY },
    body: {
      storage: {
        value: content,
        representation: 'storage',
      },
    },
  };

  const response = await client.post('/content', payload);
  return response.data;
}

module.exports = { publishToConfluence, buildPageContent };
