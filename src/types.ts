/** Where the created note is opened. */
export type OpenMode = "tab" | "same" | "split" | "window" | "none";

/** What to do when a note with the resolved name already exists. */
export type ExistingBehavior = "increment" | "open";

export interface LauncherButton {
	id: string;
	/** Shown as the ribbon tooltip and used as the command name. */
	name: string;
	/** Icon id, e.g. "lucide-calendar-plus". */
	icon: string;
	/** Destination folder, vault-relative. Empty means the vault root. */
	folder: string;
	/** Template file path. Empty creates an empty note. */
	template: string;
	/** File name pattern; supports the same placeholders as templates. */
	fileName: string;
	/** Ask for the name, pre-filled with the resolved pattern. */
	promptForName: boolean;
	openMode: OpenMode;
	onExisting: ExistingBehavior;
	showInRibbon: boolean;
	registerCommand: boolean;
}

export interface NoteLauncherSettings {
	buttons: LauncherButton[];
	dateFormat: string;
	timeFormat: string;
	/** Let Templater process the new note when the plugin is installed. */
	useTemplater: boolean;
}

export const DEFAULT_SETTINGS: NoteLauncherSettings = {
	buttons: [],
	dateFormat: "YYYY-MM-DD",
	timeFormat: "HH:mm",
	useTemplater: true,
};

export function createButton(name: string): LauncherButton {
	return {
		id: `btn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
		name,
		icon: "lucide-file-plus",
		folder: "",
		template: "",
		fileName: "{{date}} " + name.toLowerCase(),
		promptForName: false,
		openMode: "tab",
		onExisting: "increment",
		showInRibbon: true,
		registerCommand: true,
	};
}
