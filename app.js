const STORAGE_KEY = "npc-combat-manager:v1";

// Track which stat blocks are expanded (DOM-level state, not persisted)
const expandedStatBlocks = new Set();

const state = {
  baseline: [],
  active: [],
  meta: {
    round: 1,
    turnIndex: 0,
  },
};

const els = {
  list: document.getElementById("list"),
  roundLabel: document.getElementById("roundLabel"),
  turnLabel: document.getElementById("turnLabel"),
  addForm: document.getElementById("addForm"),
  nextTurnBtn: document.getElementById("nextTurnBtn"),
  prevTurnBtn: document.getElementById("prevTurnBtn"),
  newRoundBtn: document.getElementById("newRoundBtn"),
  exportBtn: document.getElementById("exportBtn"),
  importInput: document.getElementById("importInput"),
  restoreBaselineBtn: document.getElementById("restoreBaselineBtn"),
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderStatBlock(c) {
  const ab = (key) => `
    <div>
      <label>${key.toUpperCase()}</label>
      <input type="number" data-id="${c.id}" data-field="${key}.score" value="${c[key]?.score || 10}" style="width:40px">
      <div>Mod: ${(c[key]?.mod || 0) >= 0 ? '+' : ''}${c[key]?.mod || 0}</div>
      <input type="number" placeholder="save" data-id="${c.id}" data-field="${key}.save" value="${c[key]?.save || 0}" style="width:40px">
    </div>`;

  const commaField = (label, field) => `
    <label>${label}</label>
    <input type="text" data-id="${c.id}" data-field="${field}" value="${escapeHtml((c[field]||[]).join(', '))}" style="width:100%"><br>`;

  const textBlock = (label, field) => {
    const rows = (c[field]||[]).map((e,i) => `
      <div class="entry-row">
        <input type="text" placeholder="name" data-id="${c.id}" data-field="${field}[${i}].name" value="${escapeHtml(e.name||'')}" style="width:120px">
        <textarea data-id="${c.id}" data-field="${field}[${i}].text">${escapeHtml(e.text||'')}</textarea>
        <button type="button" data-id="${c.id}" data-action="remove-entry" data-field="${field}" data-index="${i}">✕</button>
      </div>`).join('');
    return `<h4>${label}</h4><div class="entry-list">${rows}</div><button type="button" data-id="${c.id}" data-action="add-entry" data-field="${field}">+ Add</button>`;
  };

  const slotGrid = Object.entries(c.spellcasting?.spellSlots || {}).map(([lvl,s],i) => `
    <div>
      <label>${i+1}</label>
      <button type="button" data-id="${c.id}" data-action="slot-use" data-level="${lvl}">-</button>
      <span>${s.used}/${s.total}</span>
      <button type="button" data-id="${c.id}" data-action="slot-restore" data-level="${lvl}">+</button>
    </div>`).join('');

  const resourceList = (label, field, resetAction) => {
    const rows = (c[field]||[]).map((r,i) => `
      <div class="entry-row">
        <span>${escapeHtml(r.name)}</span>
        <button type="button" data-id="${c.id}" data-action="res-use" data-field="${field}" data-index="${i}">-</button>
        <span>${r.used}/${r.max}</span>
        <button type="button" data-id="${c.id}" data-action="res-restore" data-field="${field}" data-index="${i}">+</button>
        <button type="button" data-id="${c.id}" data-action="remove-entry" data-field="${field}" data-index="${i}">✕</button>
      </div>`).join('');
    return `<h4>${label} <button type="button" data-id="${c.id}" data-action="${resetAction}">Reset</button></h4>
      <div class="entry-list">${rows}</div>
      <input type="text" placeholder="name" id="new-${field}-name-${c.id}">
      <input type="number" placeholder="max" id="new-${field}-max-${c.id}" style="width:50px">
      <button type="button" data-id="${c.id}" data-action="add-resource" data-field="${field}">+ Add</button>`;
  };

  return `
    <h4>Abilities</h4>
    <div class="ability-grid">${['str','dex','con','int','wis','cha'].map(ab).join('')}</div>

    <h4>Defenses</h4>
    ${commaField('Resistances','resistances')}
    ${commaField('Immunities','immunities')}
    ${commaField('Vulnerabilities','vulnerabilities')}
    ${commaField('Condition Immunities','conditionImmunities')}

    <h4>Utility</h4>
    <label>Passive Perception</label>
    <input type="number" data-id="${c.id}" data-field="passivePerception" value="${c.passivePerception || 10}" style="width:50px"><br>
    <label>Senses</label><input type="text" data-id="${c.id}" data-field="senses" value="${escapeHtml(c.senses || '')}" style="width:100%"><br>
    <label>Languages</label><input type="text" data-id="${c.id}" data-field="languages" value="${escapeHtml((c.languages||[]).join(', '))}" style="width:100%"><br>
    <label>Skills</label><input type="text" data-id="${c.id}" data-field="skills" value="${escapeHtml(c.skills || '')}" style="width:100%"><br>

    ${textBlock('Traits','traits')}
    ${textBlock('Actions','actions')}
    ${textBlock('Bonus Actions','bonusActions')}
    ${textBlock('Reactions','reactions')}
    <h4>Legendary Actions (pool: <input type="number" data-id="${c.id}" data-field="legendaryActionCount" value="${c.legendaryActionCount || 0}" style="width:40px">)</h4>
    ${(c.legendaryActions||[]).map((e,i)=>`
      <div class="entry-row">
        <input type="text" placeholder="name" data-id="${c.id}" data-field="legendaryActions[${i}].name" value="${escapeHtml(e.name||'')}"> 
        Cost:<input type="number" data-id="${c.id}" data-field="legendaryActions[${i}].cost" value="${e.cost||1}" style="width:35px">
        <textarea data-id="${c.id}" data-field="legendaryActions[${i}].text">${escapeHtml(e.text||'')}</textarea>
        <button type="button" data-id="${c.id}" data-action="remove-entry" data-field="legendaryActions" data-index="${i}">✕</button>
      </div>`).join('')}
    <button type="button" data-id="${c.id}" data-action="add-entry" data-field="legendaryActions">+ Add</button>

    <h4>Spellcasting</h4>
    Ability:<select data-id="${c.id}" data-field="spellcasting.spellcastingAbility">
      ${['none','int','wis','cha'].map(a=>`<option value="${a}"${c.spellcasting?.spellcastingAbility===a?' selected':''}>${a.toUpperCase()}</option>`).join('')}
    </select>
    DC:<input type="number" data-id="${c.id}" data-field="spellcasting.spellSaveDC" value="${c.spellcasting?.spellSaveDC || 0}" style="width:45px">
    Atk:<input type="number" data-id="${c.id}" data-field="spellcasting.spellAttackBonus" value="${c.spellcasting?.spellAttackBonus || 0}" style="width:45px"><br>
    <div class="slot-grid">${slotGrid}</div>
    
    <h4>Spells</h4>
    <div id="spell-list-${c.id}" class="entry-list">
      ${(c.spellcasting?.spells || []).map((s,i) => {
        const levelStr = s.level === 0 ? 'C' : s.level;
        return `<div class="entry-row">
          <button type="button" data-action="cast-spell" data-id="${c.id}" data-index="${i}" class="px-2 py-1 rounded bg-indigo-700 hover:bg-indigo-600 text-xs">[${levelStr}] ${escapeHtml(s.name)}</button>
          <button type="button" data-action="remove-spell" data-id="${c.id}" data-index="${i}" class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs">✕</button>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:4px;margin-bottom:4px;">
      <input type="text" placeholder="name" id="new-spell-name-${c.id}" style="flex:1;">
      <input type="number" placeholder="level" id="new-spell-level-${c.id}" min="0" max="9" value="0" style="width:50px;">
      <input type="text" placeholder="url" id="new-spell-url-${c.id}" style="flex:1;">
      <button type="button" data-action="add-spell" data-id="${c.id}" class="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs">+ Add</button>
    </div>

    ${resourceList('Short-Rest Uses','perRestUses','short-rest')}
    ${resourceList('Long-Rest Uses','perDayUses','long-rest')}

    <h4>Custom Counters</h4>
    ${(c.customCounters||[]).map((r,i)=>`
      <div class="entry-row">
        <input type="text" placeholder="name" data-id="${c.id}" data-field="customCounters[${i}].name" value="${escapeHtml(r.name)}">
        <button type="button" data-id="${c.id}" data-action="counter-dec" data-index="${i}">-</button>
        <span>${r.value}/${r.max}</span>
        <button type="button" data-id="${c.id}" data-action="counter-inc" data-index="${i}">+</button>
        <button type="button" data-id="${c.id}" data-action="remove-entry" data-field="customCounters" data-index="${i}">✕</button>
      </div>`).join('')}
    <input type="text" placeholder="name" id="new-counter-name-${c.id}">
    <input type="number" placeholder="max" id="new-counter-max-${c.id}" style="width:50px">
    <button type="button" data-id="${c.id}" data-action="add-counter">+ Add Counter</button>
  `;
}


function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.active) || !Array.isArray(parsed.baseline) || !parsed.meta) {
      return false;
    }

    state.active = parsed.active;
    state.baseline = parsed.baseline;
    state.meta = parsed.meta;
    return true;
  } catch {
    return false;
  }
}

async function loadBaselineFile() {
  const res = await fetch("./baseline.encounter.json");
  if (!res.ok) throw new Error("Failed to load baseline.encounter.json");
  return res.json();
}

function normalizeCombatants(items) {
  return items
    .map((item) => ({
      id: item.id || uid(),
      name: item.name || "Unknown",
      initiative: Number(item.initiative || 0),
      hp: {
        current: Number(item.hp?.current ?? item.hp?.max ?? 1),
        max: Number(item.hp?.max ?? 1),
      },
      tempHp: Number(item.tempHp || 0),
      conditions: Array.isArray(item.conditions) ? item.conditions : [],
      spellSlots: Array.isArray(item.spellSlots) ? item.spellSlots : [],
      abilities: Array.isArray(item.abilities) ? item.abilities : [],
      sourceUrl: item.sourceUrl || "",
      notes: item.notes || "",
      str: item.str || { score: 10, mod: 0, save: 0 },
      dex: item.dex || { score: 10, mod: 0, save: 0 },
      con: item.con || { score: 10, mod: 0, save: 0 },
      int: item.int || { score: 10, mod: 0, save: 0 },
      wis: item.wis || { score: 10, mod: 0, save: 0 },
      cha: item.cha || { score: 10, mod: 0, save: 0 },
      resistances: Array.isArray(item.resistances) ? item.resistances : [],
      immunities: Array.isArray(item.immunities) ? item.immunities : [],
      vulnerabilities: Array.isArray(item.vulnerabilities) ? item.vulnerabilities : [],
      conditionImmunities: Array.isArray(item.conditionImmunities) ? item.conditionImmunities : [],
      passivePerception: item.passivePerception || 10,
      senses: item.senses || "",
      languages: Array.isArray(item.languages) ? item.languages : [],
      skills: item.skills || "",
      traits: Array.isArray(item.traits) ? item.traits : [],
      actions: Array.isArray(item.actions) ? item.actions : [],
      bonusActions: Array.isArray(item.bonusActions) ? item.bonusActions : [],
      reactions: Array.isArray(item.reactions) ? item.reactions : [],
      legendaryActionCount: item.legendaryActionCount || 3,
      legendaryActions: Array.isArray(item.legendaryActions) ? item.legendaryActions : [],
      spellcasting: item.spellcasting || {
        spellcastingAbility: 'none',
        spellSaveDC: 0,
        spellAttackBonus: 0,
        cantrips: "",
        spellSlots: {},
        spells: []
      },
      perRestUses: Array.isArray(item.perRestUses) ? item.perRestUses : [],
      perDayUses: Array.isArray(item.perDayUses) ? item.perDayUses : [],
      customCounters: Array.isArray(item.customCounters) ? item.customCounters : []
    }))
    .sort((a, b) => b.initiative - a.initiative);
}

function resetToBaseline() {
  state.active = JSON.parse(JSON.stringify(state.baseline));
  state.meta.round = 1;
  state.meta.turnIndex = 0;
  save();
  render();
}

function render() {
  const active = state.active;
  const turn = active[state.meta.turnIndex];

  els.roundLabel.textContent = `Round: ${state.meta.round}`;
  els.turnLabel.textContent = turn ? `Current Turn: ${turn.name}` : "Current Turn: n/a";

  els.list.innerHTML = "";

  active.forEach((c, idx) => {
    const card = document.createElement("article");
    const isCurrent = idx === state.meta.turnIndex;

    card.className = `rounded-lg border p-4 ${isCurrent ? "border-indigo-500 bg-slate-900" : "border-slate-800 bg-slate-900"}`;
    card.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 class="font-semibold text-lg">${c.name}</h3>
          <p class="text-sm text-slate-400">Init ${c.initiative}</p>
          ${c.sourceUrl ? `<a class="text-sm text-blue-400 underline" href="${c.sourceUrl}" target="_blank" rel="noreferrer">Source</a>` : ""}
        </div>
        <div class="grid grid-cols-1 gap-2">
          <button data-action="remove" data-id="${c.id}" class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs">Remove</button>
        </div>
      </div>

      <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <label class="space-y-1">
          <span class="text-slate-400">HP: ${c.hp.current}${c.tempHp > 0 ? ` (+${c.tempHp} temp)` : ''}</span>
          <div class="flex gap-1 items-center">
            <input id="hp-input-${c.id}" type="number" value="1" placeholder="Amount" class="w-16 px-2 py-1 rounded bg-slate-800 border border-slate-700" />
            <button data-action="damage-custom" data-id="${c.id}" class="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-xs flex-1">Damage</button>
            <button data-action="heal-custom" data-id="${c.id}" class="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-xs flex-1">Heal</button>
            <button data-action="temp-hp" data-id="${c.id}" class="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-xs flex-1">Temp</button>
          </div>
        </label>

        <label class="space-y-1 md:col-span-2">
          <span class="text-slate-400">Conditions (comma separated)</span>
          <input data-action="set-conditions" data-id="${c.id}" type="text" value="${c.conditions.join(", ")}" class="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700" />
        </label>
      </div>

      <div class="mt-3 space-y-2 text-sm">
        <label class="space-y-1 block">
          <span class="text-slate-400">Spell Slots (format: L1 2/4, L2 1/3)</span>
          <input data-action="set-slots" data-id="${c.id}" type="text" value="${c.spellSlots.map((s) => `L${s.level} ${s.current}/${s.max}`).join(", ")}" class="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700" />
        </label>
        <label class="space-y-1 block">
          <span class="text-slate-400">Abilities (format: Legendary Resistance 1/3, Breath 0/1)</span>
          <input data-action="set-abilities" data-id="${c.id}" type="text" value="${c.abilities.map((a) => `${a.name} ${a.usesCurrent}/${a.usesMax}`).join(", ")}" class="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700" />
        </label>
      </div>

      <button type="button" class="toggle-stat-block mt-3 px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm" data-id="${c.id}">Stat Block ${expandedStatBlocks.has(c.id) ? '▾' : '▸'}</button>
      <div class="stat-block${expandedStatBlocks.has(c.id) ? ' open' : ''}" id="sb-${c.id}" style="color:#333;font-size:0.9em;">
        ${renderStatBlock(c)}
      </div>
    `;

    els.list.appendChild(card);
  });
}

