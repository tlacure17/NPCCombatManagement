# NPC Combat Manager

Single-page D&D 5e combat tracker for DM-side encounter management. It runs entirely in the browser with local persistence and no backend.

## Live URL (GitHub Pages)

https://tlacure17.github.io/NPCCombatManagement/

## Quick Start

1. Open the live app: https://tlacure17.github.io/NPCCombatManagement/
2. Or run locally by opening `index.html` directly in your browser (`file://.../index.html`).
3. Add/edit combatants, run initiative, and use Export State for backups.

## Combatant Schema Reference

Each combatant supports full stat-block and runtime fields. Missing fields are populated by `migrate()` defaults on load/import.

### Core

- `name: string`
- `size: string`
- `type: string`
- `alignment: string`
- `ac: number`
- `acNote: string`
- `hp: number`
- `hpFormula: string`
- `speed: string`
- `proficiencyBonus: number`
- `cr: string`
- `xp: number`

### Abilities

- `str: { score: number, mod: number, save: number }`
- `dex: { score: number, mod: number, save: number }`
- `con: { score: number, mod: number, save: number }`
- `int: { score: number, mod: number, save: number }`
- `wis: { score: number, mod: number, save: number }`
- `cha: { score: number, mod: number, save: number }`

### Defenses

- `resistances: string[]`
- `immunities: string[]`
- `vulnerabilities: string[]`
- `conditionImmunities: string[]`

### Utility

- `saves: string[]`
- `skills: string[]`
- `senses: string[]`
- `languages: string[]`
- `passivePerception: number`

### Combat text blocks

- `traits: Array<{ name: string, text: string }>`
- `actions: Array<{ name: string, text: string }>`
- `bonusActions: Array<{ name: string, text: string }>`
- `reactions: Array<{ name: string, text: string }>`
- `legendaryActions: Array<{ name: string, text: string, cost: number }>`
- `legendaryActionCount: number`
- `lairActions: Array<{ name: string, text: string }>`
- `spellcasting: {`
  - `casterLevel: string`
  - `ability: string`
  - `saveDc: number`
  - `attackBonus: number`
  - `atWill: string[]`
  - `daily: Array<{ label: string, spells: string[] }>`
  - `byLevel: Array<{ level: string, slots: string, spells: string[] }>`
`}`

### Resources

- `perRestUses: Array<{ name: string, max: number, used: number }>`
- `perDayUses: Array<{ name: string, max: number, used: number }>`
- `customCounters: Array<{ name: string, value: number, max: number }>`

### Runtime fields

- `id: string`
- `initiative: number`
- `currentHp: number`
- `conditions: string[]`
- `isPlayer: boolean`
- `notes: string`

## Editing Workflow

1. Update `baseline.encounter.json` with your encounter or NPC templates.
2. Launch app and make combat-time changes in UI.
3. Export current state JSON before/after sessions.
4. Import exported JSON to resume an encounter.
5. Use Restore/Reset flows to recover from mistakes quickly.

## Import/Export Compatibility

- Import accepts older snapshots and baseline shapes.
- `migrate()` fills missing fields with safe defaults.
- Existing lightweight combatants remain usable after schema expansion.
- Export always writes the current, normalized shape.
