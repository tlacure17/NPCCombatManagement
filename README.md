# NPC Combat Manager

A lightweight, local-first web app for Dungeon Masters to run a single combat encounter (about 8 NPCs/participants) with fast iteration and no backend hosting.

## Features in this first pass

- Initiative order tracking
- Turn management (next/prev round)
- HP tracking (current/max)
- Conditions/status tracking
- Spell slot and ability use counters
- Optional source URL field on each combatant
- Local persistence in browser storage
- Export current state to JSON
- Restore baseline encounter from JSON
- Reset active encounter back to baseline

## Tech stack

- Vanilla HTML/CSS/JavaScript
- Tailwind CSS via CDN
- Browser localStorage for persistence
- GitHub Pages-friendly static hosting

## Quick start

1. Clone repo
2. Open `index.html` in a browser
3. Add combatants and run combat

## Data model (high level)

- `baseline`: canonical encounter snapshot
- `active`: mutable combat state for the current encounter
- `meta`: UI state such as selected turn index and round number

Everything is stored under one localStorage key to keep backups simple.

## Hosting

This project is intended for GitHub Pages. No server, database, or secrets required.

## Notes

This is intentionally local-first for fast hobby iteration.
If your data gets messy, you can restore baseline or import a clean JSON snapshot.
