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
  // Only OPENROUTER_API_KEY is strictly required to run the analysis.
  // Confluence vars are optional — if missing, output is saved as a local .md file.
  const required = ['OPENROUTER_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`\nMissing required environment variables:\n  ${missing.join('\n  ')}`);
    console.error(`\nCopy .env.example to .env and fill in the values.\n`);
    process.exit(1);
  }

  const confluenceVars = [
    'CONFLUENCE_BASE_URL',
    'CONFLUENCE_EMAIL',
    'CONFLUENCE_API_TOKEN',
    'CONFLUENCE_SPACE_KEY',
    'CONFLUENCE_PARENT_PAGE_ID',
  ];
  const missingConfluence = confluenceVars.filter((key) => !process.env[key]);
  if (missingConfluence.length > 0) {
    console.warn(`\n[info] Confluence not fully configured (missing: ${missingConfluence.join(', ')})`);
    console.warn(`[info] Output will be saved as a local Markdown file in outputs/ instead.\n`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  validateEnv();

  const args = parseArgs();

  if (!args.app || !args.app.trim()) {
    console.error(`\nUsage: node index.js --app "App Name" [--competitors "App1,App2"]\n`);
    process.exit(1);
  }

  try {
    const result = await runDiscovery({
      targetAppName: args.app,
      competitorNames: args.competitors || [],
      confluenceParentPageId: args.parentPageId || process.env.CONFLUENCE_PARENT_PAGE_ID,
    });

    if (result.markdownPath) {
      console.log(`\n✅ Analysis complete. Report saved to:\n   ${result.markdownPath}\n`);
    } else {
      console.log(`\n✅ Analysis complete. Published to Confluence.\n`);
    }
  } catch (err) {
    console.error(`\nAnalysis failed: ${err.message}`);
    if (process.env.DEBUG === 'true') console.error(err.stack);
    process.exit(1);
  }
}

main();
