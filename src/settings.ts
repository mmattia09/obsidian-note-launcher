import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import NoteLauncherPlugin from "./main";
import { DEFAULT_SETTINGS, LauncherButton, createButton } from "./types";
import { FileSuggest, FolderSuggest } from "./suggest";
import { IconPickerModal, prettyIconName } from "./modals";
import { applyPlaceholders, formatDate, sanitizeFileName } from "./launcher";
import { t } from "./i18n";

export class NoteLauncherSettingTab extends PluginSettingTab {
	private readonly expanded = new Set<string>();

	constructor(
		app: App,
		private readonly plugin: NoteLauncherPlugin
	) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("note-launcher-settings");

		this.renderButtons(containerEl);
		this.renderGeneral(containerEl);
	}

	hide(): void {
		// Text fields save as you type but only rebuild the ribbon and the
		// commands once, when leaving the settings.
		this.plugin.refreshLaunchers();
	}

	// ----- buttons -----

	private renderButtons(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t("settings.buttons"))
			.setDesc(t("settings.buttonsDesc"))
			.setHeading()
			.addButton((btn) =>
				btn
					.setButtonText(t("settings.addButton"))
					.setCta()
					.onClick(async () => {
						const button = createButton(t("button.new"));
						this.plugin.settings.buttons.push(button);
						this.expanded.add(button.id);
						await this.plugin.saveSettings();
						this.plugin.refreshLaunchers();
						this.display();
					})
			);

		const list = containerEl.createDiv("nl-button-list");
		if (this.plugin.settings.buttons.length === 0) {
			list.createDiv({ cls: "nl-empty", text: t("settings.empty") });
			return;
		}
		this.plugin.settings.buttons.forEach((button, index) => {
			this.renderButtonCard(list, button, index);
		});
	}

	private renderButtonCard(list: HTMLElement, button: LauncherButton, index: number): void {
		const card = list.createDiv("nl-card");
		const header = card.createDiv("nl-card-header");

		const toggle = header.createDiv("nl-card-toggle");
		const chevron = toggle.createSpan("nl-card-chevron");
		const iconPreview = toggle.createSpan("nl-card-icon");
		setIcon(iconPreview, button.icon || "lucide-file-plus");
		const titles = toggle.createDiv("nl-card-titles");
		titles.createDiv({ cls: "nl-card-name", text: button.name || t("button.new") });
		titles.createDiv({ cls: "nl-card-summary", text: this.summarize(button) });

		const actions = header.createDiv("nl-card-actions");
		const action = (icon: string, label: string, onClick: () => void, disabled = false) => {
			const el = actions.createEl("button", { cls: "clickable-icon nl-card-action" });
			setIcon(el, icon);
			el.setAttr("aria-label", label);
			el.toggleClass("is-disabled", disabled);
			if (!disabled) {
				el.addEventListener("click", (e) => {
					e.stopPropagation();
					onClick();
				});
			}
			return el;
		};

		const buttons = this.plugin.settings.buttons;
		action("lucide-chevron-up", t("settings.moveUp"), () => void this.move(index, -1), index === 0);
		action(
			"lucide-chevron-down",
			t("settings.moveDown"),
			() => void this.move(index, 1),
			index === buttons.length - 1
		);
		action("lucide-copy", t("settings.duplicate"), () => void this.duplicate(index));
		action("lucide-trash-2", t("settings.delete"), () => void this.remove(index));

		const body = card.createDiv("nl-card-body");
		const isOpen = this.expanded.has(button.id);
		setIcon(chevron, isOpen ? "lucide-chevron-down" : "lucide-chevron-right");
		body.toggleClass("is-hidden", !isOpen);

		toggle.addEventListener("click", () => {
			if (this.expanded.has(button.id)) this.expanded.delete(button.id);
			else this.expanded.add(button.id);
			const open = this.expanded.has(button.id);
			body.toggleClass("is-hidden", !open);
			setIcon(chevron, open ? "lucide-chevron-down" : "lucide-chevron-right");
		});

		this.renderButtonFields(body, button, {
			onNameChange: (value) => {
				titles.querySelector(".nl-card-name")?.setText(value || t("button.new"));
			},
			onIconChange: (value) => setIcon(iconPreview, value || "lucide-file-plus"),
			onSummaryChange: () => {
				titles.querySelector(".nl-card-summary")?.setText(this.summarize(button));
			},
		});
	}

	private renderButtonFields(
		body: HTMLElement,
		button: LauncherButton,
		hooks: {
			onNameChange: (value: string) => void;
			onIconChange: (value: string) => void;
			onSummaryChange: () => void;
		}
	): void {
		const save = () => this.plugin.saveSettings();

		new Setting(body)
			.setName(t("settings.name"))
			.setDesc(t("settings.nameDesc"))
			.addText((text) =>
				text.setValue(button.name).onChange(async (value) => {
					button.name = value;
					hooks.onNameChange(value);
					await save();
				})
			);

		new Setting(body)
			.setName(t("settings.icon"))
			.setDesc(t("settings.iconDesc"))
			.addText((text) => {
				text.setPlaceholder("lucide-file-plus").setValue(button.icon);
				text.onChange(async (value) => {
					button.icon = value.trim();
					hooks.onIconChange(button.icon);
					await save();
				});
				text.inputEl.addClass("nl-icon-input");
			})
			.addButton((btn) =>
				btn
					.setButtonText(t("settings.iconPick"))
					.setTooltip(prettyIconName(button.icon))
					.onClick(() => {
						new IconPickerModal(this.app, async (icon) => {
							button.icon = icon;
							await save();
							this.plugin.refreshLaunchers();
							this.display();
						}).open();
					})
			);

		new Setting(body)
			.setName(t("settings.folder"))
			.setDesc(t("settings.folderDesc"))
			.addSearch((search) => {
				search.setPlaceholder("/").setValue(button.folder);
				search.onChange(async (value) => {
					button.folder = value.trim();
					hooks.onSummaryChange();
					await save();
				});
				new FolderSuggest(this.app, search.inputEl, async (path) => {
					button.folder = path;
					hooks.onSummaryChange();
					await save();
				});
			});

		new Setting(body)
			.setName(t("settings.template"))
			.setDesc(t("settings.templateDesc"))
			.addSearch((search) => {
				search.setPlaceholder("templates/note.md").setValue(button.template);
				search.onChange(async (value) => {
					button.template = value.trim();
					hooks.onSummaryChange();
					await save();
				});
				new FileSuggest(this.app, search.inputEl, async (path) => {
					button.template = path;
					hooks.onSummaryChange();
					await save();
				});
			});

		const nameSetting = new Setting(body).setName(t("settings.fileName"));
		const preview = createFragment((frag) => {
			frag.appendText(t("settings.fileNameDesc"));
			frag.createEl("br");
			frag.createEl("code", { cls: "nl-preview", text: this.previewName(button) });
		});
		nameSetting.setDesc(preview);
		nameSetting.addText((text) =>
			text
				.setPlaceholder("{{date}} note")
				.setValue(button.fileName)
				.onChange(async (value) => {
					button.fileName = value;
					const code = nameSetting.descEl.querySelector(".nl-preview");
					if (code) code.setText(this.previewName(button));
					await save();
				})
		);

		new Setting(body)
			.setName(t("settings.prompt"))
			.setDesc(t("settings.promptDesc"))
			.addToggle((toggle) =>
				toggle.setValue(button.promptForName).onChange(async (value) => {
					button.promptForName = value;
					await save();
				})
			);

		new Setting(body)
			.setName(t("settings.openMode"))
			.setDesc(t("settings.openModeDesc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						tab: t("open.tab"),
						same: t("open.same"),
						split: t("open.split"),
						window: t("open.window"),
						none: t("open.none"),
					})
					.setValue(button.openMode)
					.onChange(async (value) => {
						button.openMode = value as LauncherButton["openMode"];
						await save();
					})
			);

		new Setting(body)
			.setName(t("settings.onExisting"))
			.setDesc(t("settings.onExistingDesc"))
			.addDropdown((dropdown) =>
				dropdown
					.addOptions({
						increment: t("existing.increment"),
						open: t("existing.open"),
					})
					.setValue(button.onExisting)
					.onChange(async (value) => {
						button.onExisting = value as LauncherButton["onExisting"];
						await save();
					})
			);

		new Setting(body).setName(t("settings.ribbon")).addToggle((toggle) =>
			toggle.setValue(button.showInRibbon).onChange(async (value) => {
				button.showInRibbon = value;
				await save();
				this.plugin.refreshLaunchers();
			})
		);

		new Setting(body)
			.setName(t("settings.command"))
			.setDesc(t("settings.commandDesc"))
			.addToggle((toggle) =>
				toggle.setValue(button.registerCommand).onChange(async (value) => {
					button.registerCommand = value;
					await save();
					this.plugin.refreshLaunchers();
				})
			);
	}

	// ----- general -----

	private renderGeneral(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t("settings.general")).setHeading();

		new Setting(containerEl)
			.setName(t("settings.dateFormat"))
			.setDesc(this.formatDesc(t("settings.dateFormatDesc"), this.plugin.settings.dateFormat))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.dateFormat)
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (value) => {
						this.plugin.settings.dateFormat = value.trim() || DEFAULT_SETTINGS.dateFormat;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.timeFormat"))
			.setDesc(this.formatDesc(t("settings.timeFormatDesc"), this.plugin.settings.timeFormat))
			.addText((text) =>
				text
					.setPlaceholder(DEFAULT_SETTINGS.timeFormat)
					.setValue(this.plugin.settings.timeFormat)
					.onChange(async (value) => {
						this.plugin.settings.timeFormat = value.trim() || DEFAULT_SETTINGS.timeFormat;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName(t("settings.templater"))
			.setDesc(t("settings.templaterDesc"))
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.useTemplater).onChange(async (value) => {
					this.plugin.settings.useTemplater = value;
					await this.plugin.saveSettings();
				})
			);
	}

	// ----- helpers -----

	private formatDesc(desc: string, format: string): DocumentFragment {
		return createFragment((frag) => {
			frag.appendText(desc);
			frag.createEl("br");
			frag.createEl("code", { text: formatDate(new Date(), format) });
		});
	}

	private previewName(button: LauncherButton): string {
		const resolved = sanitizeFileName(
			applyPlaceholders(button.fileName || "", this.plugin.settings, "").trim()
		);
		return `${resolved || t("button.untitled")}.md`;
	}

	private summarize(button: LauncherButton): string {
		const folder = button.folder || "/";
		const template = button.template ? button.template.replace(/\.md$/, "") : "—";
		return `${folder} · ${template}`;
	}

	private async move(index: number, delta: number): Promise<void> {
		const buttons = this.plugin.settings.buttons;
		const target = index + delta;
		if (target < 0 || target >= buttons.length) return;
		[buttons[index], buttons[target]] = [buttons[target], buttons[index]];
		await this.plugin.saveSettings();
		this.plugin.refreshLaunchers();
		this.display();
	}

	private async duplicate(index: number): Promise<void> {
		const source = this.plugin.settings.buttons[index];
		const copy = { ...createButton(source.name), ...source, id: createButton("").id };
		this.plugin.settings.buttons.splice(index + 1, 0, copy);
		this.expanded.add(copy.id);
		await this.plugin.saveSettings();
		this.plugin.refreshLaunchers();
		this.display();
	}

	private async remove(index: number): Promise<void> {
		const [removed] = this.plugin.settings.buttons.splice(index, 1);
		this.expanded.delete(removed.id);
		await this.plugin.saveSettings();
		this.plugin.refreshLaunchers();
		this.display();
	}
}
