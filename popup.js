// popup.js — Agent picker + inject content + POST to selected webhook

const RESTRICTED_PREFIXES = [
  'chrome://', 'chrome-extension://', 'chrome-search://',
  'edge://', 'devtools://', 'about:', 'view-source:', 'file://',
  'https://chrome.google.com/', 'https://chromewebstore.google.com'
];

let isSending = false;
let selectedAgent = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  let tab;
  try {
    tab = await getActiveTab();
  } catch {
    showStatus('Could not access the current tab.', 'error');
    document.getElementById('sendBtn').disabled = true;
    return;
  }

  // Page card
  document.getElementById('pageTitle').textContent = tab.title || 'Unknown page';
  try {
    document.getElementById('pageUrl').textContent = new URL(tab.url).hostname;
  } catch {
    document.getElementById('pageUrl').textContent = tab.url || '';
  }

  // Detect image page early
  try {
    const [imageCheck] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (document.contentType && document.contentType.startsWith('image/')) return 'image';
        if (document.contentType === 'application/pdf') return 'pdf';
        return null;
      }
    });
    const pageType = imageCheck?.result;
    if (pageType === 'image') {
      tab._isImage = true;
      document.getElementById('pageTitle').textContent = '📷 Image detected';
      document.getElementById('screenshotRow').style.display = 'none';
    } else if (pageType === 'pdf') {
      tab._isPdf = true;
      document.getElementById('pageTitle').textContent = '📄 PDF — text extraction not supported';
      document.getElementById('screenshotRow').style.display = '';
    }
  } catch { /* not critical */ }

  let agents, lastAgentId;
  try {
    ({ agents, lastAgentId } = await getAgents());
  } catch {
    showStatus('Could not load settings.', 'error');
    document.getElementById('sendBtn').disabled = true;
    return;
  }

  if (agents.length === 0) {
    document.getElementById('agentPicker').style.display = 'none';
    document.getElementById('noAgents').style.display = 'block';
    document.getElementById('sendBtn').disabled = true;
    document.getElementById('setupLink').addEventListener('click', () => {
      try { chrome.runtime.openOptionsPage(); } catch { showStatus('Please reopen the extension.', 'error'); }
    });
  } else {
    renderAgents(agents, lastAgentId);
  }

  document.getElementById('sendBtn').addEventListener('click', () => handleSend(tab));

  document.getElementById('comment').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.getElementById('sendBtn').click();
    }
  });

  document.getElementById('settingsLink').addEventListener('click', () => {
    try { chrome.runtime.openOptionsPage(); } catch { showStatus('Please reopen the extension.', 'error'); }
  });

  // Alt+1/2/3 for agent selection
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key >= '1' && e.key <= '9') {
      const chips = document.querySelectorAll('.agent-chip');
      const idx = parseInt(e.key) - 1;
      if (idx < chips.length) { e.preventDefault(); chips[idx].click(); }
    }
  });

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const el = document.getElementById('comment');
      el.value = chip.dataset.text;
      el.dispatchEvent(new Event('input'));
      el.focus();
    });
  });

  const commentEl = document.getElementById('comment');
  commentEl.addEventListener('input', () => {
    commentEl.style.height = 'auto';
    commentEl.style.height = Math.min(commentEl.scrollHeight, 120) + 'px';
    // Deselect chips if user manually edits
    const activeChip = document.querySelector('.chip.active');
    if (activeChip && commentEl.value !== activeChip.dataset.text) {
      activeChip.classList.remove('active');
    }
  });
  commentEl.focus();
}

function renderAgents(agents, lastAgentId) {
  const picker = document.getElementById('agentPicker');
  picker.innerHTML = '';

  agents.forEach(agent => {
    const chip = document.createElement('div');
    chip.className = 'agent-chip';
    chip.dataset.id = agent.id;

    const avatar = document.createElement('div');
    avatar.className = 'agent-avatar';
    avatar.style.backgroundColor = agent.color;
    avatar.textContent = agent.emoji;

    const name = document.createElement('div');
    name.className = 'agent-name';
    name.textContent = agent.name;

    chip.appendChild(avatar);
    chip.appendChild(name);
    picker.appendChild(chip);

    chip.addEventListener('click', () => selectAgent(agent));
  });

  const toSelect = agents.find(a => a.id === lastAgentId) || agents[0];
  selectAgent(toSelect);
}

function selectAgent(agent) {
  selectedAgent = agent;

  document.querySelectorAll('.agent-chip').forEach(chip => {
    chip.classList.toggle('selected', chip.dataset.id === agent.id);
  });

  document.getElementById('agentLabel').textContent = 'Sending to ' + agent.name;

  const sendBtn = document.getElementById('sendBtn');
  if (!isSending) {
    sendBtn.textContent = 'Send';
    sendBtn.className = 'btn-send';
    sendBtn.disabled = false;
  }
}

