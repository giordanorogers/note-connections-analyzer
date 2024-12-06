import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	apiKey: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	apiKey: ''
}

export default class NoteConnectionsPlugin extends Plugin {
	settings: MyPluginSettings;

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onload() {
		await this.loadSettings();

		// Add ribbon icon for triggering analysis
		this.addRibbonIcon('brain-circuit', 'Analyze Note Connections', async () => {
			try {
				if (!this.settings.apiKey) {
					new Notice('Please set your OpenAI API key in the plugin settings');
					return;
				}

				// Get random notes
				const notes = await this.getRandomNotes(10);
				if (notes.length === 0) {
					new Notice('No notes found in vault');
					return;
				}

				new Notice(`Analyzing ${notes.length} notes...`);
				
				// Generate prompt and get GPT-4 analysis
				const noteContents = await Promise.all(notes.map(file => 
					this.app.vault.read(file)
				));
				
				const response = await this.analyzeWithGPT4(noteContents);
				
				// Create new note with analysis
				const analysisNote = await this.app.vault.create(
					`Note Connections Analysis ${new Date().toISOString().split('T')[0]}.md`,
					this.formatAnalysis(notes, response)
				);
				
				// Open the new note
				await this.app.workspace.getLeaf().openFile(analysisNote);
				
			} catch (error) {
				new Notice(`Error: ${error.message}`);
				console.error(error);
			}
		});

		// Add settings tab
		this.addSettingTab(new NoteConnectionsSettingTab(this.app, this));
	}

	private async getRandomNotes(count: number): Promise<TFile[]> {
		const files = this.app.vault.getMarkdownFiles();
		const shuffled = files.sort(() => 0.5 - Math.random());
		return shuffled.slice(0, Math.min(count, files.length));
	}

	private async analyzeWithGPT4(noteContents: string[]): Promise<string> {
		const prompt = `I am sending you ten random notes from my knowledge database. Your goal is to extract and identify novel, unconventional, and interesting connections between the ideas presented in the notes. These connections should be concise yet insightful and challenge conventional thinking, revealing patterns, relationships, or implications I may not have noticed. Avoid generic or obvious observations and focus on linking the ideas in ways that are intellectually stimulating and potentially actionable. Provide a summary of your findings, highlighting the most unique and valuable insights.
Notes:

${noteContents.map((content, i) => `Note ${i + 1}:\n${content}\n---`).join('\n')}`;

		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.settings.apiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: 'gpt-4',
				messages: [{
					role: 'user',
					content: prompt
				}],
				temperature: 0.7
			})
		});

		if (!response.ok) {
			throw new Error('Failed to get response from GPT-4');
		}

		const data = await response.json();
		return data.choices[0].message.content;
	}

	private formatAnalysis(files: TFile[], analysis: string): string {
		return `# Note Connections Analysis

## Analyzed Notes
${files.map(file => `- [[${file.basename}]]`).join('\n')}

## Analysis
${analysis}
`;
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class NoteConnectionsSettingTab extends PluginSettingTab {
	plugin: NoteConnectionsPlugin;

	constructor(app: App, plugin: NoteConnectionsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Enter your OpenAI API key for GPT-4 access')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}
