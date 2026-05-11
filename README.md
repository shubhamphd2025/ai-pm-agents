# 🤖 AI PM Agents

A collection of AI-powered agents built to assist Product Managers with research, discovery, and analysis workflows.

Each agent lives in its own folder, publishes outputs to Confluence, and can be triggered from the command line or directly inside [Kiro](https://kiro.dev).

---

## Agents

### 🔍 [Assistant PM — Discovery](./agents/pm-discovery/)

Analyzes any mobile app from the App Store and Google Play Store, compares it against competitors, and publishes a structured product discovery document to Confluence.

**What it produces:**
- App metadata comparison (ratings, installs, pricing)
- User sentiment analysis — loves, hates, feature requests, bugs
- Feature gap analysis with impact ratings
- ASO keyword analysis and quick wins
- Strategic recommendations

**Run it:**
```bash
node agents/pm-discovery/index.js --app "Spotify"
node agents/pm-discovery/index.js --app "Notion" --competitors "Obsidian,Roam Research"
```

📖 [Full User Guide](./GUIDE.md)

---

## Setup

Each agent has its own dependencies and `.env` config. See the agent's README for setup instructions.

**Common requirements:**
- Node.js v18+
- [OpenRouter](https://openrouter.ai/) API key (free tier available)
- Confluence API token

---

## Structure

```
ai-pm-agents/
├── GUIDE.md                          # Full user guide
├── agents/
│   └── pm-discovery/                 # Assistant PM — Discovery Agent
│       ├── index.js                  # Entry point
│       ├── src/                      # Agent modules
│       ├── .env.example              # Config template
│       └── README.md                 # Agent-specific docs
└── .kiro/
    ├── agents/                       # Kiro agent definitions
    └── hooks/                        # Kiro automation hooks
```

---

## Confluence Output

All agents publish to:
```
Agents
  └── Assistant PM — Discovery
        └── Discovery: [App Name] — [Date]
```

---

*Built with [Kiro](https://kiro.dev)*
