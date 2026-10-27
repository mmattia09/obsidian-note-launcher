# Note Launcher

An [Obsidian](https://obsidian.md) plugin that lets you build your own ribbon buttons. Each button creates a note from a template, in the folder you choose, and opens it — one click, no dialogs in the way.

## What a button does

Configure as many buttons as you like. For each one you pick:

| Setting | What it does |
| --- | --- |
| **Name** | Ribbon tooltip and command name |
| **Icon** | Any Obsidian icon, chosen from a searchable picker |
| **Destination folder** | Where the note is created; missing folders are created for you |
| **Template** | A note whose content is copied into the new note (optional) |
| **File name** | Name pattern for the new note, with placeholders |
| **Ask for the name** | Show a prompt, pre-filled with the resolved pattern |
| **Open in** | New tab, current tab, split pane, new window, or don't open |
| **If the note already exists** | Create a numbered copy, or open the existing note |
| **Show in ribbon** / **Add a command** | Where the button is available |

Settings are searchable in Obsidian’s settings search. Folder and template suggestions use Obsidian’s built-in controls. Buttons can be reordered, duplicated and deleted, and every button is also available from the command palette, so you can bind a hotkey to it.

## Placeholders

Available in the file name, the destination folder and the template body:

| Placeholder | Result |
| --- | --- |
| `{{date}}` | Current date, in the format set in the plugin settings |
| `{{time}}` | Current time, in the format set in the plugin settings |
| `{{date:FORMAT}}` | Current date with a custom [moment.js](https://momentjs.com/docs/#/displaying/format/) format, e.g. `{{date:dddd D MMMM}}` |
| `{{time:FORMAT}}` | Current time with a custom format |
| `{{title}}` | Final name of the new note (template body only) |

These are the same placeholders as Obsidian's core Templates plugin, so existing templates keep working.

### Examples

- **Daily journal** — folder `journal/{{date:YYYY}}`, file name `{{date}}`, existing note → *open*: one button that creates today's entry, or jumps to it if it already exists.
- **Meeting note** — folder `meetings`, template `templates/meeting.md`, file name `{{date}} meeting`, ask for the name: prompts you with a sensible default you can adjust.
- **Quick capture** — folder `inbox`, no template, file name `capture {{time:HHmmss}}`, open in *current tab*.

## Templater

If [Templater](https://github.com/SilentVoid13/Templater) is installed, Note Launcher lets it process the new note so `<% tp.* %>` commands run as usual. This is skipped automatically when Templater is already set to trigger on file creation, so nothing runs twice. You can turn the integration off in the settings.

## Installation

Requires Obsidian **1.13.0+**. Works on desktop and mobile.

### Manual

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/mmattia09/obsidian-note-launcher/releases/latest).
2. Copy them to `<vault>/.obsidian/plugins/note-launcher/`.
3. Reload Obsidian and enable **Note Launcher** in Settings → Community plugins.

### Building

```bash
npm ci
npm run check # lint, regression tests, and production build
npm run build   # produces main.js
npm run dev     # build in watch mode
```

## Language

The interface follows the Obsidian language and is available in English, Italian, French, German and Spanish.

## Development

- `src/main.ts` — plugin lifecycle, ribbon icons and commands.
- `src/settings.ts` — settings tab with the button editor.
- `src/launcher.ts` — name resolution, placeholders, note creation.
- `src/modals.ts` — icon picker and name prompt.
- `src/i18n.ts` — translations.

## License

MIT

## Releases

After merging a version bump, push a tag matching `manifest.json` (for example `1.0.1`). The release workflow checks version consistency, runs lint/tests, verifies two clean builds produce identical `main.js`, and attests `main.js`, `manifest.json`, and `styles.css`. It then creates a **draft** GitHub release with those exact files. Verify the draft before publishing it to trigger the community catalog scan.

Use Node 22.23.4+, 24.22.1+, or 26.12.1+ within the supported release lines. CI uses Node 24.22.1. Install with `npm ci` to reproduce the locked build dependencies.
