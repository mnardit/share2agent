# Changelog

## 0.4.0 — 2026-04-01

### Added
- Markdown output via Turndown.js v7.2.2 + GFM plugin — tables, headings, code blocks, links preserved
- Image/SVG stripping — agents get clean text, no decorative noise
- Full-page screenshot — toggle switch, scroll+stitch, JPEG 50% 1x, HiDPI-aware, 15-step cap
- YouTube transcript extraction — auto-opens transcript panel, 2026 + legacy DOM selectors, Shorts support, i18n menu
- YouTube metadata — channel, duration, views, video ID, caption language
- Direct image detection via document.contentType — sent as image file, no markdown
- PDF detection with actionable error message
- Gmail quoted content stripping (.gmail_quote, .gmail_signature)
- Gmail compose/settings URL exclusion
- Webhook payload schema versioning (share2agent/v1)
- Guaranteed meta.type field (page, youtube, gmail_thread, image)
- Quick instruction chips — Summarize, Extract tasks, Save, Analyze
- Keyboard shortcuts — Alt+1/2/3 for agent selection
- URL path routing in receiver — multiple agents via webhook path (e.g. /my-agent)
- ID-based filenames (20260401-a1b2c3d4.md)
- Test webhook button in settings
- Color presets (8 colors) replace native color picker

### Changed
- **UI redesign** — page card preview, "Sending to X" agent label, "Send" CTA, toggle switch, rounded corners, systematic spacing, refined dark mode (#1C1C1E)
- Settings: agent cards with icon actions, shortened URLs, inline delete confirmation, "Saved agents" label
- Settings opens in full tab (open_in_tab: true)
- Instruction field with example placeholder (was "comment")
- Receiver MAX_BODY raised to 20MB
- Cleaner tmux delivery: title, instruction, file paths only
- Screenshot saved as .jpg alongside .md
- Empty state for first-run with onboarding message
- Button states: Sending → ✓ Sent! → Retry

### Fixed
- Delete button not working in embedded popup (confirm() blocked by CSP)
- Screenshot stitching on HiDPI displays (actual PNG dimensions)
- Screenshot scroll position always restored (try/finally)
- YouTube brace parser handles braces inside JSON strings
- YouTube SPA stale data (videoId verification)
- Gmail expand guards prevent re-collapsing open messages
- Signed caption URLs stripped from payload (privacy)
- Comment newlines sanitized in receiver (tmux injection)
- Chrome Web Store /u/ URLs correctly restricted
- 15 additional fixes from 3 rounds of expert code review (~24 agents)

## 0.3.0 — 2026-03-29

### Added
- Multi-agent support: configure multiple webhook endpoints with names, emoji avatars, and colors
- Agent picker in popup with visual selection
- Agent CRUD in settings (add, edit, delete)
- Migration from single-webhook to multi-agent format
- Last selected agent remembered across sessions
- Gmail thread extraction with participant roles (initiator, responder, cc)
- Auto-expand collapsed Gmail messages before extraction
- Per-message Gmail permalink URLs
- Google Docs detection with actionable error message

## 0.2.0 — 2026-03-28

### Added
- Page metadata extraction (Open Graph, author, canonical, language, published_time)
- Dynamic script injection (chrome.scripting) — no more persistent content scripts
- Dark mode support
- Ctrl+Enter keyboard shortcut to send
- ARIA accessibility attributes
- Content cleaning (strip tabs, non-breaking spaces, collapse blank lines)
- User comment saved in markdown frontmatter
- word_count and saved_at fields in frontmatter

### Fixed
- YAML frontmatter: use yaml.dump for safe serialization
- tmux injection: use paste-buffer with bracketed paste
- Payload size limit (5MB max)
- Null value handling in receiver
- Button contrast for WCAG AA compliance
- Restricted URL guard (about:, file://, edge://, etc.)
- Double-click race condition

## 0.1.0 — 2026-03-28

### Added
- Chrome Extension (Manifest V3) with popup UI
- Page content extraction via Mozilla Readability.js
- Selected text support
- Single webhook URL configuration
- Webhook receiver (receiver.py) with markdown export
- tmux integration for agent delivery
- systemd user service
