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
    if (!action || !id) return;

    const found = findCombatant(id);
    if (!found) return;

    if (action === "damage") {
      found.combatant.hp.current = Math.max(0, found.combatant.hp.current - 1);
    } else if (action === "heal") {
      found.combatant.hp.current = Math.min(found.combatant.hp.max, found.combatant.hp.current + 1);
    } else if (action === "remove") {
      state.active.splice(found.idx, 1);
      clampTurnIndex();
    }

    save();
    render();
  });

  els.list.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const action = target.dataset.action;
    const id = target.dataset.id;
    if (!action || !id) return;

    const found = findCombatant(id);
    if (!found) return;

    try {
      if (action === "set-hp") {
        const hp = parseHp(target.value);
        if (!hp) throw new Error("Invalid HP format");
        found.combatant.hp = hp;
      } else if (action === "set-conditions") {
        found.combatant.conditions = target.value
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      } else if (action === "set-slots") {
        found.combatant.spellSlots = parseSlots(target.value);
      } else if (action === "set-abilities") {
        found.combatant.abilities = parseAbilities(target.value);
      }

      save();
      render();
    } catch (error) {
      alert(error.message || "Invalid input");
      render();
    }
  });
}

async function bootstrap() {
  const loaded = load();

  if (!loaded) {
    const baselineRaw = await loadBaselineFile();
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
