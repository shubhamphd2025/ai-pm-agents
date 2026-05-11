#!/usr/bin/env node
/**
 * Assistant PM — Discovery Agent
 * Entry point — parses CLI arguments and kicks off the analysis
 *
 * Usage:
 *   node index.js --app "Spotify" --competitors "Apple Music,YouTube Music"
 *   node index.js --app "Notion"
 *   node index.js --app "Todoist" --competitors "Things 3,TickTick,Any.do"
 */

require('dotenv').config();
const { runDiscovery } = require('./src/orchestrator');

// ── Parse CLI arguments ──────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--app' && args[i + 1]) {
      parsed.app = args[i + 1];
      i++;
    } else if (args[i] === '--competitors' && args[i + 1]) {
      parsed.competitors = args[i + 1].split(',').map((c) => c.trim()).filter(Boolean);
      i++;
    } else if (args[i] === '--parent-page-id' && args[i + 1]) {
      parsed.parentPageId = args[i + 1];
      i++;
    }
  }

  return parsed;
}

// ── Validate environment ─────────────────────────────────────────────────────
function validateEnv() {
  const required = [
    'OPENROUTER_API_KEY',
    'CONFLUENCE_BASE_URL',
    'CONFLUENCE_EMAIL',
    'CONFLUENCE_API_TOKEN',
    'CONFLUENCE_SPACE_KEY',
    'CONFLUENCE_PARENT_PAGE_ID',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variables:\n   ${missing.join('\n   ')}`);
    console.error(`\n   Copy .env.example to .env and fill in the values.\n`);
    process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  validateEnv();

  const args = parseArgs();

  if (!args.app) {
    console.error(`\n❌ Usage: node index.js --app "App Name" [--competitors "App1,App2"]\n`);
    process.exit(1);
  }

  try {
    await runDiscovery({
      targetAppName: args.app,
      competitorNames: args.competitors || [],
      confluenceParentPageId: args.parentPageId || process.env.CONFLUENCE_PARENT_PAGE_ID,
    });
  } catch (err) {
    console.error(`\n❌ Analysis failed: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  }
}

main();
