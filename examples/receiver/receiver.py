#!/usr/bin/env python3
"""Share2Agent webhook receiver. Saves pages as .md, injects message into tmux."""

import base64
import json
import os
import re
import secrets
import subprocess
import tempfile
import time
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

import yaml

PORT = int(os.environ.get('PORT', '9876'))
PAGES_DIR = Path(os.environ.get('PAGES_DIR', str(Path.home() / 'share2agent-pages')))
TMUX_TARGET = os.environ.get('TMUX_TARGET', 'main:0')
MAX_BODY = 20 * 1024 * 1024  # 20 MB (screenshots can be large)

# URL path → tmux target routing. Path "/" uses TMUX_TARGET env var.
# URL path → tmux target routing. Add your agents here.
# Example: '/my-agent': 'my-agent-session'
ROUTES = {}


def generate_id() -> str:
    """Short random ID: 8 hex chars."""
    return secrets.token_hex(4)


def clean_content(text: str) -> str:
    """Clean extracted content: strip noise, normalize whitespace."""
    text = text.replace('\xa0', ' ')
    lines = text.split('\n')
    lines = [line.strip() for line in lines]
    text = '\n'.join(lines)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    return text


def save_page(data: dict) -> Path:
    PAGES_DIR.mkdir(parents=True, exist_ok=True)

    title = str(data.get('title') or 'untitled').replace('\n', ' ').strip()
    now = datetime.now()
    file_id = generate_id()
    filename = f"{now.strftime('%Y%m%d')}-{file_id}.md"
    path = PAGES_DIR / filename

    # Build frontmatter
    def _clean(s: str) -> str:
        return s.replace('\n', ' ').replace('\r', '').strip()

    fm = {
        'url': _clean(str(data.get('url') or '')),
        'title': title,
        'timestamp': _clean(str(data.get('timestamp') or '')),
        'saved_at': now.isoformat(),
    }

    comment = str(data.get('comment') or '').strip()
    if comment:
        fm['comment'] = _clean(comment)

    meta = data.get('meta') if isinstance(data.get('meta'), dict) else {}
    for key, val in meta.items():
        safe_key = re.sub(r'[^\w-]', '_', str(key)).strip('_')
        cleaned_val = _clean(str(val or ''))
        if safe_key and cleaned_val:
            fm[safe_key] = cleaned_val

    raw_content = _sanitize(str(data.get('content') or ''))
    cleaned = clean_content(raw_content)

    fm['word_count'] = len(cleaned.split())

    # Save screenshot/image if present
    screenshot_path = None
    screenshot_data = data.get('screenshot', '')
    if screenshot_data and isinstance(screenshot_data, str):
        try:
            if ',' in screenshot_data:
                screenshot_data = screenshot_data.split(',', 1)[1]
            img_bytes = base64.b64decode(screenshot_data)
            screenshot_path = path.with_suffix('.jpg')
            screenshot_path.write_bytes(img_bytes)
            fm['screenshot'] = str(screenshot_path)
        except (ValueError, OSError) as e:
            print(f"[WARN] screenshot save failed: {e}")

    # Image-only page — save just the image, no markdown
    is_image = meta.get('type') == 'image'
    if is_image and screenshot_path:
        return screenshot_path, None

    fm_yaml = yaml.dump(fm, default_flow_style=False, allow_unicode=True, sort_keys=False).rstrip('\n')
    md = f"---\n{fm_yaml}\n---\n\n# {title}\n\n{cleaned}\n"
    path.write_text(md, encoding='utf-8')
    return path, screenshot_path


def _sanitize(text: str) -> str:
    """Remove control characters except newline and tab."""
    return re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)


def send_to_tmux(data: dict, md_path: Path, screenshot_path: Path | None = None,
                 target: str = TMUX_TARGET) -> bool:
    """Send notification to tmux using paste-buffer (bracketed paste)."""
    title = _sanitize(str(data.get('title') or 'untitled')).replace('\n', ' ').replace('\r', '')[:100]
    comment = _sanitize(str(data.get('comment') or '').strip()).replace('\n', ' ').replace('\r', '')[:500]

    lines = [f'Shared from browser: "{title}"']
    if comment:
        lines.append(comment)
    lines.append(str(md_path))
    if screenshot_path and screenshot_path.exists():
        lines.append(str(screenshot_path))
    message = '\n'.join(lines) + '\n'

    tmp = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(message)
            tmp = f.name
        r = subprocess.run(['tmux', 'load-buffer', tmp], check=False,
                           capture_output=True)
        if r.returncode != 0:
            return False
        r2 = subprocess.run(
            ['tmux', 'paste-buffer', '-t', target, '-d', '-p'],
            check=False, capture_output=True,
        )
        if r2.returncode != 0:
            return False
        time.sleep(1.0)
        subprocess.run(
            ['tmux', 'send-keys', '-t', target, 'Enter'],
            check=False,
        )
        return True
    except (FileNotFoundError, OSError):
        return False
    finally:
        if tmp:
            Path(tmp).unlink(missing_ok=True)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0))
        except ValueError:
            self._respond(400, 'Invalid Content-Length')
            return

        if length > MAX_BODY:
            self._respond(413, f'Payload too large (max {MAX_BODY // 1024 // 1024}MB)')
            return

        body = self.rfile.read(length)

        try:
            data = json.loads(body)
        except (json.JSONDecodeError, RecursionError, ValueError):
            self._respond(400, 'Invalid JSON')
            return

        if not isinstance(data, dict):
            self._respond(400, 'Expected JSON object')
            return

        try:
            md_path, screenshot_path = save_page(data)
        except OSError as e:
            print(f"[ERROR] save_page: {e}")
            self._respond(500, f'Storage error: {e}')
            return

        # Remove screenshot from data before further processing (already saved by save_page)
        data.pop('screenshot', None)

        # Save debug data to separate file
        debug_data = data.pop('debug', None)
        if debug_data:
            try:
                debug_path = md_path.with_suffix('.debug.json')
                debug_path.write_text(
                    json.dumps(debug_data, indent=2, ensure_ascii=False),
                    encoding='utf-8'
            )
                print(f"[DEBUG] saved → {debug_path.name}")
            except (TypeError, OSError) as e:
                print(f"[DEBUG] failed to save: {e}")

        tmux_target = ROUTES.get(self.path, TMUX_TARGET)
        delivered = send_to_tmux(data, md_path, screenshot_path, tmux_target)

        print(f"[{datetime.now().strftime('%H:%M:%S')}] {data.get('title', '?')} → {md_path.name} → {tmux_target}"
              f"{'' if delivered else ' (tmux failed)'}")

        self._respond(200, 'ok', {'file': str(md_path), 'delivered': delivered})

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _respond(self, code: int, message: str, extra: dict | None = None):
        if code != 200:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] {code} {message} from {self.client_address[0]}")
        body_dict = {'status': 'ok' if code == 200 else 'error', 'message': message}
        if extra:
            body_dict.update(extra)
        body = json.dumps(body_dict).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    HTTPServer.allow_reuse_address = True
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    server.timeout = 30
    print(f"Share2Agent receiver on :{PORT}")
    print(f"Pages → {PAGES_DIR}")
    print(f"tmux → {TMUX_TARGET}")
    print()
    server.serve_forever()