async function handleSend(tab) {
  if (isSending || !selectedAgent) return;
  isSending = true;
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  if (isRestrictedUrl(tab.url)) {
    showStatus('Cannot share this page (browser internal page).', 'error');
    resetBtn(sendBtn, true);
    return;
  }

  sendBtn.textContent = 'Sending...';
  sendBtn.className = 'btn-send sending';
  showStatus('', '');

  try {
    await setLastAgent(selectedAgent.id);

    const comment = document.getElementById('comment').value.trim();

    if (tab._isImage) {
      showStatus('Capturing image...', '');
      const [imgResult] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const img = document.querySelector('img');
          if (!img) return null;
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          return canvas.toDataURL('image/jpeg', 0.85);
        }
      });
      const imageData = imgResult?.result;
      if (!imageData) {
        showStatus('Could not capture image.', 'error');
        resetBtn(sendBtn, true);
        return;
      }
      const payload = {
        schema: 'share2agent/v1',
        url: tab.url,
        title: tab.title || 'image',
        content: '',
        comment,
        timestamp: new Date().toISOString(),
        meta: { type: 'image' },
        screenshot: imageData
      };
      const res = await fetch(selectedAgent.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
      });
      if (res.ok) {
        sendBtn.textContent = '✓ Sent!';
        sendBtn.className = 'btn-send success';
        showStatus('', '');
        setTimeout(() => window.close(), 1200);
      } else {
        showStatus('Webhook error: ' + res.status, 'error');
        resetBtn(sendBtn, true);
      }
      return;
    }

    // PDF — cannot extract text, offer screenshot only
    if (tab._isPdf) {
      showStatus('PDF cannot be extracted as text. Use screenshot.', 'error');
      resetBtn(sendBtn, true);
      return;
    }

    const isGmail = tab.url && tab.url.includes('mail.google.com');

    if (isGmail) {
      const expandResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['gmail-expand.js']
      });
      const r = expandResult?.[0]?.result;
      await new Promise(resolve => setTimeout(resolve, r && r.clicked > 0 ? 1500 : 500));
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js', 'lib/turndown.js', 'lib/turndown-plugin-gfm.js']
    });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });

    const response = results?.[0]?.result;
    if (!response) {
      showStatus('No response from page. Try reloading it.', 'error');
      resetBtn(sendBtn, true);
      return;
    }

    if (response.error) {
      showStatus(response.error, 'error');
      resetBtn(sendBtn, true);
      return;
    }

    if (response.selectedText) {
      document.getElementById('pageTitle').textContent = 'Selection from: ' + tab.title;
    }

    // YouTube — extract transcript from DOM (open transcript panel, read text)
    if (response.meta?.type === 'youtube' && !response.selectedText) {
      showStatus('Fetching transcript...', '');
      try {
        // Click "Show transcript" button if panel not already open
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Check if transcript panel is already open
            const panel = document.querySelector('ytd-transcript-renderer');
            if (panel) return;
            // Find and click the transcript button in the description/engagement area
            const btns = document.querySelectorAll('ytd-video-description-transcript-section-renderer button, button[aria-label*="transcript" i], button[aria-label*="Transcript" i]');
            for (const btn of btns) { btn.click(); return; }
            // Try the "..." menu → Show transcript
            const menuBtn = document.querySelector('#button-shape button[aria-label="More actions"], ytd-menu-renderer button');
            if (menuBtn) menuBtn.click();
          }
        });
        await sleep(1500);

        // Try to click "Show transcript" from menu if it appeared
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const items = document.querySelectorAll('tp-yt-paper-listbox ytd-menu-service-item-renderer, ytd-menu-popup-renderer tp-yt-paper-item');
            for (const item of items) {
              const text = item.textContent.trim().toLowerCase();
              // Match English + common i18n: "show transcript", "transkript anzeigen", "afficher la transcription", etc.
              if (text.includes('transcript') || text.includes('transkript') || text.includes('transcription') || text.includes('транскрипци')) {
                item.click(); return;
              }
            }
          }
        });
        await sleep(1000);

        // Read transcript from panel (support both legacy and 2026 YouTube DOM)
        const [trResult] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const lines = [];

            // New YouTube DOM (2026+)
            const newSegs = document.querySelectorAll('transcript-segment-view-model');
            if (newSegs.length > 0) {
              for (const seg of newSegs) {
                const ts = (seg.querySelector('.ytwTranscriptSegmentViewModelTimestamp') || seg.querySelector('[class*="imestamp"]'))?.textContent?.trim() || '';
                const text = (seg.querySelector('.yt-core-attributed-string') || seg.querySelector('[class*="egment"]'))?.textContent?.trim() || '';
                if (text) lines.push(ts ? `[${ts}] ${text}` : text);
              }
              if (lines.length > 0) return lines.join('\n');
            }

            // Legacy YouTube DOM
            const oldSegs = document.querySelectorAll('ytd-transcript-segment-renderer');
            if (oldSegs.length > 0) {
              for (const seg of oldSegs) {
                const ts = seg.querySelector('.segment-timestamp')?.textContent?.trim() || '';
                const text = seg.querySelector('.segment-text')?.textContent?.trim() || '';
                if (text) lines.push(ts ? `[${ts}] ${text}` : text);
              }
              if (lines.length > 0) return lines.join('\n');
            }

            // Fallback: grab all text from transcript panel
            const panel = document.querySelector('ytd-engagement-panel-section-list-renderer[target-id*="transcript"]');
            if (panel) {
              const text = panel.innerText?.trim();
              if (text && text.length > 50) return text;
            }

            return null;
          }
        });

        if (trResult?.result) {
          response.content = trResult.result;
          response.meta.has_transcript = true;
        }
      } catch { /* continue without transcript */ }
    }

    const payload = {
      schema: 'share2agent/v1',
      url: tab.url,
      title: tab.title || tab.url || 'untitled',
      content: response.selectedText || response.content,
      comment,
      timestamp: new Date().toISOString(),
      meta: (() => { const m = response.meta || {}; delete m._caption_url; return m; })()
    };

    // Full-page screenshot
    if (document.getElementById('includeScreenshot').checked) {
      showStatus('Capturing screenshot...', '');
      try {
        payload.screenshot = await captureFullPage(tab);
      } catch (e) {
        console.error('Screenshot failed:', e);
      }
    }

    const res = await fetch(selectedAgent.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (res.ok) {
      showStatus('Sent to ' + selectedAgent.name + '!', 'success');
      setTimeout(() => window.close(), 1200);
    } else {
      showStatus('Webhook error: ' + res.status, 'error');
      resetBtn(sendBtn, true);
    }
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Cannot access') || msg.includes('Receiving end')) {
      showStatus('Cannot read this page. Try reloading it.', 'error');
    } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      showStatus('Cannot reach webhook. Check URL in Settings.', 'error');
    } else if (err.name === 'TimeoutError' || err.name === 'AbortError' || msg.includes('signal timed out')) {
      showStatus('Webhook did not respond. Check the URL and that your endpoint is active.', 'error');
    } else {
      console.error('Share2Agent error:', err);
      showStatus('Something went wrong.', 'error');
    }
    resetBtn(sendBtn, true);
  }
}

