// content.js — Extract page content and metadata (injected on demand)
(() => {
  const selectedText = window.getSelection().toString().trim();

  // Google Docs — canvas rendering, cannot extract content
  if (location.hostname === 'docs.google.com') {
    return {
      content: selectedText || '',
      selectedText,
      meta: {},
      error: selectedText ? '' : 'Google Docs content cannot be extracted. Select text manually and try again.',
    };
  }

  // Shared HTML→Markdown converter (used by both standard and Gmail extraction)
  function htmlToMarkdown(html) {
    try {
      const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', hr: '---' });
      if (typeof turndownPluginGfm !== 'undefined') {
        td.use(turndownPluginGfm.gfm);
      }
      // Strip images — agents need text and structure, not decorative icons/badges
      td.addRule('stripImages', {
        filter: 'img',
        replacement: () => ''
      });
      // Strip SVG elements
      td.addRule('stripSvg', {
        filter: 'svg',
        replacement: () => ''
      });
      let md = td.turndown(html);
      // Clean up empty link remnants: [](url) → remove, [![](url)](url) → remove
      md = md.replace(/!?\[!?\[\]?\([^)]*\)\]?\([^)]*\)/g, '');
      md = md.replace(/!?\[\]\([^)]*\)/g, '');
      // Collapse 3+ blank lines to 2
      md = md.replace(/\n{3,}/g, '\n\n');
      return md.trim();
    } catch {
      return '';
    }
  }

  // YouTube — extract video metadata and caption track URL
  if (location.hostname === 'www.youtube.com' && (location.pathname === '/watch' || location.pathname.startsWith('/shorts/'))) {
    return { ...extractYouTube(), selectedText };
  }

  // Gmail thread extraction (exclude compose, settings, etc.)
  if (location.hostname === 'mail.google.com' && !location.hash.includes('#compose') && !location.hash.includes('#settings')) {
    return { ...extractGmail(), selectedText };
  }

  // Standard page extraction
  return extractStandard();

  function extractStandard() {
    let content = '';
    try {
      const documentClone = document.cloneNode(true);
      const article = new Readability(documentClone).parse();
      if (article && article.content) {
        content = htmlToMarkdown(article.content) || article.textContent || '';
      } else {
        // Readability failed — convert body HTML directly
        content = htmlToMarkdown(document.body?.innerHTML || '') || (document.body?.innerText || '');
      }
    } catch (e) {
      content = htmlToMarkdown(document.body?.innerHTML || '') || (document.body?.innerText || '');
    }

    function getMeta(attr, value) {
      try {
        const el = document.querySelector('meta[' + attr + '="' + value + '"]');
        return el ? el.content : '';
      } catch { return ''; }
    }

    const meta = {
      description: getMeta('name', 'description'),
      og_title: getMeta('property', 'og:title'),
      og_description: getMeta('property', 'og:description'),
      og_image: getMeta('property', 'og:image'),
      og_type: getMeta('property', 'og:type'),
      site_name: getMeta('property', 'og:site_name'),
      author: getMeta('name', 'author'),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      language: document.documentElement.lang || '',
      published_time: getMeta('property', 'article:published_time'),
    };

    meta.type = 'page';
    return { content, selectedText, meta };
  }

  function extractGmail() {
    const messages = [];
    const participants = {};

    // Thread subject — try h2.hP first (thread header), then page title
    const subjectEl = document.querySelector('h2.hP');
    const titleMatch = document.title.replace(/ - Gmail$/, '').replace(/ - [^-]+$/, '').trim();
    const subject = (subjectEl ? subjectEl.textContent.trim() : '') || titleMatch || document.title;

    // Find all messages in the thread
    // Strategy: walk up from div.adn (expanded message) to find the thread
    // container that holds all .gs elements (both collapsed and expanded)
    let msgEls = [];

    const expandedMsg = document.querySelector('div.adn');
    if (expandedMsg) {
      // Walk up the DOM to find the container with the most .gs children
      let container = expandedMsg.parentElement;
      let best = null;
      let bestCount = 0;
      for (let i = 0; i < 10 && container; i++) {
        const gsCount = container.querySelectorAll('.gs').length;
        if (gsCount > bestCount) {
          bestCount = gsCount;
          best = container;
        }
        container = container.parentElement;
      }
      if (best && bestCount > 0) {
        msgEls = [...best.querySelectorAll(':scope > .gs, .gs')];
        // Dedupe — .gs can be nested, keep only top-level unique ones
        const seen = new Set();
        msgEls = msgEls.filter(el => {
          if (seen.has(el)) return false;
          seen.add(el);
          // Skip if this .gs is inside another .gs we already have
          let parent = el.parentElement;
          while (parent && parent !== best) {
            if (parent.classList.contains('gs') && seen.has(parent)) return false;
            parent = parent.parentElement;
          }
          return true;
        });
      }
    }

    // Fallback to data-message-id
    if (msgEls.length === 0) {
      msgEls = [...document.querySelectorAll('[data-message-id]')];
    }

    if (msgEls.length === 0) {
      const main = document.querySelector('[role="main"]');
      const text = main ? main.innerText : document.body.innerText;
      if (text.trim().length < 50) {
        return {
          content: '',
          meta: { type: 'gmail_list', subject },
          error: 'Open a conversation to share it.',
        };
      }
      return {
        content: text,
        meta: { type: 'gmail_thread', subject },
      };
    }

    // Extract thread permalink with correct account index
    const accountIdx = location.pathname.match(/\/mail\/u\/(\d+)\//)?.[1] || '0';
    const gmailBase = 'https://mail.google.com/mail/u/' + accountIdx + '/#inbox/';
    const firstExpanded = document.querySelector('[data-message-id]');
    const firstMsgId = firstExpanded ? firstExpanded.getAttribute('data-message-id') : '';
    const gmailUrl = firstMsgId ? gmailBase + firstMsgId : location.href;

    msgEls.forEach((msg, idx) => {
      const entry = { index: idx + 1 };

      // Message ID for permalink (only expanded messages have this)
      const msgIdEl = msg.querySelector('[data-message-id]') || msg.closest('[data-message-id]');
      const msgId = msg.getAttribute('data-message-id')
        || (msgIdEl ? msgIdEl.getAttribute('data-message-id') : '');
      if (msgId) {
        entry.message_url = gmailBase + msgId;
      }

      // Sender name and email
      const senderEl = msg.querySelector('[email]');
      if (senderEl) {
        entry.from_name = senderEl.getAttribute('name') || senderEl.textContent.trim();
        entry.from_email = senderEl.getAttribute('email') || '';
      }

      // Recipients
      const allEmailEls = msg.querySelectorAll('[email]');
      const recipients = [];
      allEmailEls.forEach(el => {
        const email = el.getAttribute('email') || '';
        const name = el.getAttribute('name') || el.textContent.trim();
        if (email && email !== (entry.from_email || '')) {
          recipients.push({ name, email });
        }
      });
      if (recipients.length > 0) {
        entry.to = recipients;
      }

      // Date
      const dateEl = msg.querySelector('[title][tabindex]')
        || msg.querySelector('.g3')
        || msg.querySelector('span[title]');
      if (dateEl) {
        entry.date = dateEl.getAttribute('title') || dateEl.textContent.trim();
      }

      // Message body — expanded messages have .a3s, collapsed have snippet text
      const bodyEl = msg.querySelector('.a3s')
        || msg.querySelector('.ii.gt')
        || msg.querySelector('[dir]');
      if (bodyEl) {
        const bodyClone = bodyEl.cloneNode(true);
        bodyClone.querySelectorAll('.gmail_quote, .gmail_signature').forEach(el => el.remove());
        entry.body = (htmlToMarkdown(bodyClone.innerHTML) || bodyClone.innerText).trim();
      } else {
        // Collapsed message — get whatever text is there (snippet)
        const clone = msg.cloneNode(true);
        clone.querySelectorAll('button, [role="button"], img').forEach(el => el.remove());
        const text = clone.innerText.trim();
        entry.body = text || '(collapsed message)';
        entry.collapsed = true;
      }

      // Track participants
      if (entry.from_email) {
        if (!participants[entry.from_email]) {
          participants[entry.from_email] = {
            name: entry.from_name || '',
            email: entry.from_email,
            message_count: 0,
          };
        }
        participants[entry.from_email].message_count++;

        // First message sender = initiator
        if (idx === 0) {
          participants[entry.from_email].role = 'initiator';
        } else if (!participants[entry.from_email].role) {
          participants[entry.from_email].role = 'responder';
        }
      }

      messages.push(entry);
    });

    // Mark CC'd participants (appeared in "to" but never sent a message)
    messages.forEach(msg => {
      if (msg.to) {
        msg.to.forEach(r => {
          if (!participants[r.email]) {
            participants[r.email] = {
              name: r.name,
              email: r.email,
              message_count: 0,
              role: 'cc',
            };
          }
        });
      }
    });

    // Format as readable thread
    const lines = [`Subject: ${subject}`, ''];

    // Participant summary
    lines.push('Participants:');
    Object.values(participants).forEach(p => {
      const role = p.role || 'participant';
      lines.push(`  - ${p.name} <${p.email}> (${role}, ${p.message_count} messages)`);
    });
    lines.push('');

    // Messages
    messages.forEach(msg => {
      lines.push(`--- Message ${msg.index} ---`);
      if (msg.from_name || msg.from_email) {
        lines.push(`From: ${msg.from_name || ''} <${msg.from_email || ''}>`);
      }
      if (msg.to && msg.to.length > 0) {
        lines.push(`To: ${msg.to.map(r => `${r.name} <${r.email}>`).join(', ')}`);
      }
      if (msg.date) lines.push(`Date: ${msg.date}`);
      if (msg.message_url) lines.push(`URL: ${msg.message_url}`);
      lines.push('');
      lines.push(msg.body || '(empty)');
      lines.push('');
    });

    return {
      content: lines.join('\n'),
      meta: {
        type: 'gmail_thread',
        subject,
        gmail_url: gmailUrl,
        message_count: String(messages.length),
        participant_count: String(Object.keys(participants).length),
        participants: JSON.stringify(Object.values(participants)),
      },
    };
  }

  function extractYouTube() {
    // Search script tags for player data (no innerHTML serialization of entire page)
    let playerResponse = null;

    // Find ytInitialPlayerResponse — search only script tags for performance
    const scripts = document.querySelectorAll('script:not([src])');
    let prText = '';
    for (const s of scripts) {
      if (s.textContent.includes('ytInitialPlayerResponse')) { prText = s.textContent; break; }
    }
    const prIdx = prText.indexOf('ytInitialPlayerResponse');
    if (prIdx !== -1) {
      const braceStart = prText.indexOf('{', prIdx);
      if (braceStart !== -1) {
        // String-aware brace balancer (handles braces inside JSON string values)
        let depth = 0, inStr = false, esc = false;
        let i = braceStart;
        for (; i < prText.length && i < braceStart + 500000; i++) {
          const c = prText[i];
          if (esc) { esc = false; continue; }
          if (c === '\\' && inStr) { esc = true; continue; }
          if (c === '"') { inStr = !inStr; continue; }
          if (inStr) continue;
          if (c === '{') depth++;
          else if (c === '}') { if (--depth === 0) break; }
        }
        if (depth === 0) {
          try { playerResponse = JSON.parse(prText.slice(braceStart, i + 1)); } catch { /* ignore */ }
        }
      }
    }

    // Video details from DOM (always available)
    const videoId = new URLSearchParams(location.search).get('v')
      || (location.pathname.match(/\/shorts\/([^/?]+)/) || [])[1]
      || '';

    // Verify playerResponse matches current video (SPA navigation can leave stale data)
    if (playerResponse?.videoDetails?.videoId && playerResponse.videoDetails.videoId !== videoId) {
      playerResponse = null;
    }
    const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.title');
    const channelEl = document.querySelector('#channel-name a, ytd-channel-name a');
    const descEl = document.querySelector('#description-inner, ytd-text-inline-expander');
    const viewsEl = document.querySelector('#info-strings yt-formatted-string, .view-count');

    const title = titleEl?.textContent?.trim() || document.title.replace(' - YouTube', '');
    const channel = channelEl?.textContent?.trim() || '';
    const description = descEl?.innerText?.trim() || '';
    const views = viewsEl?.textContent?.trim() || '';

    // Caption track URL
    let captionUrl = '';
    let captionLang = '';
    if (playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
      const tracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
      const manual = tracks.find(t => t.kind !== 'asr');
      const track = manual || tracks[0];
      if (track) {
        captionUrl = track.baseUrl || '';
        captionLang = track.languageCode || '';
      }
    }
    // Fallback: find caption URL directly in page HTML
    if (!captionUrl) {
      const urlMatch = prText.match(/"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"/);
      if (urlMatch) {
        captionUrl = urlMatch[1].replace(/\\u0026/g, '&');
        const langMatch = captionUrl.match(/[&?]lang=([^&]+)/);
        if (langMatch) captionLang = langMatch[1];
      }
    }

    // Duration
    let duration = '';
    if (playerResponse?.videoDetails?.lengthSeconds) {
      const secs = parseInt(playerResponse.videoDetails.lengthSeconds, 10);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      duration = h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
    }

    const meta = {
      type: 'youtube',
      video_id: videoId,
      channel,
      duration,
      views,
    };

    if (captionUrl) {
      meta._caption_url = captionUrl; // internal use only, stripped before sending
      meta.caption_lang = captionLang;
    }

    return {
      content: description,
      meta,
    };
  }
})();
