# Share2Agent

**Share any page with your AI agent via webhook.**

A Chrome extension that extracts page content with one click and sends it as clean Markdown to any webhook endpoint — your AI agent, Zapier, n8n, Make, or a custom backend.

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/bbdffiegdmiagohjaefnnldfdabkjjgo)](https://chromewebstore.google.com/detail/share2agent/bbdffiegdmiagohjaefnnldfdabkjjgo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## How It Works

1. Click the extension icon on any page
2. Choose which agent to send to
3. Add an optional instruction (e.g., "Summarize this", "Extract tasks")
4. Hit **Send** (or **Ctrl+Enter**)

The page content is extracted as Markdown and POSTed as JSON to your webhook.

## Features

- **Markdown output** — Turndown.js + GFM plugin preserves tables, headings, code blocks, and links
- **Multiple agents** — configure different webhook endpoints with names, emoji avatars, and colors
- **Full-page screenshot** — optional scroll-and-stitch capture (JPEG), sent alongside the text
- **YouTube transcripts** — extracts timestamped transcripts from video pages, including Shorts
- **Gmail threads** — full email conversations with participant roles and message history
- **Quick actions** — one-click instruction chips: Summarize, Extract tasks, Save, Analyze
- **Image detection** — sends images directly without unnecessary text extraction
- **Page metadata** — Open Graph tags, author, language, publication date
- **Selected text** — highlight text on a page to send just that part
- **Keyboard shortcuts** — Ctrl+Enter to send, Alt+1/2/3 to switch agents
- **Test webhook** — verify your endpoint works before saving
- **Dark mode** — respects your system preference
- **Zero tracking** — no analytics, no telemetry, no data collection

## Installation

### Chrome Web Store

[**Install Share2Agent**](https://chromewebstore.google.com/detail/share2agent/bbdffiegdmiagohjaefnnldfdabkjjgo)

### From Source

1. Clone: `git clone https://github.com/mnardit/share2agent.git`
2. Open `chrome://extensions/` → enable **Developer mode**
3. Click **Load unpacked** → select the cloned folder
4. Pin the extension to your toolbar

## Webhook Payload

The extension sends a `POST` with `Content-Type: application/json`:

```json
{
  "schema": "share2agent/v1",
  "url": "https://example.com/article",
  "title": "Page Title",
  "content": "# Extracted Markdown\n\nClean text with **formatting**, [links](url), and tables.",
  "comment": "Summarize this article",
  "timestamp": "2026-04-02T12:00:00.000Z",
  "meta": {
    "type": "page",
    "description": "Page meta description",
    "og_title": "Page Title",
    "author": "Author Name",
    "language": "en"
  },
  "screenshot": "data:image/jpeg;base64,..."
}
```

### Content Types

| `meta.type` | Source | Content |
|-------------|--------|---------|
| `page` | Any website | Markdown via Readability.js + Turndown.js |
| `youtube` | YouTube video | Timestamped transcript + video metadata |
| `gmail_thread` | Gmail | Messages with participants, roles, dates |
| `image` | Direct image URL | Image file (no text extraction) |

## Integration Guides

**Automation:** [n8n](https://max.nardit.com/share2agent/guides/n8n) · [Zapier](https://max.nardit.com/share2agent/guides/zapier) · [Make](https://max.nardit.com/share2agent/guides/make) · [ActivePieces](https://max.nardit.com/share2agent/guides/activepieces)

**AI Agents:** [Claude Code](https://max.nardit.com/share2agent/guides/claude-code) · [Cursor](https://max.nardit.com/share2agent/guides/cursor) · [Windsurf](https://max.nardit.com/share2agent/guides/windsurf) · [GitHub Copilot](https://max.nardit.com/share2agent/guides/github-copilot) · [Aider](https://max.nardit.com/share2agent/guides/aider)

**Local LLMs:** [Ollama](https://max.nardit.com/share2agent/guides/ollama) · [LM Studio](https://max.nardit.com/share2agent/guides/lm-studio)

**Custom:** [Any webhook](https://max.nardit.com/share2agent/guides/generic) (Python, Node.js, curl)

## Use Cases

- **AI agents** — send articles, docs, emails to Claude Code, ChatGPT, or custom agents
- **Automation** — trigger Zapier, Make, or n8n workflows from any web page
- **Research** — save articles with YouTube transcripts to a knowledge base
- **Team sharing** — feed pages into Slack, Notion, or Google Sheets

## Privacy

Share2Agent does not collect, store, or transmit any data to third parties. Page content is sent **only** to the webhook URL you configure. No analytics, no tracking, no background activity.

Full privacy policy: [PRIVACY.md](PRIVACY.md)

## Tech Stack

- Chrome Extension (Manifest V3), minimum Chrome 103
- Vanilla JavaScript (no frameworks, no build step)
- [Mozilla Readability.js](https://github.com/mozilla/readability) — content extraction (Apache-2.0)
- [Turndown.js](https://github.com/mixmark-io/turndown) — HTML to Markdown (MIT)
- [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) — GFM tables, strikethrough, task lists (MIT)

## License

MIT — see [LICENSE](LICENSE).