function findCombatant(id) {
  const idx = state.active.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  return { idx, combatant: state.active[idx] };
}

function parseHp(raw) {
  const [curStr, maxStr] = raw.split("/").map((s) => s.trim());
  const current = Number(curStr);
  const max = Number(maxStr);
  if (!Number.isFinite(current) || !Number.isFinite(max) || max < 1) return null;
  return { current: Math.max(0, Math.min(current, max)), max };
}

function parseSlots(raw) {
  if (!raw.trim()) return [];

  return raw.split(",").map((chunk) => {
    const match = chunk.trim().match(/^L(\d+)\s+(\d+)\/(\d+)$/i);
    if (!match) throw new Error("Invalid slot format");
    return {
      level: Number(match[1]),
      current: Number(match[2]),
      max: Number(match[3]),
    };
  });
}

function parseAbilities(raw) {
  if (!raw.trim()) return [];

  return raw.split(",").map((chunk) => {
    const match = chunk.trim().match(/^(.*)\s+(\d+)\/(\d+)$/);
    if (!match) throw new Error("Invalid ability format");
    return {
      name: match[1].trim(),
      usesCurrent: Number(match[2]),
      usesMax: Number(match[3]),
    };
  });
}

function clampTurnIndex() {
  if (!state.active.length) {
    state.meta.turnIndex = 0;
    return;
  }

  state.meta.turnIndex = Math.max(0, Math.min(state.meta.turnIndex, state.active.length - 1));
}