function isRestrictedUrl(url) {
  if (!url) return true;
  return RESTRICTED_PREFIXES.some(p => url.startsWith(p));
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error('No active tab');
  return tab;
}

function showStatus(message, type) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = 'status' + (type ? ' ' + type : '');
}

function resetBtn(btn, isError) {
  isSending = false;
  btn.disabled = false;
  if (isError) {
    btn.textContent = 'Retry';
    btn.className = 'btn-send error';
  } else {
    btn.textContent = 'Send';
    btn.className = 'btn-send';
  }
}

async function captureFullPage(tab) {
  const tabId = tab.id;
  // Get page dimensions
  const [dimResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      devicePixelRatio: window.devicePixelRatio || 1
    })
  });
  const dim = dimResult.result;
  const { scrollHeight, clientHeight } = dim;
  if (clientHeight === 0) return null;
  const captures = [];
  const MAX_STEPS = 15;
  const steps = Math.min(Math.ceil(scrollHeight / clientHeight), MAX_STEPS);

  // Scroll + capture with scroll restore guarantee
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: () => window.scrollTo(0, 0) });
    await sleep(300);

    for (let i = 0; i < steps; i++) {
      const targetY = i * clientHeight;
      // Scroll and read back actual position (browser clamps at max scroll)
      const [scrollResult] = await chrome.scripting.executeScript({
        target: { tabId },
        func: (y) => { window.scrollTo(0, y); return window.scrollY; },
        args: [targetY]
      });
      await sleep(500);
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      captures.push({ dataUrl, actualY: scrollResult?.result ?? targetY });
    }
  } finally {
    // Always restore scroll position
    await chrome.scripting.executeScript({
      target: { tabId }, func: (x, y) => window.scrollTo(x, y), args: [dim.scrollX, dim.scrollY]
    }).catch(() => {});
  }

  if (captures.length === 0) return null;

  // Stitch captures using actual scroll positions to avoid overlap
  const firstBlob = await (await fetch(captures[0].dataUrl)).blob();
  const firstBmp = await createImageBitmap(firstBlob);
  const pngWidth = firstBmp.width;
  const pngHeight = firstBmp.height;
  const scale = pngHeight / clientHeight;
  const totalHeight = Math.min(scrollHeight, steps * clientHeight) * scale;
  const cappedHeight = Math.min(totalHeight, 32000); // Canvas size limit
  const canvas = new OffscreenCanvas(pngWidth, cappedHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) { firstBmp.close(); return null; }

  ctx.drawImage(firstBmp, 0, 0);
  firstBmp.close();

  for (let i = 1; i < captures.length; i++) {
    const blob = await (await fetch(captures[i].dataUrl)).blob();
    const bmp = await createImageBitmap(blob);
    // Use actual scroll position for correct placement (handles browser scroll clamping)
    const yOffset = captures[i].actualY * scale;
    const remaining = cappedHeight - yOffset;
    if (remaining > 0) {
      const drawH = Math.min(bmp.height, remaining);
      ctx.drawImage(bmp, 0, 0, bmp.width, drawH, 0, yOffset, pngWidth, drawH);
    }
    bmp.close();
  }

  const resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.5 });
  return await blobToBase64(resultBlob);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

