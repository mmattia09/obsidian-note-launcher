import { AbstractInputSuggest, App, TFile, TFolder, setIcon } from "obsidian";

/** Autocompletes vault folders in a text input. */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	constructor(
		app: App,
		private readonly inputEl: HTMLInputElement,
		private readonly onPick: (path: string) => void
	) {
		super(app, inputEl);
	}

	protected getSuggestions(query: string): TFolder[] {
		const q = query.toLowerCase();
		return this.app.vault
			.getAllFolders(true)
			.filter((f) => f.path.toLowerCase().includes(q))
			.sort((a, b) => a.path.localeCompare(b.path))
			.slice(0, 100);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		const wrapper = el.createDiv("nl-suggestion");
		const icon = wrapper.createSpan("nl-suggestion-icon");
		setIcon(icon, "lucide-folder");
		wrapper.createSpan({ text: folder.isRoot() ? "/" : folder.path });
	}

	selectSuggestion(folder: TFolder): void {
		const path = folder.isRoot() ? "" : folder.path;
		this.inputEl.value = path;
		this.onPick(path);
		this.close();
	}
}

/** Autocompletes markdown files (used to pick a template). */
export class FileSuggest extends AbstractInputSuggest<TFile> {
	constructor(
		app: App,
		private readonly inputEl: HTMLInputElement,
		private readonly onPick: (path: string) => void
	) {
		super(app, inputEl);
	}

	protected getSuggestions(query: string): TFile[] {
		const q = query.toLowerCase();
		return this.app.vault
			.getMarkdownFiles()
			.filter((f) => f.path.toLowerCase().includes(q))
			.sort((a, b) => a.path.localeCompare(b.path))
			.slice(0, 100);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		const wrapper = el.createDiv("nl-suggestion");
		const icon = wrapper.createSpan("nl-suggestion-icon");
		setIcon(icon, "lucide-file-text");
		wrapper.createSpan({ text: file.basename });
		wrapper.createSpan({ cls: "nl-suggestion-path", text: file.parent?.path ?? "" });
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.path;
		this.onPick(file.path);
		this.close();
	}
}