function wireEvents() {
  els.addForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = new FormData(els.addForm);
    const name = String(form.get("name") || "").trim();
    const initiative = Number(form.get("initiative") || 0);
    const hpMax = Number(form.get("hpMax") || 1);
    const sourceUrl = String(form.get("sourceUrl") || "").trim();

    if (!name || !Number.isFinite(initiative) || !Number.isFinite(hpMax) || hpMax < 1) return;

    state.active.push({
      id: uid(),
      name,
      initiative,
      hp: { current: hpMax, max: hpMax },
      tempHp: 0,
      conditions: [],
      spellSlots: [],
      abilities: [],
      sourceUrl,
      notes: "",
      str: { score: 10, mod: 0, save: 0 },
      dex: { score: 10, mod: 0, save: 0 },
      con: { score: 10, mod: 0, save: 0 },
      int: { score: 10, mod: 0, save: 0 },
      wis: { score: 10, mod: 0, save: 0 },
      cha: { score: 10, mod: 0, save: 0 },
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      conditionImmunities: [],
      passivePerception: 10,
      senses: "",
      languages: [],
      skills: "",
      traits: [],
      actions: [],
      bonusActions: [],
      reactions: [],
      legendaryActionCount: 3,
      legendaryActions: [],
      spellcasting: {
        spellcastingAbility: 'none',
        spellSaveDC: 0,
        spellAttackBonus: 0,
        cantrips: "",
        spellSlots: {},
        spells: []
      },
      perRestUses: [],
      perDayUses: [],
      customCounters: []
    });

    state.active.sort((a, b) => b.initiative - a.initiative);
    clampTurnIndex();
    save();
    render();
    els.addForm.reset();
  });

  els.nextTurnBtn.addEventListener("click", () => {
    if (!state.active.length) return;
    state.meta.turnIndex = (state.meta.turnIndex + 1) % state.active.length;
    if (state.meta.turnIndex === 0) state.meta.round += 1;
    save();
    render();
  });

  els.prevTurnBtn.addEventListener("click", () => {
    if (!state.active.length) return;
    state.meta.turnIndex = (state.meta.turnIndex - 1 + state.active.length) % state.active.length;
    save();
    render();
  });

  els.newRoundBtn.addEventListener("click", () => {
    state.meta.round += 1;
    save();
    render();
  });

  els.restoreBaselineBtn.addEventListener("click", () => {
    resetToBaseline();
  });

  els.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "npc-combat-state.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  els.importInput.addEventListener("change", async (event) => {
    const input = event.target;
    if (!input.files || !input.files[0]) return;

    const text = await input.files[0].text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.active) || !Array.isArray(parsed.baseline) || !parsed.meta) {
      alert("Invalid state file");
      return;
    }

    state.active = normalizeCombatants(parsed.active);
    state.baseline = normalizeCombatants(parsed.baseline);
    state.meta = {
      round: Number(parsed.meta.round || 1),
      turnIndex: Number(parsed.meta.turnIndex || 0),
    };

    clampTurnIndex();
    save();
    render();
    input.value = "";
  });

  els.list.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    
    // Toggle stat block - only on the button itself
    if (target.classList.contains("toggle-stat-block")) {
      event.stopPropagation();
      const id = target.dataset.id;
      if (expandedStatBlocks.has(id)) {
        expandedStatBlocks.delete(id);
      } else {
        expandedStatBlocks.add(id);
      }
      render();
      return;
    }

    const action = target.dataset.action;
    const id = target.dataset.id;

    if (!action || !id) return;

    const found = findCombatant(id);
    if (!found) return;

    const c = found.combatant;

    // Handle stat block actions first
    if (action === "add-spell") {
      const nameInput = document.getElementById(`new-spell-name-${id}`);
      const levelInput = document.getElementById(`new-spell-level-${id}`);
      const urlInput = document.getElementById(`new-spell-url-${id}`);
      if (nameInput && levelInput && urlInput) {
        const name = nameInput.value.trim();
        const level = Number(levelInput.value);
        const url = urlInput.value.trim();
        if (name && level >= 0 && level <= 9) {
          if (!c.spellcasting.spells) c.spellcasting.spells = [];
          c.spellcasting.spells.push({name, level, url});
          nameInput.value = '';
          levelInput.value = '0';
          urlInput.value = '';
        }
      }
    } else if (action === "remove-spell") {
      const index = Number(target.dataset.index);
      if (c.spellcasting?.spells && Array.isArray(c.spellcasting.spells)) {
        c.spellcasting.spells.splice(index, 1);
      }
    } else if (action === "cast-spell") {
      const index = Number(target.dataset.index);
      const spell = c.spellcasting?.spells?.[index];
      if (spell) {
        showSpellModal(c, spell);
        return;
      }
    } else if (action === "add-entry") {
      const field = target.dataset.field;
      if (!c[field]) c[field] = [];
      c[field].push({name:'',text:''});
    } else if (action === "remove-entry") {
      const field = target.dataset.field;
      const index = Number(target.dataset.index);
      if (c[field] && Array.isArray(c[field])) {
        c[field].splice(index, 1);
      }
    } else if (action === "slot-use") {
      const level = target.dataset.level;
      if (c.spellcasting?.spellSlots[level]) {
        c.spellcasting.spellSlots[level].used = Math.max(0, c.spellcasting.spellSlots[level].used - 1);
      }
    } else if (action === "slot-restore") {
      const level = target.dataset.level;
      if (c.spellcasting?.spellSlots[level]) {
        c.spellcasting.spellSlots[level].used = Math.min(c.spellcasting.spellSlots[level].total, c.spellcasting.spellSlots[level].used + 1);
      }
    } else if (action === "res-use") {
      const field = target.dataset.field;
      const index = Number(target.dataset.index);
      if (c[field] && c[field][index]) {
        c[field][index].used = Math.max(0, c[field][index].used - 1);
      }
    } else if (action === "res-restore") {
      const field = target.dataset.field;
      const index = Number(target.dataset.index);
      if (c[field] && c[field][index]) {
        c[field][index].used = Math.min(c[field][index].max, c[field][index].used + 1);
      }
    } else if (action === "add-resource") {
      const field = target.dataset.field;
      const nameInput = document.getElementById(`new-${field}-name-${id}`);
      const maxInput = document.getElementById(`new-${field}-max-${id}`);
      if (nameInput && maxInput) {
        const name = nameInput.value.trim();
        const max = Number(maxInput.value);
        if (name && max > 0) {
          if (!c[field]) c[field] = [];
          c[field].push({name, max, used: 0});
          nameInput.value = '';
          maxInput.value = '';
        }
      }
    } else if (action === "counter-inc") {
      const index = Number(target.dataset.index);
      if (c.customCounters && c.customCounters[index]) {
        c.customCounters[index].value = Math.min(c.customCounters[index].max, c.customCounters[index].value + 1);
      }
    } else if (action === "counter-dec") {
      const index = Number(target.dataset.index);
      if (c.customCounters && c.customCounters[index]) {
        c.customCounters[index].value = Math.max(0, c.customCounters[index].value - 1);
      }
    } else if (action === "add-counter") {
      const nameInput = document.getElementById(`new-counter-name-${id}`);
      const maxInput = document.getElementById(`new-counter-max-${id}`);
      if (nameInput && maxInput) {
        const name = nameInput.value.trim();
        const max = Number(maxInput.value);
        if (name && max > 0) {
          if (!c.customCounters) c.customCounters = [];
          c.customCounters.push({name, max, value: 0});
          nameInput.value = '';
          maxInput.value = '';
        }
      }
    } else if (action === "short-rest") {
      if (c.perRestUses) {
        c.perRestUses.forEach(r => r.used = 0);
      }
    } else if (action === "long-rest") {
      if (c.perRestUses) {
        c.perRestUses.forEach(r => r.used = 0);
      }
      if (c.perDayUses) {
        c.perDayUses.forEach(r => r.used = 0);
      }
    }
    // Card-level actions (outside stat block)
    else if (target.closest(".stat-block")) {
      return;
    } else if (action === "damage-custom") {
      const input = document.getElementById(`hp-input-${id}`);
      const amount = Number(input?.value || 1);
      let remaining = amount;
      if (c.tempHp > 0) {
        const tempDamage = Math.min(c.tempHp, remaining);
        c.tempHp -= tempDamage;
        remaining -= tempDamage;
      }
      c.hp.current = Math.max(0, c.hp.current - remaining);
    } else if (action === "heal-custom") {
      const input = document.getElementById(`hp-input-${id}`);
      const amount = Number(input?.value || 1);
      c.hp.current = Math.min(c.hp.max, c.hp.current + amount);
    } else if (action === "temp-hp") {
      const input = document.getElementById(`hp-input-${id}`);
      const amount = Number(input?.value || 0);
      c.tempHp = Math.max(0, amount);
    } else if (action === "remove") {
      state.active.splice(found.idx, 1);
      clampTurnIndex();
    }

    save();
    render();
  });

  els.list.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    const field = target.dataset.field;

    const found = findCombatant(id);
    if (!found) return;

    const c = found.combatant;

    try {
      if (action === "set-hp") {
        const hp = parseHp(target.value);
        if (!hp) throw new Error("Invalid HP format");
        c.hp = hp;
      } else if (action === "set-conditions") {
        c.conditions = target.value
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      } else if (action === "set-slots") {
        c.spellSlots = parseSlots(target.value);
      } else if (action === "set-abilities") {
        c.abilities = parseAbilities(target.value);
      } else if (field) {
        // Handle data-field updates for stat block
        updateField(c, field, target.value);
      }

      save();
      render();
    } catch (error) {
      alert(error.message || "Invalid input");
      render();
    }
  });

  function updateField(obj, path, value) {
    const parts = path.match(/([^.\[\]]+)|\[(\d+)\]/g);
    if (!parts) return;

    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part.startsWith('[')) {
        const idx = Number(part.slice(1, -1));
        if (!Array.isArray(current)) return;
        current = current[idx];
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart.startsWith('[')) {
      const idx = Number(lastPart.slice(1, -1));
      if (!Array.isArray(current)) return;
      current[idx] = isNaN(value) ? value : Number(value);
    } else {
      // For comma-separated list fields
      if (['resistances', 'immunities', 'vulnerabilities', 'conditionImmunities', 'languages'].includes(lastPart)) {
        current[lastPart] = value.split(',').map(x => x.trim()).filter(Boolean);
      } else {
        current[lastPart] = isNaN(value) ? value : Number(value);
      }
    }
  }

  els.list.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const id = target.dataset.id;
    const field = target.dataset.field;
    if (!id || !field) return;

    const found = findCombatant(id);
    if (!found) return;

    try {
      updateField(found.combatant, field, target.value);
      save();
      render();
    } catch (error) {
      console.error("Error updating field:", error);
    }
  });

}

