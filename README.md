# Share2Agent

**Share any page with your AI agent via webhook.**

A Chrome extension that extracts page content with one click and sends it to any webhook endpoint — your AI agent, Zapier, n8n, Make, or a custom backend.

## How It Works

1. Click the extension icon on any page
2. Add an optional comment (e.g., "Summarize this article")
3. Hit **Send** (or **Ctrl+Enter**) — the page content + your comment are POSTed to your webhook

If you select text before clicking, only the selection is sent (not the full page).

## Installation

### From Chrome Web Store

Coming soon.

### From Source (Developer Mode)

1. Clone this repo: `git clone https://github.com/mnardit/share2agent.git`
2. Open `chrome://extensions/` in Chrome
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked** and select the cloned folder
5. Pin the extension to your toolbar

### Configuration

1. Click the extension icon → **Settings** (or right-click → Options)
2. Enter your webhook URL
3. Click **Save**

## Webhook Payload

The extension sends a `POST` request with `Content-Type: application/json`:

```json
{
  "url": "https://example.com/article",
  "title": "Page Title",
  "content": "Extracted clean text of the page",
  "comment": "Your instruction to the agent",
  "timestamp": "2026-03-28T12:00:00.000Z",
  "meta": {
    "description": "Page meta description",
    "og_image": "https://example.com/image.jpg",
    "og_type": "article",
    "site_name": "Example",
    "author": "Author Name",
    "canonical": "https://example.com/article",
    "language": "en",
    "published_time": "2026-01-15T08:00:00Z"
  }
}
```

- **content** — clean text extracted via [Readability.js](https://github.com/mozilla/readability) (falls back to `innerText` for non-article pages)
- **comment** — whatever the user typed in the popup (can be empty string)
- **meta** — page metadata from Open Graph, meta tags, and HTML attributes. All fields are strings; empty when not available.

## Integration Guides

**Automation:** [n8n](https://max.nardit.com/share2agent/guides/n8n) · [Zapier](https://max.nardit.com/share2agent/guides/zapier) · [Make](https://max.nardit.com/share2agent/guides/make) · [ActivePieces](https://max.nardit.com/share2agent/guides/activepieces)

**AI Agents:** [Claude Code](https://max.nardit.com/share2agent/guides/claude-code) · [Cursor](https://max.nardit.com/share2agent/guides/cursor) · [Windsurf](https://max.nardit.com/share2agent/guides/windsurf) · [GitHub Copilot](https://max.nardit.com/share2agent/guides/github-copilot) · [Aider](https://max.nardit.com/share2agent/guides/aider)

**Local LLMs:** [Ollama](https://max.nardit.com/share2agent/guides/ollama) · [LM Studio](https://max.nardit.com/share2agent/guides/lm-studio)

**Custom:** [Any webhook](https://max.nardit.com/share2agent/guides/generic) (Python, Node.js, curl)

## Use Cases

- **AI agents** — send articles to Claude Code, ChatGPT, or custom agents
- **Automation** — trigger Zapier, Make, or n8n workflows from any web page
- **Research** — save articles to a personal knowledge base
- **Team sharing** — feed pages into Slack, Notion, or Google Sheets

## Privacy

Share2Agent does not collect, store, or transmit any data to third parties.

- Page content is sent **only** to the webhook URL you configure
- No analytics, no tracking, no telemetry
- No background activity — the extension only activates when you click it
- Permissions used:
  - `activeTab` — read the current page when you click the extension
  - `scripting` — inject content extraction script into the page
  - `storage` — save your webhook URL setting

## Tech Stack

- Chrome Extension (Manifest V3)
- Vanilla JavaScript (no frameworks)
- [Mozilla Readability.js](https://github.com/mozilla/readability) for content extraction (Apache-2.0)

## License

MIT — see [LICENSE](LICENSE).

[Readability.js](https://github.com/mozilla/readability) is included under the Apache License 2.0.
