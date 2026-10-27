import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const result = await build({
	stdin: { contents: 'export { NoteLauncherSettingTab } from "./src/settings"; export { createButton, DEFAULT_SETTINGS } from "./src/types";', resolveDir: fileURLToPath(new URL("..", import.meta.url)) },
	bundle: true, write: false, format: "esm", platform: "node",
	alias: { obsidian: fileURLToPath(new URL("./obsidian-stub.ts", import.meta.url)) },
});
const { NoteLauncherSettingTab, createButton, DEFAULT_SETTINGS } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
function setup() {
	const plugin = {
		settings: { ...DEFAULT_SETTINGS, buttons: [createButton("Journal"), createButton("Meeting")] },
		saves: 0, refreshes: 0,
		async saveSettings() { this.saves++; },
		refreshLaunchers() { this.refreshes++; },
	};
	return { plugin, tab: new NoteLauncherSettingTab({}, plugin) };
}

test("all existing button fields and general settings are discoverable without reading the vault", () => {
	const { plugin, tab } = setup();
	const before = JSON.stringify(plugin.settings);
	const definitions = tab.getSettingDefinitions();
	assert.deepEqual(definitions.slice(0, 3).map((def) => def.control.key), ["dateFormat", "timeFormat", "useTemplater"]);
	const groups = definitions.filter((def) => def.type === "group");
	assert.equal(groups.length, 2);
	for (const group of groups) {
		assert.equal(group.items.length, 10);
		assert.ok(group.items.every((item) => item.name && item.searchable !== false));
		assert.ok(group.items.some((item) => item.control?.type === "folder" && item.control.includeRoot));
		assert.ok(group.items.some((item) => item.control?.type === "file" && item.control.filter({ extension: "md" }) && !item.control.filter({ extension: "png" })));
	}
	assert.equal(JSON.stringify(plugin.settings), before);
	assert.equal(plugin.saves, 0);
});

test("controls keep their button identity after reordering and persist changes", async () => {
	const { plugin, tab } = setup();
	const original = plugin.settings.buttons[0];
	const key = `button:${original.id}:folder`;
	plugin.settings.buttons.reverse();
	await tab.setControlValue(key, " journal/{{date:YYYY}} ");
	assert.equal(original.folder, "journal/{{date:YYYY}}");
	assert.equal(plugin.settings.buttons[0].folder, "");
	assert.equal(tab.getControlValue(key), original.folder);
	assert.equal(plugin.saves, 1);
	assert.equal(plugin.refreshes, 0);
	await tab.setControlValue(`button:${original.id}:showInRibbon`, false);
	assert.equal(original.showInRibbon, false);
	assert.equal(plugin.refreshes, 1);
});

test("stale controls cannot mutate a different button or recreate a deleted one", async () => {
	const { plugin, tab } = setup();
	const deleted = plugin.settings.buttons.shift();
	await tab.setControlValue(`button:${deleted.id}:name`, "Changed");
	assert.equal(tab.getControlValue(`button:${deleted.id}:name`), undefined);
	assert.equal(plugin.settings.buttons.length, 1);
	assert.equal(plugin.settings.buttons[0].name, "Meeting");
	assert.equal(plugin.saves, 0);
});

test("text defaults and enum/boolean validation preserve stored settings", async () => {
	const { plugin, tab } = setup();
	const button = plugin.settings.buttons[0];
	await tab.setControlValue("dateFormat", "  ");
	await tab.setControlValue("timeFormat", " HH:mm:ss ");
	assert.equal(plugin.settings.dateFormat, DEFAULT_SETTINGS.dateFormat);
	assert.equal(plugin.settings.timeFormat, "HH:mm:ss");
	for (const [field, value] of [["openMode", "bad"], ["onExisting", "overwrite"], ["showInRibbon", "false"], ["id", "changed"]]) {
		await tab.setControlValue(`button:${button.id}:${field}`, value);
	}
	assert.equal(button.openMode, "tab");
	assert.equal(button.onExisting, "increment");
	assert.equal(button.showInRibbon, true);
	assert.notEqual(button.id, "changed");
	assert.equal(plugin.saves, 2);
});

test("adding, duplicating, moving and deleting preserve button configuration", async () => {
	const { plugin, tab } = setup();
	let updates = 0;
	tab.update = () => { updates++; };
	const settle = () => new Promise((resolve) => setImmediate(resolve));
	const invoke = (configure) => {
		let click;
		const btn = { setButtonText() { return this; }, setCta() { return this; }, setIcon() { return this; }, setTooltip() { return this; }, setDisabled() { return this; }, onClick(fn) { click = fn; return this; } };
		configure(btn);
		click();
	};
	const source = plugin.settings.buttons[0];
	source.template = "templates/journal.md";
	invoke(tab.getSettingDefinitions().find((def) => def.type === "group").extraButtons[2]);
	await settle();
	assert.equal(plugin.settings.buttons.length, 3);
	assert.equal(plugin.settings.buttons[1].template, source.template);
	assert.notEqual(plugin.settings.buttons[1].id, source.id);
	invoke(tab.getSettingDefinitions().find((def) => def.type === "group").extraButtons[1]);
	await settle();
	assert.equal(plugin.settings.buttons[1].id, source.id);
	invoke(tab.getSettingDefinitions().find((def) => def.type === "group").extraButtons[3]);
	await settle();
	assert.equal(plugin.settings.buttons.length, 2);
	assert.equal(updates, 3);
	tab.getSettingDefinitions()[3].render({ addButton: (configure) => { invoke(configure); } });
	await settle();
	assert.equal(plugin.settings.buttons.length, 3);
	assert.equal(plugin.settings.buttons[2].name, "New button");
	assert.equal(updates, 4);
});
