import { App, FuzzySuggestModal, Modal, Setting, getIconIds, setIcon } from "obsidian";
import { t } from "./i18n";

/** Fuzzy picker over every registered icon, with a preview of each. */
export class IconPickerModal extends FuzzySuggestModal<string> {
	constructor(
		app: App,
		private readonly onChoose: (icon: string) => void
	) {
		super(app);
		this.setPlaceholder(t("icon.title"));
		this.limit = 60;
	}

	getItems(): string[] {
		return getIconIds();
	}

	getItemText(icon: string): string {
		return prettyIconName(icon);
	}

	renderSuggestion(match: { item: string }, el: HTMLElement): void {
		const wrapper = el.createDiv("nl-icon-suggestion");
		const preview = wrapper.createSpan("nl-icon-preview");
		setIcon(preview, match.item);
		wrapper.createSpan({ text: prettyIconName(match.item) });
	}

	onChooseItem(icon: string): void {
		this.onChoose(icon);
	}
}

export function prettyIconName(icon: string): string {
	return icon.replace(/^lucide-/, "").replace(/-/g, " ");
}

/** Single-field prompt used when a button asks for the note name. */
export class NamePromptModal extends Modal {
	private value: string;
	private submitted = false;

	constructor(
		app: App,
		initialValue: string,
		private readonly onSubmit: (value: string) => void
	) {
		super(app);
		this.value = initialValue;
	}

	onOpen(): void {
		this.setTitle(t("prompt.title"));
		const { contentEl } = this;

		const input = new Setting(contentEl).addText((text) => {
			text.setValue(this.value).onChange((v) => (this.value = v));
			text.inputEl.addClass("nl-prompt-input");
			text.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					this.submit();
				}
			});
			window.setTimeout(() => {
				text.inputEl.focus();
				text.inputEl.select();
			}, 0);
		});
		input.settingEl.addClass("nl-prompt-setting");

		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText(t("prompt.cancel")).onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText(t("prompt.create"))
					.setCta()
					.onClick(() => this.submit())
			);
	}

	private submit(): void {
		const value = this.value.trim();
		if (!value) return;
		this.submitted = true;
		this.close();
		this.onSubmit(value);
	}

	onClose(): void {
		this.contentEl.empty();
		if (!this.submitted) {
			// Cancelled: nothing to do, the caller simply never runs.
		}
	}
}
