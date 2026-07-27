import { App, Notice, PaneType, TFile, TFolder, moment, normalizePath } from "obsidian";
import { LauncherButton, NoteLauncherSettings } from "./types";
import { NamePromptModal } from "./modals";
import { t } from "./i18n";

/** Characters that cannot appear in a file name on at least one platform. */
const ILLEGAL_CHARS = /[\\/:*?"<>|]/g;

/**
 * Obsidian re-exports moment as a namespace, which TypeScript sees as
 * non-callable; this narrows it back to the single call we need.
 */
type MomentLike = { format(format: string): string };
const asMoment = moment as unknown as (input?: Date) => MomentLike;

/** Formats a date with a moment.js format string. */
export function formatDate(at: Date, format: string): string {
	return asMoment(at).format(format);
}

export function sanitizeFileName(name: string): string {
	return name
		.replace(ILLEGAL_CHARS, "-")
		.replace(/\s+/g, " ")
		.replace(/^\.+/, "")
		.trim()
		.slice(0, 180);
}

/**
 * Replaces the placeholders shared with Obsidian's core Templates plugin:
 * {{title}}, {{date}}, {{time}} and their {{date:FORMAT}} variants.
 */
export function applyPlaceholders(
	text: string,
	settings: NoteLauncherSettings,
	title: string,
	at: Date = new Date()
): string {
	return text
		.replace(/{{\s*(date|time)\s*:\s*([^}]+)}}/gi, (_m, _kind: string, format: string) =>
			formatDate(at, format.trim())
		)
		.replace(/{{\s*date\s*}}/gi, () => formatDate(at, settings.dateFormat))
		.replace(/{{\s*time\s*}}/gi, () => formatDate(at, settings.timeFormat))
		.replace(/{{\s*title\s*}}/gi, () => title);
}

interface TemplaterPlugin {
	templater?: {
		overwrite_file_commands?: (file: TFile, activeFile?: boolean) => Promise<void>;
	};
	settings?: { trigger_on_file_creation?: boolean };
}

function getTemplater(app: App): TemplaterPlugin | undefined {
	const plugins = (app as unknown as { plugins?: { plugins?: Record<string, TemplaterPlugin> } })
		.plugins?.plugins;
	return plugins?.["templater-obsidian"];
}

/** Ensures every segment of the folder path exists, then returns it. */
async function ensureFolder(app: App, folderPath: string): Promise<string> {
	const path = normalizePath(folderPath);
	if (!path || path === "/" || path === ".") return "";
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFolder) return path;

	const segments = path.split("/").filter(Boolean);
	let current = "";
	for (const segment of segments) {
		current = current ? `${current}/${segment}` : segment;
		if (!(app.vault.getAbstractFileByPath(current) instanceof TFolder)) {
			try {
				await app.vault.createFolder(current);
			} catch {
				// Another process may have created it in the meantime.
			}
		}
	}
	return current;
}

function joinPath(folder: string, base: string): string {
	return normalizePath(folder ? `${folder}/${base}.md` : `${base}.md`);
}

/** First free path for `base`, adding " 2", " 3", … when needed. */
function uniquePath(app: App, folder: string, base: string): string {
	let path = joinPath(folder, base);
	let counter = 1;
	while (app.vault.getAbstractFileByPath(path)) {
		counter++;
		path = joinPath(folder, `${base} ${counter}`);
	}
	return path;
}

async function openFile(app: App, file: TFile, mode: LauncherButton["openMode"]): Promise<void> {
	if (mode === "none") return;
	const paneType: PaneType | boolean = mode === "same" ? false : mode;
	await app.workspace.getLeaf(paneType).openFile(file);
}

/** Runs a button: resolve the name, create the note, open it. */
export async function launch(
	app: App,
	settings: NoteLauncherSettings,
	button: LauncherButton
): Promise<void> {
	// One timestamp for the whole run so the name and the body agree.
	const now = new Date();
	const resolved = sanitizeFileName(
		applyPlaceholders(button.fileName || "", settings, "", now).trim()
	);

	if (!button.promptForName) {
		await createNote(app, settings, button, resolved, now);
		return;
	}
	new NamePromptModal(app, resolved || t("button.untitled"), (value) => {
		void createNote(app, settings, button, sanitizeFileName(value), now);
	}).open();
}

async function createNote(
	app: App,
	settings: NoteLauncherSettings,
	button: LauncherButton,
	rawName: string,
	now: Date
): Promise<void> {
	const base = rawName || t("button.untitled");
	if (!base) {
		new Notice(t("notice.noName"));
		return;
	}

	try {
		// The folder accepts placeholders too, so buttons can file notes
		// into dated folders such as "journal/{{date:YYYY}}".
		const folder = await ensureFolder(app, applyPlaceholders(button.folder, settings, base, now));

		// Reuse the existing note when the button is configured that way
		// (handy for "today's journal"-style buttons).
		const directPath = joinPath(folder, base);
		const existing = app.vault.getAbstractFileByPath(directPath);
		if (existing instanceof TFile) {
			if (button.onExisting === "open") {
				await openFile(app, existing, button.openMode);
				return;
			}
		}

		const path = button.onExisting === "open" ? directPath : uniquePath(app, folder, base);
		const finalBase = path.slice(path.lastIndexOf("/") + 1, -".md".length);

		let content = "";
		if (button.template) {
			const templateFile = app.vault.getAbstractFileByPath(normalizePath(button.template));
			if (!(templateFile instanceof TFile)) {
				new Notice(t("notice.templateMissing") + button.template);
				return;
			}
			content = await app.vault.cachedRead(templateFile);
		}
		content = applyPlaceholders(content, settings, finalBase, now);

		const file = await app.vault.create(path, content);
		await runTemplater(app, settings, file, Boolean(button.template));
		await openFile(app, file, button.openMode);
	} catch (err) {
		console.error("Note Launcher: could not create the note", err);
		new Notice(t("notice.createFailed") + String(err instanceof Error ? err.message : err));
	}
}

async function runTemplater(
	app: App,
	settings: NoteLauncherSettings,
	file: TFile,
	hasTemplate: boolean
): Promise<void> {
	if (!settings.useTemplater || !hasTemplate) return;
	const templater = getTemplater(app);
	// When Templater triggers on file creation it has already processed the
	// new note; running it again would duplicate prompts and commands.
	if (!templater || templater.settings?.trigger_on_file_creation) return;
	try {
		await templater.templater?.overwrite_file_commands?.(file);
	} catch (err) {
		console.error("Note Launcher: Templater could not process the note", err);
	}
}
