import { App, Notice, PluginSettingTab, SettingDefinitionGroup, SettingDefinitionItem } from "obsidian";
import NoteLauncherPlugin from "./main";
import { DEFAULT_SETTINGS, LauncherButton, createButton } from "./types";
import { IconPickerModal, prettyIconName } from "./modals";
import { applyPlaceholders, sanitizeFileName } from "./launcher";
import { t } from "./i18n";

export class NoteLauncherSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: NoteLauncherPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: t("settings.dateFormat"),
				desc: t("settings.dateFormatDesc"),
				control: { type: "text", key: "dateFormat", placeholder: DEFAULT_SETTINGS.dateFormat },
			},
			{
				name: t("settings.timeFormat"),
				desc: t("settings.timeFormatDesc"),
				control: { type: "text", key: "timeFormat", placeholder: DEFAULT_SETTINGS.timeFormat },
			},
			{
				name: t("settings.templater"),
				desc: t("settings.templaterDesc"),
				control: { type: "toggle", key: "useTemplater" },
			},
			{
				name: t("settings.buttons"),
				desc: t("settings.buttonsDesc"),
				render: (setting) => {
					setting.addButton((btn) => btn
						.setButtonText(t("settings.addButton"))
						.setCta()
						.onClick(() => this.persist(() => {
							this.plugin.settings.buttons.push(createButton(t("button.new")));
						})));
				},
			},
			...(this.plugin.settings.buttons.length === 0 ? [{ name: t("settings.empty") }] : []),
			...this.plugin.settings.buttons.map((button, index) => this.buttonDefinitions(button, index)),
		];
	}

	// Resolve by stable ID rather than array index: an open control still edits
	// the correct button after a reorder, and cannot resurrect a deleted button.
	getControlValue(key: string): unknown {
		const target = this.buttonTarget(key);
		if (target) return target.button?.[target.field];
		return super.getControlValue(key);
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const target = this.buttonTarget(key);
		if (!target) {
			if (key === "dateFormat" || key === "timeFormat") {
				if (typeof value !== "string") return;
				value = value.trim() || DEFAULT_SETTINGS[key];
			}
			await super.setControlValue(key, value);
			return;
		}
		const { button, field } = target;
		if (!button) return;
		switch (field) {
			case "name": case "fileName":
				if (typeof value !== "string") return;
				button[field] = value;
				break;
			case "icon": case "folder": case "template":
				if (typeof value !== "string") return;
				button[field] = value.trim();
				break;
			case "promptForName": case "showInRibbon": case "registerCommand":
				if (typeof value !== "boolean") return;
				button[field] = value;
				break;
			case "openMode":
				if (value !== "tab" && value !== "same" && value !== "split" && value !== "window" && value !== "none") return;
				button.openMode = value;
				break;
			case "onExisting":
				if (value !== "increment" && value !== "open") return;
				button.onExisting = value;
				break;
			default: return;
		}
		await this.plugin.saveSettings();
		if (field === "showInRibbon" || field === "registerCommand") this.plugin.refreshLaunchers();
	}

	hide(): void {
		this.plugin.refreshLaunchers();
		this.update();
	}

	private buttonTarget(key: string): { button: LauncherButton | undefined; field: keyof LauncherButton } | undefined {
		if (!key.startsWith("button:")) return undefined;
		const [, id, field] = key.split(":");
		return {
			button: this.plugin.settings.buttons.find((button) => button.id === id),
			field: field as keyof LauncherButton,
		};
	}

	private buttonDefinitions(button: LauncherButton, index: number): SettingDefinitionGroup {
		const key = (field: keyof LauncherButton) => `button:${button.id}:${field}`;
		return {
			type: "group",
			heading: `${index + 1}. ${button.name || t("button.new")}`,
			extraButtons: [
				(btn) => btn.setIcon("lucide-chevron-up").setTooltip(t("settings.moveUp"))
					.setDisabled(index === 0).onClick(() => this.move(button.id, -1)),
				(btn) => btn.setIcon("lucide-chevron-down").setTooltip(t("settings.moveDown"))
					.setDisabled(index === this.plugin.settings.buttons.length - 1).onClick(() => this.move(button.id, 1)),
				(btn) => btn.setIcon("lucide-copy").setTooltip(t("settings.duplicate"))
					.onClick(() => this.persist(() => {
						const at = this.plugin.settings.buttons.findIndex((item) => item.id === button.id);
						if (at < 0) return;
						this.plugin.settings.buttons.splice(at + 1, 0, { ...button, id: createButton("").id });
					})),
				(btn) => btn.setIcon("lucide-trash-2").setTooltip(t("settings.delete"))
					.onClick(() => this.persist(() => {
						this.plugin.settings.buttons = this.plugin.settings.buttons.filter((item) => item.id !== button.id);
					})),
			],
			items: [
				{ name: t("settings.name"), desc: t("settings.nameDesc"), control: { type: "text", key: key("name") } },
				{
					name: t("settings.icon"), desc: t("settings.iconDesc"),
					render: (setting) => {
						setting.addText((text) => text.setPlaceholder(button.icon || "lucide-file-plus").setValue(button.icon)
							.onChange((value) => { void this.setControlValue(key("icon"), value).catch((error: unknown) => this.reportError(error)); }));
						setting.addExtraButton((btn) => btn.setIcon("lucide-search").setTooltip(`${t("settings.iconPick")}: ${prettyIconName(button.icon)}`)
							.onClick(() => {
								new IconPickerModal(this.app, (icon) => {
									void this.setControlValue(key("icon"), icon).then(() => {
										this.plugin.refreshLaunchers();
										this.update();
									})
										.catch((error: unknown) => this.reportError(error));
								}).open();
							}));
					},
				},
				{ name: t("settings.folder"), desc: t("settings.folderDesc"), control: { type: "folder", key: key("folder"), includeRoot: true, placeholder: "/" } },
				{ name: t("settings.template"), desc: t("settings.templateDesc"), control: { type: "file", key: key("template"), filter: (file) => file.extension === "md", placeholder: "templates/note.md" } },
				{
					name: t("settings.fileName"), desc: t("settings.fileNameDesc"),
					render: (setting) => {
						const preview = setting.descEl.createEl("code", { cls: "nl-preview", text: this.previewName(button) });
						setting.addText((text) => text.setPlaceholder("{{date}} note").setValue(button.fileName)
							.onChange((value) => {
								void this.setControlValue(key("fileName"), value).catch((error: unknown) => this.reportError(error));
								preview.setText(this.previewName(button));
							}));
					},
				},
				{ name: t("settings.prompt"), desc: t("settings.promptDesc"), control: { type: "toggle", key: key("promptForName") } },
				{ name: t("settings.openMode"), desc: t("settings.openModeDesc"), control: { type: "dropdown", key: key("openMode"), options: { tab: t("open.tab"), same: t("open.same"), split: t("open.split"), window: t("open.window"), none: t("open.none") } } },
				{ name: t("settings.onExisting"), desc: t("settings.onExistingDesc"), control: { type: "dropdown", key: key("onExisting"), options: { increment: t("existing.increment"), open: t("existing.open") } } },
				{ name: t("settings.ribbon"), control: { type: "toggle", key: key("showInRibbon") } },
				{ name: t("settings.command"), desc: t("settings.commandDesc"), control: { type: "toggle", key: key("registerCommand") } },
			],
		};
	}

	private previewName(button: LauncherButton): string {
		const resolved = sanitizeFileName(applyPlaceholders(button.fileName || "", this.plugin.settings, "").trim());
		return `${resolved || t("button.untitled")}.md`;
	}

	private move(id: string, delta: number): void {
		this.persist(() => {
			const buttons = this.plugin.settings.buttons;
			const index = buttons.findIndex((button) => button.id === id);
			const target = index + delta;
			if (index < 0 || target < 0 || target >= buttons.length) return;
			[buttons[index], buttons[target]] = [buttons[target], buttons[index]];
		});
	}

	private persist(change: () => void): void {
		change();
		void this.plugin.saveSettings().then(() => {
			this.plugin.refreshLaunchers();
			this.update();
		}).catch((error: unknown) => this.reportError(error));
	}

	private reportError(error: unknown): void {
		console.error("Note Launcher: could not save settings", error);
		new Notice(t("notice.saveFailed"));
	}
}
