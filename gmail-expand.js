// gmail-expand.js — Expand all collapsed messages in a Gmail thread
(() => {
  if (location.hostname !== 'mail.google.com') return { expanded: false };

  let clicked = 0;

  // 1. Click "N messages" collapsed stubs (.kQ) — guard against re-collapsing
  document.querySelectorAll('.kQ').forEach(el => {
    if (!el.dataset.s2aExpanded) {
      el.click();
      el.dataset.s2aExpanded = '1';
      clicked++;
    }
  });

  // 2. Click compact message headers to expand individual collapsed messages
  // Only click if the message is actually collapsed (no .adn class on parent .gs)
  document.querySelectorAll('.kv').forEach(el => {
    const gs = el.closest('.gs');
    if (gs && !gs.classList.contains('adn')) {
      el.click();
      clicked++;
    }
  });

  // 3. Click "show trimmed content" buttons (three dots) — guard to prevent toggle-back
  document.querySelectorAll('.ajR').forEach(el => {
    if (!el.dataset.s2aExpanded) {
      el.click();
      el.dataset.s2aExpanded = '1';
      clicked++;
    }
  });

  return {
    expanded: true,
    clicked,
    gs: document.querySelectorAll('.gs').length,
    msg: document.querySelectorAll('[data-message-id]').length,
  };
})();