async function showSpellModal(combatant, spell) {
  let spellContent = "Loading spell details...";
  
  if (spell.url) {
    try {
      const res = await fetch(spell.url);
      if (res.ok) {
        spellContent = await res.text();
      } else {
        spellContent = `<a href="${escapeHtml(spell.url)}" target="_blank" rel="noreferrer">Click to view spell details</a>`;
      }
    } catch (err) {
      spellContent = `<a href="${escapeHtml(spell.url)}" target="_blank" rel="noreferrer">Click to view spell details (fetch failed)</a>`;
    }
  }

  const maxSpellLevel = spell.level === 0 ? 0 : 9;
  const spellLevelOptions = Array.from({length: maxSpellLevel - spell.level + 1}, (_, i) => spell.level + i)
    .map(lvl => `<option value="${lvl}"${lvl === spell.level ? ' selected' : ''}>${lvl === 0 ? 'Cantrip' : `Level ${lvl}`}</option>`)
    .join('');

  const modal = document.createElement('div');
  modal.id = 'spell-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = `
    <div style="background:#1e293b;border:1px solid #64748b;border-radius:8px;max-width:600px;max-height:80vh;overflow-y:auto;padding:20px;color:#e2e8f0;">
      <h2 style="margin-top:0;color:#fff;">${escapeHtml(spell.name)}</h2>
      
      <div style="background:#0f172a;padding:10px;border-radius:4px;margin:10px 0;max-height:300px;overflow-y:auto;border:1px solid #334155;">
        ${spellContent}
      </div>
      
      ${spell.level > 0 ? `
        <div style="margin:10px 0;">
          <label style="display:block;margin-bottom:5px;">Cast at level:</label>
          <select id="spell-level-select" style="padding:5px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:4px;">
            ${spellLevelOptions}
          </select>
        </div>
      ` : ''}
      
      <div style="display:flex;gap:10px;margin-top:15px;">
        <button id="spell-cast-btn" style="flex:1;padding:8px;background:#4f46e5;color:#fff;border:none;border-radius:4px;cursor:pointer;">Cast</button>
        <button id="spell-close-btn" style="flex:1;padding:8px;background:#64748b;color:#fff;border:none;border-radius:4px;cursor:pointer;">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const closeModal = () => {
    modal.remove();
  };
  
  document.getElementById('spell-close-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  document.getElementById('spell-cast-btn').addEventListener('click', () => {
    const levelSelect = document.getElementById('spell-level-select');
    const castLevel = levelSelect ? Number(levelSelect.value) : spell.level;
    
    if (castLevel > 0) {
      const slotKey = `level_${castLevel}`;
      if (combatant.spellcasting?.spellSlots[slotKey]) {
        if (combatant.spellcasting.spellSlots[slotKey].used < combatant.spellcasting.spellSlots[slotKey].total) {
          combatant.spellcasting.spellSlots[slotKey].used += 1;
        } else {
          alert(`No spell slots remaining at level ${castLevel}!`);
          return;
        }
      }
    }
    
    save();
    closeModal();
    render();
  });
}


async function bootstrap() {
  const loaded = load();

  if (!loaded) {
    let baselineRaw;
    try {
      baselineRaw = await loadBaselineFile();
    } catch {
      baselineRaw = [
        {
          id: "sample-goblin",
          name: "Sample Goblin",
          initiative: 12,
          hp: { current: 7, max: 7 },
          conditions: [],
          spellSlots: [],
          abilities: [],
          sourceUrl: "",
          notes: "Fallback baseline for local file:// usage.",
        },
      ];
    }
    state.baseline = normalizeCombatants(baselineRaw);
    state.active = JSON.parse(JSON.stringify(state.baseline));
    state.meta = { round: 1, turnIndex: 0 };
    save();
  }

  clampTurnIndex();
  wireEvents();
  render();
}

bootstrap().catch((error) => {
  console.error(error);
  alert("Failed to start app. Check console.");
});
