export class App {}
export class Notice {}
export class PluginSettingTab {
	constructor(public app: unknown, private owner: { settings: Record<string, unknown>; saveSettings(): Promise<void> }) {}
	getControlValue(key: string): unknown { return this.owner.settings[key]; }
	async setControlValue(key: string, value: unknown): Promise<void> {
		this.owner.settings[key] = value;
		await this.owner.saveSettings();
	}
	update(): void {}
}
export class Modal {}
export class FuzzySuggestModal {}
export class Setting {}
export class TFile {}
export class TFolder {}
export const getLanguage = () => "en";
export const getIconIds = () => [];
export const setIcon = () => {};
export const normalizePath = (path: string) => path;
export const moment = () => ({ format: () => "2026-10-27" });
