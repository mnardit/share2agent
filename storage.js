// storage.js — Shared agent data layer for popup.js and options.js

/**
 * Generate a random 6-character hex string for agent IDs.
 */
function generateId() {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Load agents and lastAgentId from chrome.storage.sync.
 * Migrates legacy single webhookUrl to agents array on first load.
 * @returns {Promise<{agents: Array, lastAgentId: string}>}
 */
async function getAgents() {
  const data = await chrome.storage.sync.get(['agents', 'lastAgentId', 'webhookUrl']);

  // Migration: convert old single webhookUrl to agents array
  if (!data.agents && data.webhookUrl) {
    const agent = {
      id: generateId(),
      name: 'Agent',
      emoji: '🤖',
      color: '#3578b9',
      webhookUrl: data.webhookUrl
    };
    await chrome.storage.sync.set({ agents: [agent], lastAgentId: agent.id });
    try { await chrome.storage.sync.remove('webhookUrl'); } catch { /* non-fatal */ }
    return { agents: [agent], lastAgentId: agent.id };
  }

  return {
    agents: Array.isArray(data.agents) ? data.agents : [],
    lastAgentId: data.lastAgentId || ''
  };
}

/**
 * Save agents array to chrome.storage.sync.
 * @param {Array} agents
 */
async function saveAgents(agents) {
  await chrome.storage.sync.set({ agents });
}

/**
 * Save the last selected agent ID to chrome.storage.sync.
 * @param {string} id
 */
async function setLastAgent(id) {
  await chrome.storage.sync.set({ lastAgentId: id });
}
