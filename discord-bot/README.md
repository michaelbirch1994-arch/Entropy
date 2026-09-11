# Entropy Discord Bot

A standalone Discord community service for Entropy. It intentionally lives outside the Vite/Tauri frontend runtime.

## What it does

- Registers `/status` and `/setup` commands in the configured Entropy server.
- Creates Entropy roles, categories, channels, announcement surfaces, private team channels, and forum-style feedback areas.
- Uses forum tags for bug reports, feature requests, UI feedback, and test results.
- Keeps setup non-destructive and safe to rerun.

## Required environment variables

```text
DISCORD_APPLICATION_ID=1548019528301027448
DISCORD_GUILD_ID=1536771144416231474
DISCORD_BOT_TOKEN=<private bot token>
```

Never commit the real bot token.

## Discord prerequisite

Enable **Community** in Discord Server Settings before running `/setup`. Entropy uses Community-only forum and announcement channel features.

## Local run

```bash
cd discord-bot
npm install
npm run check
npm start
```

## Hosting

Use a persistent Node.js worker/service rather than a Vercel serverless function. Configure the service root directory as `discord-bot`, add the three environment variables above, and use `npm start` as the start command.
