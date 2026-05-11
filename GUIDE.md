# Assistant PM — Discovery Agent
## User Guide

> An AI agent that researches any mobile app, compares it against competitors, and publishes a structured product discovery document to Confluence — in one command.

---

## Table of Contents

1. [What This Agent Does](#1-what-this-agent-does)
2. [Prerequisites](#2-prerequisites)
3. [Setup](#3-setup)
4. [Running the Agent](#4-running-the-agent)
5. [Understanding the Output](#5-understanding-the-output)
6. [Using with Kiro Chat](#6-using-with-kiro-chat)
7. [Tips & Best Practices](#7-tips--best-practices)
8. [Troubleshooting](#8-troubleshooting)
9. [Cost Reference](#9-cost-reference)

---

## 1. What This Agent Does

You give it an app name. It does the rest.

**Step by step, the agent:**

1. Searches the App Store and Google Play Store for the app
2. Pulls metadata — ratings, reviews, description, install counts, pricing
3. Identifies top competitors (automatically, or uses the ones you provide)
4. Pulls the same data for each competitor
5. Runs AI-powered analysis across all apps:
   - What users love and hate (from real reviews)
   - Feature gaps — what competitors have that your app doesn't
   - ASO keywords and store optimization opportunities
   - Rating distribution and health
6. Writes a structured discovery document and publishes it to Confluence

**Total time:** 5–10 minutes per analysis.

**Output location in Confluence:**
```
Agents
  └── Assistant PM — Discovery
        └── Discovery: [App Name] — [Date]   ← your document lands here
```

---

## 2. Prerequisites

Before running the agent, you need:

| Requirement | Status | Notes |
|---|---|---|
| Node.js | ✅ Already installed | v24+ |
| OpenRouter API Key | ✅ Already configured | For AI analysis |
| Confluence Access | ✅ Already configured | For publishing |
| Internet connection | Required | For store scraping |

If you're setting this up on a new machine, see [Setup](#3-setup).

---

## 3. Setup

### Step 1 — Install dependencies

Open your terminal, navigate to the project folder, and run:

```bash
cd agents/pm-discovery
npm install
```

### Step 2 — Configure your credentials

Copy the example config file:

```bash
cp .env.example .env
```

Open `.env` and fill in these values:

```env
# Your OpenRouter API key (get it at openrouter.ai)
OPENROUTER_API_KEY=sk-or-v1-...

# The AI model to use (default is already set — don't change unless needed)
OPENROUTER_MODEL=deepseek/deepseek-v4-flash

# Your Confluence details
CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
CONFLUENCE_EMAIL=you@yourcompany.com
CONFLUENCE_API_TOKEN=your-api-token-here
CONFLUENCE_SPACE_KEY=your-space-key
CONFLUENCE_PARENT_PAGE_ID=your-page-id
```

**Where to get your Confluence API token:**
1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**
3. Give it a name (e.g., "PM Discovery Agent")
4. Copy the token and paste it into `.env`

**Where to find your Confluence Space Key:**
- Open Confluence → go to your space → **Space Settings** → **Space Details**
- The key is the short code (e.g., `PROD`, `PM`, `~yourusername`)

**Where to find the Parent Page ID:**
- Open the "Assistant PM — Discovery" page in Confluence
- Look at the URL: `.../pages/49053697/...`
- The number is the page ID

### Step 3 — Validate the setup

Run this to confirm everything is connected:

```bash
node -e "
require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');

async function check() {
  // Check OpenRouter
  const llm = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
  const r = await llm.chat.completions.create({ model: process.env.OPENROUTER_MODEL, max_tokens: 10, messages: [{ role: 'user', content: 'Say OK' }] });
  console.log('✅ OpenRouter:', r.choices[0].message.content.trim());

  // Check Confluence
  const c = await axios.get(process.env.CONFLUENCE_BASE_URL + '/wiki/rest/api/content/' + process.env.CONFLUENCE_PARENT_PAGE_ID, { auth: { username: process.env.CONFLUENCE_EMAIL, password: process.env.CONFLUENCE_API_TOKEN } });
  console.log('✅ Confluence:', c.data.title);
}

check().catch(e => console.error('❌', e.message));
"
```

You should see two green checkmarks. If not, see [Troubleshooting](#8-troubleshooting).

---

## 4. Running the Agent

All commands are run from the `agents/pm-discovery/` folder.

### Analyze a single app (auto-discover competitors)

```bash
node index.js --app "Spotify"
```

The agent will automatically find the top 3 competitors and include them in the analysis.

### Analyze with specific competitors

```bash
node index.js --app "Spotify" --competitors "Apple Music,YouTube Music,Tidal"
```

Use this when you already know which competitors matter. Separate names with commas, no spaces around commas.

### More examples

```bash
# Productivity apps
node index.js --app "Notion"
node index.js --app "Notion" --competitors "Obsidian,Roam Research,Confluence"

# Task managers
node index.js --app "Todoist" --competitors "Things 3,TickTick,Any.do"

# Language learning
node index.js --app "Duolingo" --competitors "Babbel,Rosetta Stone"

# Fitness
node index.js --app "Strava" --competitors "Nike Run Club,Garmin Connect"

# Finance
node index.js --app "Monzo" --competitors "Revolut,Starling Bank"
```

### What you'll see while it runs

```
🚀 Starting PM Discovery Analysis
   Target: Spotify
   Competitors provided: Auto-discover

📦 Pulling data for: Spotify
[App Store] Found: Spotify: Music and Podcasts (324684580)
[Play Store] Found: Spotify: Music and Podcasts (com.spotify.music)
  🔬 Analyzing: Spotify

🔍 Auto-discovering competitors...
   Found: YouTube Music, Deezer, SoundCloud

📦 Pulling data for: YouTube Music
...

🔧 Running feature gap analysis...
🔑 Running ASO analysis...
✍️  Generating executive summary and recommendations...
📄 Publishing to Confluence...

✅ Analysis complete!
   📄 Confluence page: https://yourcompany.atlassian.net/...
```

**Expected runtime:** 5–10 minutes for a full analysis (target + 3 competitors).

---

## 5. Understanding the Output

Once complete, a new page appears in Confluence under **Agents → Assistant PM — Discovery**.

Here's what each section tells you:

### 📋 Executive Summary
A 3–4 sentence PM-level summary of the key findings. Read this first — it tells you the most important things without needing to read the full document.

### 📱 App Overview Table
Side-by-side metadata for all apps analyzed:

| What you see | What it means |
|---|---|
| iOS / Android Rating | Current store rating out of 5 |
| Review count | Total number of ratings (proxy for user base size) |
| Installs | Android install range (e.g., "100M+") |
| Price | Free / Paid / Freemium |
| Last Updated | How actively maintained the app is |

### 💬 User Sentiment Analysis
Derived from real user reviews, broken into four buckets:

- **❤️ Loves** — specific things users praise repeatedly
- **😤 Hates** — recurring pain points and frustrations
- **🙏 Feature Requests** — things users explicitly ask for
- **🐛 Bugs** — technical issues mentioned across multiple reviews

Each point is specific and sourced from actual reviews — not generic observations.

### ⭐ Rating Distribution
The 1–5 star breakdown for both iOS and Android. Useful for spotting patterns:
- High 1-star + high 5-star = polarizing app (strong opinions)
- Mostly 4-5 star = healthy, satisfied user base
- Spike in recent 1-stars = something broke recently

### 🔧 Feature Comparison Matrix
A ✅/❌ grid showing which features each app has. Below it:

- **Feature Gaps** — features competitors have that the target app is missing, rated High/Medium/Low impact
- **Unique Advantages** — features only the target app has (competitive moat)

### 🔑 ASO & Keyword Analysis
How well the app is optimized for store search:
- **ASO Score** (1–10) — overall store listing health
- **Top Keywords** — terms the app ranks for or should target
- **Quick Wins** — immediate changes that would improve visibility
- **Competitive ASO** — how the app's store presence compares to competitors

### 🎯 Strategic Recommendations
5–7 actionable recommendations for the product team, grounded in the data above. Each recommendation references the specific evidence behind it.

---

## 6. Using with Kiro Chat

If you're working inside Kiro, you can trigger the agent directly in chat without typing terminal commands.

Just describe what you want:

> "Analyze Spotify"

> "Run a discovery analysis on Notion and compare it with Obsidian and Roam Research"

> "Analyze the top competitors of Duolingo"

> "I want to understand the Strava market — analyze it vs Nike Run Club and Garmin"

Kiro will parse your intent, run the analysis, and post the Confluence link when done.

---

## 7. Tips & Best Practices

**Use exact app names when possible**
The agent searches the store by name. "Spotify" works fine, but if you're analyzing a less well-known app, use the exact name from the store listing to avoid pulling the wrong app.

**Provide competitors when you know them**
Auto-discovery is convenient but not always perfect. If you know the competitive landscape, pass the names explicitly — it's faster and more accurate.

```bash
# Less precise
node index.js --app "Monzo"

# More precise
node index.js --app "Monzo" --competitors "Revolut,Starling Bank,N26"
```

**Limit to 3–4 competitors**
More competitors = more LLM calls = longer runtime and higher cost. 3 competitors is the sweet spot for a useful comparison without bloat.

**Run it before a discovery sprint**
The output is designed to be a starting point, not a final answer. Use it to frame your research questions, not replace them. The agent surfaces signals — you interpret them.

**Re-run periodically**
App ratings and reviews change. Running the same analysis every quarter gives you a trend view that a single snapshot can't.

---

## 8. Troubleshooting

### "No App Store / Play Store results found"
The app name didn't match anything in the store.
- Check the spelling
- Try the full store name (e.g., `"Spotify: Music and Podcasts"` instead of `"Spotify"`)
- Some apps are region-restricted and may not appear in US store results

### "All LLM models failed"
OpenRouter rate limits were hit across all fallback models.
- Wait 5 minutes and try again
- Or reduce competitors: `--competitors "Apple Music"` (just one)
- Check your OpenRouter balance at [openrouter.ai/credits](https://openrouter.ai/credits)

### "Confluence publish failed — 401"
Your Confluence API token has expired or is invalid.
- Generate a new token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
- Update `CONFLUENCE_API_TOKEN` in your `.env` file

### "Confluence publish failed — 404"
The parent page ID doesn't exist or you don't have access to it.
- Confirm the page ID in the Confluence URL
- Make sure you have edit permissions on the space

### "Missing required environment variables"
Your `.env` file is missing or incomplete.
- Check that `agents/pm-discovery/.env` exists (not just `.env.example`)
- Confirm all six required variables are filled in

### Analysis runs but Confluence page is empty / malformed
This is usually a partial LLM failure where one module returned no data.
- Run with `DEBUG=true` in your `.env` to see full error traces
- Try again — transient LLM errors are common on free/cheap models

---

## 9. Cost Reference

The agent uses **DeepSeek V4 Flash** via OpenRouter by default.

| Scenario | Approx. Cost | Time |
|---|---|---|
| Single app, no competitors | ~$0.002 | 2–3 min |
| App + 1 competitor | ~$0.004 | 3–5 min |
| App + 3 competitors (default) | ~$0.006 | 5–10 min |
| App + 4 competitors (max) | ~$0.008 | 8–12 min |

**With $10 in OpenRouter credits, you can run ~1,500 full analyses.**

If you want to reduce cost at the expense of some quality, change `OPENROUTER_MODEL` in your `.env`:

```env
# Budget option — 8x cheaper, nearly same quality
OPENROUTER_MODEL=mistralai/mistral-nemo
```

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│  ASSISTANT PM — DISCOVERY AGENT                                 │
│  Quick Reference                                                │
├─────────────────────────────────────────────────────────────────┤
│  Basic run:                                                     │
│    node index.js --app "App Name"                               │
│                                                                 │
│  With competitors:                                              │
│    node index.js --app "App Name" \                             │
│      --competitors "App1,App2,App3"                             │
│                                                                 │
│  Output: Confluence → Agents → Assistant PM — Discovery         │
│                                                                 │
│  Runtime: 5–10 minutes                                          │
│  Cost: ~$0.006 per full run                                     │
│  Model: DeepSeek V4 Flash (fallback: Mistral Nemo)              │
└─────────────────────────────────────────────────────────────────┘
```

---

*Built with Kiro · Powered by OpenRouter · Publishes to Confluence*
