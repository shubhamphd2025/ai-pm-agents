# Assistant PM — Discovery

Analyzes mobile apps from the App Store and Google Play Store, compares them against competitors, and publishes a structured discovery document to Confluence.

See [GUIDE.md](../../GUIDE.md) for full setup and usage instructions.

## Quick Start

```bash
npm install
cp .env.example .env   # fill in credentials
node index.js --app "Spotify"
node index.js --app "Spotify" --competitors "Apple Music,YouTube Music"
```

## Modules

| File | Purpose |
|---|---|
| `index.js` | CLI entry point, argument parsing, env validation |
| `src/orchestrator.js` | Coordinates the full pipeline |
| `src/appStoreScraper.js` | Pulls data from Apple App Store |
| `src/playStoreScraper.js` | Pulls data from Google Play Store |
| `src/llmClient.js` | OpenRouter client with retry and model fallback |
| `src/sentimentAnalyzer.js` | Extracts themes from user reviews |
| `src/competitorFinder.js` | Auto-discovers competitors via LLM |
| `src/featureAnalyzer.js` | Extracts features and identifies gaps |
| `src/asoAnalyzer.js` | Analyzes keywords and store listing quality |
| `src/confluencePublisher.js` | Builds and publishes the Confluence document |

## Model

Default: `deepseek/deepseek-v4-flash` via [OpenRouter](https://openrouter.ai/)

Cost: ~$0.006 per full run. Fallback chain: Mistral Nemo → Qwen3 14B → Mistral Small 24B.

## Data Sources

- App Store: `app-store-scraper` (free)
- Play Store: `google-play-scraper` (free)
- AI analysis: OpenRouter API

## Troubleshooting

See [GUIDE.md — Troubleshooting](../../GUIDE.md#6-troubleshooting).
