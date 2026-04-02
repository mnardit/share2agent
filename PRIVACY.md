# Privacy Policy — Share2Agent

**Last updated:** March 30, 2026

## What Share2Agent Does

Share2Agent is a Chrome extension that extracts the text content of a web page and sends it to a webhook URL that you configure. It is designed for users who want to share web pages with AI agents, automation platforms, or custom backends.

## Data Collection

Share2Agent does **not** collect, store, or transmit any data to third parties.

- **No analytics** — no tracking, no telemetry, no usage statistics
- **No external servers** — the extension does not contact any server other than the webhook URL you configure
- **No accounts** — no sign-up, no authentication, no user profiles

## Data Handling

When you click "Send", the extension extracts the following from the current page:

- Page URL
- Page title
- Page text content (extracted via Mozilla Readability.js, converted to Markdown via Turndown.js)
- Page metadata (Open Graph tags, meta description, author, language)
- Your optional comment
- **Optional full-page screenshot** (JPEG, only when you check "Include full-page screenshot"). The screenshot captures everything visible on the page, including any private content currently displayed.

This data is sent **only** to the webhook URL you have configured in the extension settings. The extension developer has no access to this data.

If you select text on the page before clicking Send, only the selected text is sent instead of the full page content.

### Gmail Threads

When used on Gmail, the extension additionally extracts:

- Sender and recipient **email addresses** and names for each message in the thread
- Participant roles (who started the conversation, who replied)
- Message timestamps and permalink URLs
- Full message body text for each message

To extract collapsed messages, the extension automatically expands them by clicking Gmail's UI elements before reading the content. This expansion is visible in your Gmail tab and reverts when you reload the page.

All Gmail data is sent only to your configured webhook — the same as any other page.

### YouTube Videos

When used on a YouTube video page, the extension additionally extracts:

- Video title, channel name, duration, and view count
- Video description text
- Transcript with timestamps (if available — the extension opens YouTube's transcript panel to read it)

No YouTube API keys or credentials are used. The transcript is read directly from the page.

## Data Storage

The extension stores only your settings (agent names, webhook URLs, display preferences) in Chrome's built-in `chrome.storage.sync`. This data stays in your browser and syncs across your Chrome devices if you are signed in to Chrome.

No page content is ever stored by the extension.

## Permissions

- **activeTab** — to read the content of the current page when you click the extension icon
- **scripting** — to inject the content extraction script into the current page
- **storage** — to save your webhook URLs and agent settings

These permissions are only used when you actively click the extension icon. The extension performs no background activity.

## Contact

For questions about this privacy policy, open an issue at [github.com/mnardit/share2agent](https://github.com/mnardit/share2agent).
