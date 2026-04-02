// options.js — Agent CRUD: add, edit, delete

let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const { agents } = await getAgents();
  renderAgentList(agents);

  // Color preset clicks
  document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      document.getElementById('color').value = dot.dataset.color;
    });
  });

  document.getElementById('agentForm').addEventListener('submit', handleSubmit);
  document.getElementById('cancelBtn').addEventListener('click', resetForm);
  document.getElementById('testBtn').addEventListener('click', testWebhook);

  // Show test button when URL has value
  document.getElementById('webhookUrl').addEventListener('input', (e) => {
    document.getElementById('testBtn').style.display = e.target.value.trim() ? '' : 'none';
  });
});

async function handleSubmit(e) {
  e.preventDefault();
  const status = document.getElementById('status');
  const name = document.getElementById('name').value.trim();
  const emoji = document.getElementById('emoji').value.trim() || '🤖';
  const color = document.getElementById('color').value;
  const webhookUrl = document.getElementById('webhookUrl').value.trim();

  // Validate name
  if (!name) {
    status.textContent = 'Please enter a name.';
    status.className = 'error';
    return;
  }

  // Validate webhook URL
  if (!webhookUrl) {
    status.textContent = 'Please enter a webhook URL.';
    status.className = 'error';
    return;
  }
  try {
    const parsed = new URL(webhookUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      status.textContent = 'URL must start with http:// or https://';
      status.className = 'error';
      return;
    }
  } catch {
    status.textContent = 'Invalid URL format.';
    status.className = 'error';
    return;
  }

  const { agents } = await getAgents();

  if (editingId) {
    const idx = agents.findIndex(a => a.id === editingId);
    if (idx !== -1) {
      agents[idx] = { ...agents[idx], name, emoji, color, webhookUrl };
    }
  } else {
    agents.push({ id: generateId(), name, emoji, color, webhookUrl });
  }

  try {
    await saveAgents(agents);
    status.textContent = editingId ? 'Saved!' : 'Added!';
    status.className = 'success';
    renderAgentList(agents);
    resetForm();
  } catch {
    status.textContent = 'Save failed. Storage may be full.';
    status.className = 'error';
  }
}

function renderAgentList(agents) {
  const container = document.getElementById('agentList');

  if (agents.length === 0) {
    container.innerHTML = '<div class="empty-list">No agents yet. Add one above.</div>';
    return;
  }

  container.innerHTML = agents.map(agent => `
    <div class="agent-item" data-id="${agent.id}">
      <div class="agent-avatar" style="background:${escapeHtml(agent.color)}">${escapeHtml(agent.emoji)}</div>
      <div class="agent-info">
        <div class="agent-info-name">${escapeHtml(agent.name)}</div>
        <div class="agent-info-url" title="${escapeHtml(agent.webhookUrl)}">${escapeHtml(shortenUrl(agent.webhookUrl))}</div>
      </div>
      <div class="agent-actions">
        <button class="btn-edit" title="Edit">&#9998;</button>
        <button class="btn-delete" title="Delete">&#128465;</button>
      </div>
    </div>
  `).join('');

  // Bind edit/delete buttons
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.agent-item').dataset.id;
      const agent = agents.find(a => a.id === id);
      if (agent) editAgent(agent);
    });
  });

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.agent-item');
      const id = item.dataset.id;
      const name = item.querySelector('.agent-info-name')?.textContent || 'this agent';

      // Inline confirm
      const actions = item.querySelector('.agent-actions');
      actions.innerHTML = `<span style="font-size:12px;color:#c62828">Delete?</span>
        <button class="btn-confirm-yes" style="font-size:12px;color:#c62828;font-weight:600;background:none;border:none;cursor:pointer">Yes</button>
        <button class="btn-confirm-no" style="font-size:12px;color:#767676;background:none;border:none;cursor:pointer">No</button>`;

      item.querySelector('.btn-confirm-no').addEventListener('click', () => renderAgentList(agents));

      item.querySelector('.btn-confirm-yes').addEventListener('click', async () => {
        const { agents: current } = await getAgents();
        const updated = current.filter(a => a.id !== id);
        try {
          await saveAgents(updated);
          renderAgentList(updated);
          if (editingId === id) resetForm();
        } catch {
          const status = document.getElementById('status');
          status.textContent = 'Delete failed. Storage error.';
          status.className = 'error';
        }
      });
    });
  });
}

function editAgent(agent) {
  document.getElementById('name').value = agent.name;
  document.getElementById('emoji').value = agent.emoji;
  document.getElementById('color').value = agent.color;
  document.querySelectorAll('.color-dot').forEach(d => {
    d.classList.toggle('selected', d.dataset.color === agent.color);
  });
  document.getElementById('webhookUrl').value = agent.webhookUrl;
  editingId = agent.id;
  document.getElementById('submitBtn').textContent = 'Save';
  document.getElementById('cancelBtn').style.display = '';
  document.getElementById('status').textContent = '';
}

function resetForm() {
  document.getElementById('agentForm').reset();
  document.getElementById('color').value = '#3578b9';
  document.querySelectorAll('.color-dot').forEach(d => {
    d.classList.toggle('selected', d.dataset.color === '#3578b9');
  });
  editingId = null;
  document.getElementById('submitBtn').textContent = 'Add Agent';
  document.getElementById('cancelBtn').style.display = 'none';
  document.getElementById('status').textContent = '';
}

async function testWebhook() {
  const url = document.getElementById('webhookUrl').value.trim();
  const status = document.getElementById('status');
  if (!url) { status.textContent = 'Enter a URL first.'; status.className = 'error'; return; }
  status.textContent = 'Testing...';
  status.className = '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema: 'share2agent/v1', test: true, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(5000)
    });
    status.textContent = res.ok ? '✓ Connection successful' : 'Webhook returned ' + res.status;
    status.className = res.ok ? 'success' : 'error';
  } catch {
    status.textContent = 'Could not reach webhook';
    status.className = 'error';
  }
}

function shortenUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.length > 25 ? u.hostname.slice(0, 12) + '...' + u.hostname.slice(-10) : u.hostname;
    return host + (u.pathname !== '/' ? u.pathname : '') + (u.port ? ':' + u.port : '');
  } catch { return url; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
