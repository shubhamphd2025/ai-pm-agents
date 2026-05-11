# 🔍 Assistant PM — Discovery Agent

An AI-powered product discovery agent that analyzes mobile apps from the **App Store** and **Google Play Store**, then generates structured, actionable discovery documents published directly to **Confluence**.

> 📖 **New here?** Read the [User Guide](../../GUIDE.md) for a full walkthrough.

---

## What It Does

Given one or more app names, this agent:

1. **Pulls app metadata** — ratings, reviews, descriptions, install counts, pricing
2. **Runs sentiment analysis** — what users love, hate, and keep requesting
3. **Discovers competitors** — automatically if not provided
4. **Compares features** — side-by-side feature gap analysis
5. **Analyzes ASO** — keywords, ranking signals, store optimization opportunities
6. **Tracks rating distribution** — 1–5 star breakdown across iOS and Android
7. **Publishes to Confluence** — a clean, structured discovery document

---

## Quick Start

```bash
# Install dependencies
npm install

# Copy and fill in your credentials
cp .env.example .env

# Run an analysis
node index.js --app "Spotify"

# Run with specific competitors
node index.js --app "Spotify" --competitors "Apple Music,YouTube Music,Tidal"
```

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

**Required variables:**

```env
# OpenRouter API key (get it at openrouter.ai — free tier available)
OPENROUTER_API_KEY=sk-or-v1-...

# AI model (default is already set)
OPENROUTER_MODEL=deepseek/deepseek-v4-flash

# Confluence credentials
CONFLUENCE_BASE_URL=https://yourcompany.atlassian.net
CONFLUENCE_EMAIL=you@yourcompany.com
CONFLUENCE_API_TOKEN=your-api-token-here
CONFLUENCE_SPACE_KEY=your-space-key
CONFLUENCE_PARENT_PAGE_ID=your-page-id
```

**Where to get these:**
- **OpenRouter API Key**: [openrouter.ai](https://openrouter.ai/) — sign up, go to Keys → Create Key
- **Confluence API Token**: [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
- **Space Key**: Confluence → Space Settings → Space Details
- **Parent Page ID**: The number in the URL of your "Assistant PM — Discovery" page

---

## Usage

```bash
# Auto-discover competitors
node index.js --app "Notion"

# Specify competitors
node index.js --app "Todoist" --competitors "Things 3,TickTick,Any.do"

# More examples
node index.js --app "Duolingo" --competitors "Babbel,Rosetta Stone"
node index.js --app "Strava" --competitors "Nike Run Club,Garmin Connect"
```

**Expected runtime:** 5–10 minutes per full analysis.

---

## Output

A Confluence page is published under **Agents → Assistant PM — Discovery** containing:

| Section | Contents |
|---|---|
| 📋 Executive Summary | 3–4 sentence PM-level overview |
| 📱 App Overview | Side-by-side metadata table |
| 💬 User Sentiment | Loves, hates, feature requests, bugs |
| ⭐ Rating Distribution | 1–5 star breakdown, iOS & Android |
| 🔧 Feature Comparison | Feature matrix + gap analysis |
| 🔑 ASO Analysis | Keywords, scores, quick wins |
| 🎯 Recommendations | 5–7 actionable strategic recommendations |

---

## Architecture

```
User Request
    ↓
orchestrator.js (coordinates everything)
    ↓
┌─────────────────────────────────────────┐
│  Data Collection (parallel)             │
│  appStoreScraper.js + playStoreScraper  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  AI Analysis (via OpenRouter)           │
│  sentimentAnalyzer.js                   │
│  competitorFinder.js                    │
│  featureAnalyzer.js                     │
│  asoAnalyzer.js                         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│  Document Generation                    │
│  confluencePublisher.js                 │
└─────────────────────────────────────────┘
    ↓
Confluence Page Published
```

---

## Modules

| Module | Purpose |
|---|---|
| `index.js` | CLI entry point |
| `src/orchestrator.js` | Main coordinator — runs the full pipeline |
| `src/appStoreScraper.js` | Pulls data from Apple App Store |
| `src/playStoreScraper.js` | Pulls data from Google Play Store |
| `src/llmClient.js` | Shared LLM client with retry + model fallback |
| `src/sentimentAnalyzer.js` | Analyzes reviews to extract themes |
| `src/competitorFinder.js` | Auto-discovers competitors |
| `src/featureAnalyzer.js` | Extracts features and identifies gaps |
| `src/asoAnalyzer.js` | Analyzes keywords and store optimization |
| `src/confluencePublisher.js` | Formats and publishes to Confluence |

---

## AI Model

**Default:** `deepseek/deepseek-v4-flash` via [OpenRouter](https://openrouter.ai/)

**Cost:** ~$0.006 per full analysis run (~1,500 runs per $10)

**Fallback chain:** DeepSeek V4 Flash → Mistral Nemo → Qwen3 14B → Mistral Small 24B

The agent automatically retries with fallback models if the primary model is unavailable.

To use a cheaper model (8x less cost, slightly lower quality):
```env
OPENROUTER_MODEL=mistralai/mistral-nemo
```

---

## Data Sources

- **App Store**: `app-store-scraper` npm package (free)
- **Play Store**: `google-play-scraper` npm package (free)
- **AI Synthesis**: OpenRouter API (DeepSeek V4 Flash)

---

## Troubleshooting

| Error | Fix |
|---|---|
| "No App Store results found" | Check spelling or use the full store name |
| "All LLM models failed" | Wait 5 min and retry, or check OpenRouter balance |
| "Confluence 401" | Regenerate your API token |
| "Missing environment variables" | Check `.env` exists and all fields are filled |

For detailed troubleshooting, see the [User Guide](../../GUIDE.md#8-troubleshooting).

---

## License

ISC
