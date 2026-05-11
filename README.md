# AI PM Agents

A collection of AI agents for product management workflows. Each agent lives in its own folder, runs from the command line, and publishes output to Confluence.

## Agents

### [Assistant PM — Discovery](./agents/pm-discovery/)

Analyzes a mobile app from the App Store and Google Play Store, compares it against competitors, and publishes a structured discovery document to Confluence.

```bash
node agents/pm-discovery/index.js --app "Spotify"
node agents/pm-discovery/index.js --app "Notion" --competitors "Obsidian,Roam Research"
```

See [GUIDE.md](./GUIDE.md) for setup and usage instructions.

## Requirements

- Node.js v18+
- [OpenRouter](https://openrouter.ai/) API key
- Confluence API token

## Repository Structure

```
ai-pm-agents/
├── GUIDE.md                        # Setup and usage guide
├── TESTING.md                      # Test results and known issues
├── agents/
│   └── pm-discovery/               # Assistant PM — Discovery agent
│       ├── index.js
│       ├── src/
│       ├── .env.example
│       └── README.md
└── .kiro/
    ├── agents/                     # Kiro agent definitions
    └── hooks/                      # Kiro automation hooks
```
