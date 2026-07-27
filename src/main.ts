import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, LauncherButton, NoteLauncherSettings } from "./types";
import { NoteLauncherSettingTab } from "./settings";
import { launch } from "./launcher";
import { t } from "./i18n";

export default class NoteLauncherPlugin extends Plugin {
	settings: NoteLauncherSettings = { ...DEFAULT_SETTINGS };

	private ribbonEls: HTMLElement[] = [];
	private commandIds: string[] = [];
	private ribbonTitles: string[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new NoteLauncherSettingTab(this.app, this));
		// The ribbon is not ready during onload on some startups.
		this.app.workspace.onLayoutReady(() => this.refreshLaunchers());
	}

	onunload(): void {
		this.clearLaunchers();
	}

	/** Rebuilds every ribbon icon and command from the current settings. */
	refreshLaunchers(): void {
		this.clearLaunchers();
		for (const button of this.settings.buttons) {
			const name = button.name.trim() || t("button.new");
			if (button.showInRibbon) {
				const el = this.addRibbonIcon(button.icon || "lucide-file-plus", name, () => {
					void launch(this.app, this.settings, button);
				});
				this.ribbonEls.push(el);
				this.ribbonTitles.push(name);
			}
			if (button.registerCommand) {
				const id = commandId(button);
				this.addCommand({
					id,
					name,
					callback: () => void launch(this.app, this.settings, button),
				});
				this.commandIds.push(id);
			}
		}
	}

	private clearLaunchers(): void {
		for (const el of this.ribbonEls) el.remove();
		// addRibbonIcon also registers the action by "<plugin id>:<title>";
		// drop those entries so stale items do not pile up in the ribbon
		// configuration menu between refreshes.
		const leftRibbon = (
			this.app.workspace as unknown as {
				leftRibbon?: { removeRibbonAction?: (id: string) => void };
			}
		).leftRibbon;
		for (const title of this.ribbonTitles) {
			try {
				leftRibbon?.removeRibbonAction?.(`${this.manifest.id}:${title}`);
			} catch {
				// Internal API missing: the detached element is enough.
			}
		}
		this.ribbonEls = [];
		this.ribbonTitles = [];

		for (const id of this.commandIds) this.removeCommand(id);
		this.commandIds = [];
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<NoteLauncherSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
			buttons: (data?.buttons ?? []).map((button) => ({ ...DEFAULT_BUTTON, ...button })),
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

/** Fallbacks for buttons saved by an older version of the plugin. */
const DEFAULT_BUTTON: Omit<LauncherButton, "id" | "name"> = {
	icon: "lucide-file-plus",
	folder: "",
	template: "",
	fileName: "",
	promptForName: false,
	openMode: "tab",
	onExisting: "increment",
	showInRibbon: true,
	registerCommand: true,
};

function commandId(button: LauncherButton): string {
	return `launch-${button.id}`;
}
