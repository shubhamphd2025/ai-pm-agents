# Assistant PM — Discovery: Setup and Usage Guide

## Contents

1. [What It Does](#1-what-it-does)
2. [Setup](#2-setup)
3. [Running the Agent](#3-running-the-agent)
4. [Understanding the Output](#4-understanding-the-output)
5. [Tips](#5-tips)
6. [Troubleshooting](#6-troubleshooting)
7. [Cost Reference](#7-cost-reference)

---

## 1. What It Does

Given an app name, the agent:

1. Searches the App Store and Google Play Store for the app and its competitors
2. Pulls metadata, reviews, ratings, and install data for each
3. Runs AI analysis: sentiment, feature gaps, ASO keywords
4. Publishes a structured discovery document to Confluence

Runtime: 5–10 minutes. Cost: ~$0.006 per full run.

Output location in Confluence:
```
Agents > Assistant PM — Discovery > Discovery: [App Name] — [Date]
```

---

## 2. Setup

### Install dependencies

```bash
cd agents/pm-discovery
npm install
```

### Configure credentials

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai/) — Keys → Create Key |
| `CONFLUENCE_BASE_URL` | Your Atlassian domain, e.g. `https://company.atlassian.net` |
| `CONFLUENCE_EMAIL` | Your Atlassian account email |
| `CONFLUENCE_API_TOKEN` | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `CONFLUENCE_SPACE_KEY` | Confluence → Space Settings → Space Details |
| `CONFLUENCE_PARENT_PAGE_ID` | The number in the URL of your "Assistant PM — Discovery" page |

### Validate the setup

```bash
node --input-type=commonjs << 'EOF'
require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
async function check() {
  const llm = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
  const r = await llm.chat.completions.create({ model: process.env.OPENROUTER_MODEL, max_tokens: 10, messages: [{ role: 'user', content: 'Say OK' }] });
  console.log('OpenRouter:', r.choices[0].message.content.trim());
  const c = await axios.get(process.env.CONFLUENCE_BASE_URL + '/wiki/rest/api/content/' + process.env.CONFLUENCE_PARENT_PAGE_ID, { auth: { username: process.env.CONFLUENCE_EMAIL, password: process.env.CONFLUENCE_API_TOKEN } });
  console.log('Confluence:', c.data.title);
}
check().catch(e => console.error('Error:', e.message));
EOF
```

---

## 3. Running the Agent

All commands run from `agents/pm-discovery/`.

```bash
# Auto-discover competitors
node index.js --app "Spotify"

# Specify competitors
node index.js --app "Spotify" --competitors "Apple Music,YouTube Music,Tidal"
```

More examples:

```bash
node index.js --app "Notion" --competitors "Obsidian,Roam Research"
node index.js --app "Todoist" --competitors "Things 3,TickTick,Any.do"
node index.js --app "Duolingo" --competitors "Babbel,Rosetta Stone"
node index.js --app "Strava" --competitors "Nike Run Club,Garmin Connect"
```

You can also trigger the agent from Kiro chat:

> "Analyze Spotify vs Apple Music and YouTube Music"
> "Run discovery on Notion"
> "Analyze the top competitors of Duolingo"

---

## 4. Understanding the Output

The Confluence document contains:

**Executive Summary** — 3-4 sentence overview of key findings.

**App Overview** — Side-by-side metadata: ratings, installs, pricing, last updated.

**User Sentiment** — Derived from real reviews:
- What users love (specific, not generic)
- What users hate (recurring pain points)
- Feature requests (explicitly asked for)
- Reported bugs (technical issues across multiple reviews)

**Rating Distribution** — 1-5 star breakdown for iOS and Android. A spike in 1-star ratings often signals a recent regression.

**Feature Comparison** — Matrix of which features each app has, followed by a gap analysis with High/Medium/Low impact ratings.

**ASO Analysis** — Keyword coverage, store listing score, and quick wins for improving visibility.

**Strategic Recommendations** — 5-7 actionable items grounded in the data above.

---

## 5. Tips

**Use exact app names for less well-known apps.** The agent searches by name. "Spotify" works fine; for niche apps, use the full store name to avoid pulling the wrong result.

**Provide competitors when you know them.** Auto-discovery works but isn't always accurate. Explicit names are faster and more reliable.

**Limit to 3-4 competitors.** Each competitor adds ~2 minutes and ~$0.002 to the run. More than 4 rarely adds proportional value.

**Re-run quarterly.** Ratings and reviews change. A single snapshot is a starting point, not a trend.

---

## 6. Troubleshooting

| Error | Fix |
|---|---|
| "No App Store / Play Store results found" | Check spelling, or use the full store name |
| "All LLM models failed" | Wait 5 minutes and retry; check OpenRouter balance at openrouter.ai/credits |
| Confluence 401 | Regenerate your API token |
| Confluence 404 | Confirm the parent page ID in the Confluence URL |
| "Missing required environment variables" | Check that `.env` exists and all fields are filled |
| Empty or malformed Confluence page | Set `DEBUG=true` in `.env` and re-run to see full error traces |

---

## 7. Cost Reference

Default model: `deepseek/deepseek-v4-flash` via OpenRouter.

| Run type | Cost | Time |
|---|---|---|
| Single app, no competitors | ~$0.002 | 2-3 min |
| App + 1 competitor | ~$0.004 | 3-5 min |
| App + 3 competitors | ~$0.006 | 5-10 min |
| App + 4 competitors | ~$0.008 | 8-12 min |

$10 in OpenRouter credits covers approximately 1,500 full runs.

To reduce cost (8x cheaper, slightly lower quality):

```env
OPENROUTER_MODEL=mistralai/mistral-nemo
```
