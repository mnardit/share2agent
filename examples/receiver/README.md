# Share2Agent Receiver

A self-hosted webhook receiver for Share2Agent. Saves shared pages as Markdown files and delivers notifications to a tmux session (e.g., Claude Code).

## Requirements

- Python 3.10+
- PyYAML (`pip install pyyaml`)
- tmux (for notification delivery)

## Setup

```bash
# Clone the repo
git clone https://github.com/mnardit/share2agent.git
cd share2agent/examples/receiver

# Install dependency
pip install pyyaml

# Run
python3 -u receiver.py
```

The receiver starts on port **9876** by default.

## Configuration

Edit the constants at the top of `receiver.py`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 9876 | HTTP port to listen on |
| `PAGES_DIR` | `~/share2agent-pages` | Where to save .md files |
| `TMUX_TARGET` | `main:0` | tmux session:window for notifications |

## What It Does

1. Receives POST requests with Share2Agent's JSON payload
2. Saves page content as a Markdown file with YAML frontmatter (URL, title, metadata)
3. Sends a notification to your tmux session via paste-buffer:

```
Shared from browser: "Article Title"
https://example.com/article
Comment: summarize this
Content: /path/to/2026-03-28-1430-article-title.md
```

## Running as a Service

```bash
# Create systemd user service
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/share2agent-receiver.service << 'EOF'
[Unit]
Description=Share2Agent Webhook Receiver

[Service]
ExecStart=/usr/bin/python3 -u /path/to/receiver.py
Restart=on-failure

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now share2agent-receiver
```

## Webhook URL

Use this URL in Share2Agent extension settings:

```
http://<your-host>:9876
```

If using Tailscale: `http://<hostname>.tail<id>.ts.net:9876`
