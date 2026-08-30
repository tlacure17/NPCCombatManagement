const STORAGE_KEY = "npc-combat-manager:v1";

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
    <label>Cantrips</label><textarea data-id="${c.id}" data-field="spellcasting.cantrips">${escapeHtml(c.spellcasting?.cantrips || '')}</textarea><br>

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
        spellSlots: {}
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
        <div class="grid grid-cols-2 gap-2">
          <button data-action="damage" data-id="${c.id}" class="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-xs">-1 HP</button>
          <button data-action="heal" data-id="${c.id}" class="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-xs">+1 HP</button>
          <button data-action="remove" data-id="${c.id}" class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs col-span-2">Remove</button>
        </div>
      </div>

      <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <label class="space-y-1">
          <span class="text-slate-400">HP</span>
          <input data-action="set-hp" data-id="${c.id}" type="text" value="${c.hp.current}/${c.hp.max}" class="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700" />
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

      <button type="button" class="toggle-stat-block mt-3 px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm" data-id="${c.id}">Stat Block ▸</button>
      <div class="stat-block" id="sb-${c.id}" style="color:#333;font-size:0.9em;">
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
        spellSlots: {}
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
    const action = target.dataset.action;
    const id = target.dataset.id;

    // Toggle stat block
    if (target.classList.contains("toggle-stat-block")) {
      const statBlock = document.getElementById(`sb-${id}`);
      if (statBlock) {
        statBlock.classList.toggle("open");
        target.textContent = statBlock.classList.contains("open") ? "Stat Block ▾" : "Stat Block ▸";
      }
      return;
    }

    if (!action || !id) return;

    const found = findCombatant(id);
    if (!found) return;

    const c = found.combatant;

    if (action === "damage") {
      c.hp.current = Math.max(0, c.hp.current - 1);
    } else if (action === "heal") {
      c.hp.current = Math.min(c.hp.max, c.hp.current + 1);
    } else if (action === "remove") {
      state.active.splice(found.idx, 1);
      clampTurnIndex();
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

  els.list.addEventListener("input", (event) => {
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
