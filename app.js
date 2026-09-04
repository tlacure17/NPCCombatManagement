const STORAGE_KEY = "npc-combat-manager:v1";
const SCHEMA_VERSION = 3;

const state = {
  schemaVersion: SCHEMA_VERSION,
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

function parseSpellText(raw) {
  if (!raw || !raw.trim()) {
    return {
      level: "",
      castingTime: "",
      range: "",
      components: "",
      duration: "",
      school: "",
      attackSave: "",
      damageEffect: "",
      description: ""
    };
  }

  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const knownLabels = ['level', 'casting time', 'range/area', 'components', 'duration', 'school', 'attack/save', 'damage/effect'];
  
  const result = {
    level: "",
    castingTime: "",
    range: "",
    components: "",
    duration: "",
    school: "",
    attackSave: "",
    damageEffect: "",
    description: ""
  };

  let i = 0;
  let descriptionStart = -1;

  while (i < lines.length) {
    const line = lines[i].toLowerCase();
    let found = false;

    for (const label of knownLabels) {
      if (line === label) {
        const value = lines[i + 1] || "";
        if (label === 'level') result.level = value;
        else if (label === 'casting time') result.castingTime = value;
        else if (label === 'range/area') result.range = value;
        else if (label === 'components') result.components = value;
        else if (label === 'duration') result.duration = value;
        else if (label === 'school') result.school = value;
        else if (label === 'attack/save') result.attackSave = value;
        else if (label === 'damage/effect') result.damageEffect = value;
        i += 2;
        found = true;
        break;
      }
    }

    if (!found) {
      descriptionStart = i;
      break;
    }
  }

  if (descriptionStart >= 0) {
    result.description = lines.slice(descriptionStart).join('\n');
  }

  return result;
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

    // Handle schema migration: if no schemaVersion, treat as v1 and migrate
    const version = parsed.schemaVersion || 1;
    
    // Migrate from v1 to v2: normalize spell slots to canonical format in spellcasting
    if (version < 2) {
      parsed.active = parsed.active.map(c => {
        if (c.spellcasting && !c.spellcasting.spellSlots) {
          c.spellcasting.spellSlots = {};
        }
        if (!c.spellcasting) {
          c.spellcasting = { spellSlots: {} };
        }
        // Migrate old spellSlots from root to canonical format in spellcasting
        if (c.spellSlots && !c.spellcasting.spellSlots || Object.keys(c.spellcasting.spellSlots || {}).length === 0) {
          c.spellcasting.spellSlots = normalizeSpellSlots(c.spellSlots);
        }
        delete c.spellSlots; // Remove old slot format from root
        return c;
      });
      
      parsed.baseline = parsed.baseline.map(c => {
        if (c.spellcasting && !c.spellcasting.spellSlots) {
          c.spellcasting.spellSlots = {};
        }
        if (!c.spellcasting) {
          c.spellcasting = { spellSlots: {} };
        }
        if (c.spellSlots && !c.spellcasting.spellSlots || Object.keys(c.spellcasting.spellSlots || {}).length === 0) {
          c.spellcasting.spellSlots = normalizeSpellSlots(c.spellSlots);
        }
        delete c.spellSlots;
        return c;
      });
    }

    state.schemaVersion = SCHEMA_VERSION;
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
      spellcasting: (() => {
        const sc = item.spellcasting || {
          spellcastingAbility: 'none',
          spellSaveDC: 0,
          spellAttackBonus: 0,
          cantrips: "",
          spellSlots: {},
          spells: [],
          innateAbility: 'none',
          innateAttackBonus: 0,
          innateSaveDC: 0
        };
        // Normalize spell slots to canonical format
        if (!sc.spellSlots || typeof sc.spellSlots !== 'object' || Array.isArray(sc.spellSlots)) {
          sc.spellSlots = normalizeSpellSlots(sc.spellSlots);
        } else {
          sc.spellSlots = normalizeSpellSlots(sc.spellSlots);
        }
        // Migrate old url-based spells to rawText-based
        if (Array.isArray(sc.spells)) {
          sc.spells = sc.spells.map(s => ({
            name: s.name || "",
            level: Number(s.level) || 0,
            rawText: s.rawText || "",
            atWill: Boolean(s.atWill),
            concentration: Boolean(s.concentration),
            url: s.url || ""
          }));
        }
        // Ensure innate fields exist
        if (!sc.innateAbility) sc.innateAbility = 'none';
        if (!sc.innateAttackBonus) sc.innateAttackBonus = 0;
        if (!sc.innateSaveDC) sc.innateSaveDC = 0;
        return sc;
      })(),
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

    const slotGrid = Object.entries(c.spellcasting?.spellSlots || {}).map(([lvl,s],i) => `
      <div>
        <label>Lvl ${i+1}</label>
        <div class="slot-display">${s.used}/${s.total}</div>
        <div style="display:flex;gap:1px;">
          <button type="button" data-id="${c.id}" data-action="slot-use" data-level="${lvl}" title="Use slot">−</button>
          <button type="button" data-id="${c.id}" data-action="slot-restore" data-level="${lvl}" title="Restore slot">+</button>
        </div>
      </div>`).join('');

    card.className = `rounded-lg border p-4 ${isCurrent ? "border-indigo-500 bg-slate-900" : "border-slate-800 bg-slate-900"}`;
    card.innerHTML = `
      <!-- Top bar -->
      <div class="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <h3 class="font-semibold text-lg flex-shrink-0">${c.name}</h3>
        <label class="text-slate-400" style="display:flex;align-items:center;gap:4px;">Init<input type="number" data-id="${c.id}" data-field="initiative" value="${c.initiative}" style="width:64px;padding:2px 6px;border-radius:3px;background:#1e293b;border:1px solid #475569;color:#fff;"></label>
        <span class="text-slate-300 font-mono">HP: ${c.hp.current}/${c.hp.max}${c.tempHp > 0 ? ` (+${c.tempHp})` : ''}</span>
        <div class="flex gap-1 items-center">
          <input id="hp-input-${c.id}" type="number" value="1" placeholder="Amt" class="w-12 px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs" />
          <button data-action="damage-custom" data-id="${c.id}" class="px-1.5 py-0.5 rounded bg-rose-700 hover:bg-rose-600 text-xs">Dmg</button>
          <button data-action="heal-custom" data-id="${c.id}" class="px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-xs">Heal</button>
          <button data-action="temp-hp" data-id="${c.id}" class="px-1.5 py-0.5 rounded bg-blue-700 hover:bg-blue-600 text-xs">Temp</button>
        </div>
        <input data-action="set-conditions" data-id="${c.id}" type="text" placeholder="Conditions" value="${c.conditions.join(", ")}" class="flex-1 min-w-48 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-xs" />
        ${isCurrent ? '<span class="text-indigo-400 font-bold">TURN</span>' : ''}
        <button data-action="remove" data-id="${c.id}" class="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-xs">Remove</button>
      </div>

      <!-- 3-column stat block grid -->
      <div class="stat-block-grid">
        <!-- Column 1: Abilities & Core Stats -->
        <div class="stat-column" style="font-size:0.9em;">
          <h4>Abilities</h4>
          <div class="ability-grid">
            ${['str','dex','con','int','wis','cha'].map(k => `
              <div>
                <label>${k.toUpperCase()}</label>
                <input type="number" data-id="${c.id}" data-field="${k}.score" value="${c[k]?.score || 10}" style="width:100%;box-sizing:border-box;">
                <div style="color:#fff;">Mod: ${(c[k]?.mod || 0) >= 0 ? '+' : ''}${c[k]?.mod || 0}</div>
                <input type="number" placeholder="save" data-id="${c.id}" data-field="${k}.save" value="${c[k]?.save || 0}" style="width:100%;box-sizing:border-box;">
              </div>`).join('')}
          </div>
           
           <h4 style="margin-top:12px;">Saving Throws</h4>
           <div class="ability-grid">
             ${['str','dex','con','int','wis','cha'].map(k => `
               <div>
                 <label style="font-size:0.7em;">${k.toUpperCase()}</label>
                 <label style="display:flex;align-items:center;gap:2px;margin-bottom:2px;"><input type="checkbox" data-id="${c.id}" data-field="${k}.proficientSave" ${c[k]?.proficientSave ? 'checked' : ''} style="width:14px;height:14px;"> Prof</label>
                 <input type="number" data-id="${c.id}" data-field="${k}.saveMod" value="${c[k]?.saveMod || 0}" style="width:100%;box-sizing:border-box;font-size:0.85em;">
               </div>`).join('')}
           </div>
        </div>

        <!-- Column 2: Defenses & Utility -->
        <div class="stat-column" style="font-size:0.9em;">
          <h4>Defenses</h4>
          <label>Resistances</label>
          <textarea data-id="${c.id}" data-field="resistances" style="width:100%;box-sizing:border-box;min-height:60px;resize:vertical;">${escapeHtml((c.resistances||[]).join(", "))}</textarea><br>
          <label>Immunities</label>
          <textarea data-id="${c.id}" data-field="immunities" style="width:100%;box-sizing:border-box;min-height:60px;resize:vertical;">${escapeHtml((c.immunities||[]).join(", "))}</textarea><br>
          <label>Vulnerabilities</label>
          <textarea data-id="${c.id}" data-field="vulnerabilities" style="width:100%;box-sizing:border-box;min-height:60px;resize:vertical;">${escapeHtml((c.vulnerabilities||[]).join(", "))}</textarea><br>
          <label>Condition Immunities</label>
          <textarea data-id="${c.id}" data-field="conditionImmunities" style="width:100%;box-sizing:border-box;min-height:60px;resize:vertical;">${escapeHtml((c.conditionImmunities||[]).join(", "))}</textarea><br>

          <h4>Utility</h4>
          <label>Passive Perception</label>
          <input type="number" data-id="${c.id}" data-field="passivePerception" value="${c.passivePerception || 10}" style="width:100%;box-sizing:border-box;"><br>
          <label>Senses</label>
          <textarea data-id="${c.id}" data-field="senses" style="width:100%;box-sizing:border-box;min-height:60px;resize:vertical;">${escapeHtml(c.senses || "")}</textarea><br>
          <label>Languages</label>
          <textarea data-id="${c.id}" data-field="languages" style="width:100%;box-sizing:border-box;min-height:60px;resize:vertical;">${escapeHtml((c.languages||[]).join(", "))}</textarea><br>
          <label>Skills</label>
          <textarea data-id="${c.id}" data-field="skills" style="width:100%;box-sizing:border-box;min-height:60px;resize:vertical;">${escapeHtml(c.skills || "")}</textarea><br>
        </div>

        <!-- Column 3: Combat Text -->
        <div class="stat-column" style="font-size:0.9em;">
          <h4>Traits</h4>
          <div class="entry-list">
            ${(c.traits||[]).map((e,i) => `
              <div class="entry-row">
                <input type="text" placeholder="name" data-id="${c.id}" data-field="traits[${i}].name" value="${escapeHtml(e.name||'')}" style="min-width:160px;width:30%;resize:horizontal;">
                <textarea data-id="${c.id}" data-field="traits[${i}].text">${escapeHtml(e.text||'')}</textarea>
                <button type="button" data-id="${c.id}" data-action="remove-entry" data-field="traits" data-index="${i}">✕</button>
              </div>`).join('')}
          </div>
          <button type="button" data-id="${c.id}" data-action="add-entry" data-field="traits">+ Add</button>

          <h4>Actions</h4>
          <div class="entry-list">
            ${(c.actions||[]).map((e,i) => `
              <div class="entry-row">
                <input type="text" placeholder="name" data-id="${c.id}" data-field="actions[${i}].name" value="${escapeHtml(e.name||'')}" style="min-width:160px;width:30%;resize:horizontal;">
                <textarea data-id="${c.id}" data-field="actions[${i}].text">${escapeHtml(e.text||'')}</textarea>
                <button type="button" data-id="${c.id}" data-action="remove-entry" data-field="actions" data-index="${i}">✕</button>
              </div>`).join('')}
          </div>
          <button type="button" data-id="${c.id}" data-action="add-entry" data-field="actions">+ Add</button>

          <h4>Bonus Actions</h4>
          <div class="entry-list">
            ${(c.bonusActions||[]).map((e,i) => `
              <div class="entry-row">
                <input type="text" placeholder="name" data-id="${c.id}" data-field="bonusActions[${i}].name" value="${escapeHtml(e.name||'')}" style="min-width:160px;width:30%;resize:horizontal;">
                <textarea data-id="${c.id}" data-field="bonusActions[${i}].text">${escapeHtml(e.text||'')}</textarea>
                <button type="button" data-id="${c.id}" data-action="remove-entry" data-field="bonusActions" data-index="${i}">✕</button>
              </div>`).join('')}
          </div>
          <button type="button" data-id="${c.id}" data-action="add-entry" data-field="bonusActions">+ Add</button>

          <h4>Reactions</h4>
          <div class="entry-list">
            ${(c.reactions||[]).map((e,i) => `
              <div class="entry-row">
                <input type="text" placeholder="name" data-id="${c.id}" data-field="reactions[${i}].name" value="${escapeHtml(e.name||'')}" style="min-width:160px;width:30%;resize:horizontal;">
                <textarea data-id="${c.id}" data-field="reactions[${i}].text">${escapeHtml(e.text||'')}</textarea>
                <button type="button" data-id="${c.id}" data-action="remove-entry" data-field="reactions" data-index="${i}">✕</button>
              </div>`).join('')}
          </div>
          <button type="button" data-id="${c.id}" data-action="add-entry" data-field="reactions">+ Add</button>

          <h4>Legendary Actions (pool:
            <input type="number" data-id="${c.id}" data-field="legendaryActionCount" value="${c.legendaryActionCount || 0}" style="width:40px">
          )</h4>
          <div class="entry-list">
            ${(c.legendaryActions||[]).map((e,i) => `
              <div class="entry-row">
                <input type="text" placeholder="name" data-id="${c.id}" data-field="legendaryActions[${i}].name" value="${escapeHtml(e.name||'')}" style="min-width:160px;width:28%;resize:horizontal;">
                Cost:<input type="number" data-id="${c.id}" data-field="legendaryActions[${i}].cost" value="${e.cost||1}" style="width:35px">
                <textarea data-id="${c.id}" data-field="legendaryActions[${i}].text">${escapeHtml(e.text||'')}</textarea>
                <button type="button" data-id="${c.id}" data-action="remove-entry" data-field="legendaryActions" data-index="${i}">✕</button>
              </div>`).join('')}
          </div>
          <button type="button" data-id="${c.id}" data-action="add-entry" data-field="legendaryActions">+ Add</button>
        </div>

        <!-- Column 4: Spellcasting -->
        <div class="stat-column" style="font-size:0.9em;">
          <h4>Spellcasting</h4>
          Ability:<select data-id="${c.id}" data-field="spellcasting.spellcastingAbility">
            ${['none','int','wis','cha'].map(a=>`<option value="${a}"${c.spellcasting?.spellcastingAbility===a?' selected':''}>${a.toUpperCase()}</option>`).join('')}
          </select><br>
          DC:<input type="number" data-id="${c.id}" data-field="spellcasting.spellSaveDC" value="${c.spellcasting?.spellSaveDC || 0}" style="width:50px;">
          Atk:<input type="number" data-id="${c.id}" data-field="spellcasting.spellAttackBonus" value="${c.spellcasting?.spellAttackBonus || 0}" style="width:50px;"><br>
          <div class="slot-grid">${slotGrid}</div>
          
          <h4 style="color:#fff;">Spells</h4>
          <div id="spell-list-${c.id}" class="entry-list">
            ${(c.spellcasting?.spells || []).map((s,i) => {
              const levelStr = s.atWill ? '∞' : (s.level === 0 ? 'C' : s.level);
              return `<div class="entry-row">
                <button type="button" data-action="cast-spell" data-id="${c.id}" data-index="${i}" style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;padding:4px 8px;border-radius:4px;font-size:0.75em;cursor:pointer;flex:1;">[${levelStr}] ${escapeHtml(s.name)}</button>
                <button type="button" data-action="toggle-atwill" data-id="${c.id}" data-index="${i}" class="px-1.5 rounded ${s.atWill ? 'bg-amber-600 hover:bg-amber-500' : 'bg-slate-700 hover:bg-slate-600'} text-xs" title="Toggle at-will">${s.atWill ? '∞' : '◆'}</button>
                <button type="button" data-action="toggle-concentration" data-id="${c.id}" data-index="${i}" class="px-1.5 rounded ${s.concentration ? 'bg-fuchsia-600 hover:bg-fuchsia-500' : 'bg-slate-700 hover:bg-slate-600'} text-xs" title="Toggle concentration">${s.concentration ? 'C' : 'c'}</button>
                ${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="px-1.5 rounded bg-sky-700 hover:bg-sky-600 text-xs" title="Open spell URL">Open</a>` : `<button type="button" data-action="noop" class="px-1.5 rounded bg-slate-800 text-xs opacity-60" title="No URL set" disabled>Open</button>`}
                <button type="button" data-action="remove-spell" data-id="${c.id}" data-index="${i}" class="px-1 rounded bg-slate-700 hover:bg-slate-600 text-xs">✕</button>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:2px;margin-bottom:4px;flex-wrap:wrap;">
            <input type="text" placeholder="name" id="new-spell-name-${c.id}" style="flex:0.8;min-width:60px;">
            <input type="number" placeholder="lvl" id="new-spell-level-${c.id}" min="0" max="9" value="0" style="width:40px;">
            <label style="display:flex;align-items:center;gap:2px;font-size:0.75em;color:#fff;"><input type="checkbox" id="new-spell-atwill-${c.id}"> At-will</label>
            <button type="button" data-action="add-spell" data-id="${c.id}" class="px-1 rounded bg-blue-600 hover:bg-blue-500 text-xs">+</button>
          </div>
          <textarea placeholder="Paste spell text" id="new-spell-rawtext-${c.id}" rows="3" style="width:100%;font-family:monospace;font-size:0.8em;resize:vertical;"></textarea>
        </div>

        <!-- Column 5: Innate Spellcasting -->
        <div class="stat-column" style="font-size:0.9em;">
          <h4>Innate Spellcasting</h4>
          Ability:<select data-id="${c.id}" data-field="spellcasting.innateAbility">
            ${['none','int','wis','cha'].map(a=>`<option value="${a}"${c.spellcasting?.innateAbility===a?' selected':''}>${a.toUpperCase()}</option>`).join('')}
          </select><br>
          DC:<input type="number" data-id="${c.id}" data-field="spellcasting.innateSaveDC" value="${c.spellcasting?.innateSaveDC || 0}" style="width:50px;">
          Atk:<input type="number" data-id="${c.id}" data-field="spellcasting.innateAttackBonus" value="${c.spellcasting?.innateAttackBonus || 0}" style="width:50px;"><br>
        </div>
      </div>
      <div style="margin-top:8px;">
        <label style="display:block;color:#cbd5e1;font-size:0.8em;margin-bottom:4px;">Notes</label>
        <textarea data-id="${c.id}" data-field="notes" style="width:100%;box-sizing:border-box;min-height:90px;resize:vertical;background:#0f172a;border:1px solid #334155;color:#e2e8f0;border-radius:4px;padding:6px;">${escapeHtml(c.notes || "")}</textarea>
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

function normalizeSpellSlots(spellSlots) {
  const canonical = {
    level1: { total: 0, used: 0 },
    level2: { total: 0, used: 0 },
    level3: { total: 0, used: 0 },
    level4: { total: 0, used: 0 },
    level5: { total: 0, used: 0 },
    level6: { total: 0, used: 0 },
    level7: { total: 0, used: 0 },
    level8: { total: 0, used: 0 },
    level9: { total: 0, used: 0 },
  };

  if (!spellSlots) return canonical;

  // Handle old array format: [{level: N, current: X, max: Y}, ...]
  if (Array.isArray(spellSlots)) {
    spellSlots.forEach(slot => {
      if (slot && typeof slot === 'object') {
        const lvl = slot.level || slot.lvl;
        if (lvl && lvl >= 1 && lvl <= 9) {
          const key = `level${lvl}`;
          canonical[key] = {
            total: Math.max(0, Number(slot.max || slot.total || 0)),
            used: Math.max(0, Math.min(Number(slot.current || slot.used || 0), Number(slot.max || slot.total || 0)))
          };
        }
      }
    });
    return canonical;
  }

  // Handle object format with numeric or string keys: {"1": 5, "2": 3, ...} or {level1: {...}, ...}
  if (typeof spellSlots === 'object') {
    for (const key in spellSlots) {
      const value = spellSlots[key];
      let lvl = null;
      
      // Check if key is already levelN format
      if (key.match(/^level(\d+)$/)) {
        lvl = parseInt(key.replace('level', ''));
      } else {
        // Try numeric keys "1", "2", etc
        lvl = parseInt(key);
      }

      if (lvl && lvl >= 1 && lvl <= 9) {
        const levelKey = `level${lvl}`;
        // If value is a number, treat as total slots
        if (typeof value === 'number') {
          canonical[levelKey] = { total: Math.max(0, value), used: 0 };
        } else if (value && typeof value === 'object') {
          // If value is object with total/used or max/current
          canonical[levelKey] = {
            total: Math.max(0, Number(value.total || value.max || 0)),
            used: Math.max(0, Math.min(Number(value.used || value.current || 0), Number(value.total || value.max || 0)))
          };
        }
      }
    }
  }

  return canonical;
}

function parseSlots(raw) {
  if (!raw.trim()) return {};

  const result = {
    level1: { total: 0, used: 0 },
    level2: { total: 0, used: 0 },
    level3: { total: 0, used: 0 },
    level4: { total: 0, used: 0 },
    level5: { total: 0, used: 0 },
    level6: { total: 0, used: 0 },
    level7: { total: 0, used: 0 },
    level8: { total: 0, used: 0 },
    level9: { total: 0, used: 0 },
  };

  raw.split(",").forEach((chunk) => {
    const match = chunk.trim().match(/^L(\d+)\s+(\d+)\/(\d+)$/i);
    if (match) {
      const lvl = Number(match[1]);
      if (lvl >= 1 && lvl <= 9) {
        result[`level${lvl}`] = {
          total: Number(match[3]),
          used: Math.min(Number(match[2]), Number(match[3]))
        };
      }
    }
  });

  return result;
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
        spellSlots: normalizeSpellSlots({}),
        spells: [],
        innateAbility: 'none',
        innateAttackBonus: 0,
        innateSaveDC: 0
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

    // Handle schema migration: if no schemaVersion, treat as v1 and migrate
    const version = parsed.schemaVersion || 1;
    
    // Migrate from v1 to v2: ensure spell slots are in canonical format
    if (version < 2) {
      parsed.active = parsed.active.map(c => {
        if (!c.spellcasting) {
          c.spellcasting = { spellSlots: {} };
        }
        if (!c.spellcasting.spellSlots) {
          c.spellcasting.spellSlots = {};
        }
        // Migrate old spellSlots from root to canonical format in spellcasting
        if (c.spellSlots && (!c.spellcasting.spellSlots || Object.keys(c.spellcasting.spellSlots || {}).length === 0)) {
          c.spellcasting.spellSlots = normalizeSpellSlots(c.spellSlots);
        }
        delete c.spellSlots; // Remove old slot format from root
        return c;
      });
      
      parsed.baseline = parsed.baseline.map(c => {
        if (!c.spellcasting) {
          c.spellcasting = { spellSlots: {} };
        }
        if (!c.spellcasting.spellSlots) {
          c.spellcasting.spellSlots = {};
        }
        if (c.spellSlots && (!c.spellcasting.spellSlots || Object.keys(c.spellcasting.spellSlots || {}).length === 0)) {
          c.spellcasting.spellSlots = normalizeSpellSlots(c.spellSlots);
        }
        delete c.spellSlots;
        return c;
      });
    }

    state.schemaVersion = SCHEMA_VERSION;
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

    if (!action || !id) return;

    const found = findCombatant(id);
    if (!found) return;

    const c = found.combatant;

    // Handle stat block actions first
    if (action === "add-spell") {
      const nameInput = document.getElementById(`new-spell-name-${id}`);
      const levelInput = document.getElementById(`new-spell-level-${id}`);
      const rawTextInput = document.getElementById(`new-spell-rawtext-${id}`);
      const atWillInput = document.getElementById(`new-spell-atwill-${id}`);
      if (nameInput && levelInput && rawTextInput) {
        const name = nameInput.value.trim();
        const level = Number(levelInput.value);
        const rawText = rawTextInput.value.trim();
        const atWill = atWillInput ? atWillInput.checked : false;
        if (name && level >= 0 && level <= 9) {
          if (!c.spellcasting.spells) c.spellcasting.spells = [];
          c.spellcasting.spells.push({name, level, rawText, atWill, concentration: false, url: ""});
          nameInput.value = '';
          levelInput.value = '0';
          rawTextInput.value = '';
          if (atWillInput) atWillInput.checked = false;
        }
      }
    } else if (action === "remove-spell") {
      const index = Number(target.dataset.index);
      if (c.spellcasting?.spells && Array.isArray(c.spellcasting.spells)) {
        c.spellcasting.spells.splice(index, 1);
      }
    } else if (action === "toggle-atwill") {
      const index = Number(target.dataset.index);
      const spell = c.spellcasting?.spells?.[index];
      if (spell) {
        spell.atWill = !spell.atWill;
      }
    } else if (action === "toggle-concentration") {
      const index = Number(target.dataset.index);
      const spell = c.spellcasting?.spells?.[index];
      if (spell) {
        spell.concentration = !spell.concentration;
      }
    } else if (action === "cast-spell") {
      const index = Number(target.dataset.index);
      const spell = c.spellcasting?.spells?.[index];
      if (spell) {
        showSpellModal(c, spell, index);
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
        const slotDisplay = document.getElementById(`slot-${c.id}-${level}`);
        if (slotDisplay) {
          slotDisplay.textContent = `${c.spellcasting.spellSlots[level].used}/${c.spellcasting.spellSlots[level].total}`;
          save();
        }
      }
      return;
    } else if (action === "slot-restore") {
      const level = target.dataset.level;
      if (c.spellcasting?.spellSlots[level]) {
        c.spellcasting.spellSlots[level].used = Math.min(c.spellcasting.spellSlots[level].total, c.spellcasting.spellSlots[level].used + 1);
        const slotDisplay = document.getElementById(`slot-${c.id}-${level}`);
        if (slotDisplay) {
          slotDisplay.textContent = `${c.spellcasting.spellSlots[level].used}/${c.spellcasting.spellSlots[level].total}`;
          save();
        }
      }
      return;
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
        save();
        return; // skip re-render to prevent DOM reset
      } else if (action === "set-slots") {
        c.spellcasting.spellSlots = parseSlots(target.value);
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

function showSpellModal(combatant, spell, spellIndex) {
  const parsed = parseSpellText(spell.rawText || "");
  
  const metaFields = [
    {label: "Level", value: parsed.level},
    {label: "Casting Time", value: parsed.castingTime},
    {label: "Range", value: parsed.range},
    {label: "Components", value: parsed.components},
    {label: "Duration", value: parsed.duration},
    {label: "School", value: parsed.school},
    {label: "Attack/Save", value: parsed.attackSave},
    {label: "Damage", value: parsed.damageEffect}
  ].filter(f => f.value);

  if (spell.atWill) {
    metaFields.unshift({label: "At-will", value: "∞ (no slot cost)"});
  }
  if (spell.concentration) {
    metaFields.unshift({label: "Concentration", value: "Yes"});
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
      
      <div class="spell-meta" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin-bottom:8px;font-size:0.85em;">
        ${metaFields.map(f => `<span><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</span>`).join('')}
      </div>
      
      <div class="spell-edit" style="display:grid;gap:8px;margin:10px 0;">
        <label for="spell-name-input" style="font-weight:600;color:#fff;">Name</label>
        <input id="spell-name-input" type="text" value="${escapeHtml(spell.name)}" style="width:100%;padding:6px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:4px;">
        <label for="spell-level-input" style="font-weight:600;color:#fff;">Level</label>
        <input id="spell-level-input" type="number" min="0" max="9" value="${Number(spell.level) || 0}" style="width:100%;padding:6px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:4px;">
        <label style="display:flex;align-items:center;gap:8px;color:#fff;">
          <input id="spell-atwill-input" type="checkbox" ${spell.atWill ? 'checked' : ''}> At-will
        </label>
        <label style="display:flex;align-items:center;gap:8px;color:#fff;">
          <input id="spell-concentration-input" type="checkbox" ${spell.concentration ? 'checked' : ''}> Concentration
        </label>
        <label for="spell-url-input" style="font-weight:600;color:#fff;">URL</label>
        <input id="spell-url-input" type="url" value="${escapeHtml(spell.url || "")}" placeholder="https://..." style="width:100%;padding:6px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:4px;">
        <label for="spell-description-input" style="font-weight:600;color:#fff;">Description</label>
        <textarea id="spell-description-input" rows="8" style="width:100%;font-size:0.9em;line-height:1.5;background:#0f172a;padding:10px;border-radius:4px;border:1px solid #334155;color:#e2e8f0;resize:vertical;">${escapeHtml(parsed.description || "")}</textarea>
      </div>
      
      ${spell.level > 0 ? `
        <div style="margin:10px 0;">
          <label style="display:block;margin-bottom:5px;color:#fff;">Cast at level:</label>
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

  const saveSpellEdits = () => {
    const liveSpell = combatant.spellcasting?.spells?.[spellIndex];
    if (!liveSpell) return;
    const nameInput = document.getElementById('spell-name-input');
    const levelInput = document.getElementById('spell-level-input');
    const atWillInput = document.getElementById('spell-atwill-input');
    const concentrationInput = document.getElementById('spell-concentration-input');
    const descriptionInput = document.getElementById('spell-description-input');
    const urlInput = document.getElementById('spell-url-input');
    if (!nameInput || !levelInput || !atWillInput || !concentrationInput || !descriptionInput || !urlInput) return;
    const level = Math.min(9, Math.max(0, Number(levelInput.value) || 0));
    liveSpell.name = nameInput.value.trim() || liveSpell.name;
    liveSpell.level = level;
    liveSpell.atWill = atWillInput.checked;
    liveSpell.concentration = concentrationInput.checked;
    liveSpell.rawText = (descriptionInput.value || "").trim();
    liveSpell.url = (urlInput.value || "").trim();
    save();
  };
  
  document.getElementById('spell-close-btn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  ['spell-name-input', 'spell-level-input', 'spell-atwill-input', 'spell-concentration-input', 'spell-url-input', 'spell-description-input'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', saveSpellEdits);
      input.addEventListener('change', saveSpellEdits);
    }
  });
  
  document.getElementById('spell-cast-btn').addEventListener('click', () => {
    saveSpellEdits();
    const levelSelect = document.getElementById('spell-level-select');
    const castLevel = levelSelect ? Number(levelSelect.value) : spell.level;
    
    if (!spell.atWill && castLevel > 0) {
      const slotKey = `level${castLevel}`;
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
    state.schemaVersion = SCHEMA_VERSION;
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


