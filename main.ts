import { App, Plugin, Notice } from "obsidian";
import { Decoration, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

export default class DicePlugin extends Plugin {
	onload() {
		console.log("Loading Dice Plugin");

		// Reading view (preview)
		this.registerMarkdownPostProcessor((el) => {
			const diceRegex = /(\d+[dк]\d+([\+\-]\d+)?)/ig;
			el.querySelectorAll("p, li").forEach((block) => {
				block.innerHTML = block.innerHTML.replace(diceRegex, (match) => {
					return `<span class="clickable-dice" data-dice-formula="${match}">${match}</span>`;
				});
			});
		});

		// Live Preview (editor)
		this.registerEditorExtension(this.createLivePreviewPlugin());

		// Handle clicks globally
		document.addEventListener("click", (evt) => {
			const target = evt.target as HTMLElement;
			if (target.classList.contains("clickable-dice")) {
				const formula = target.getAttribute("data-dice-formula");
				if (formula) {
					const rollResult = this.rollDice(formula);

					// Create styled notice
					const notice = new Notice(rollResult.text, 8000);
					// Add CSS class for criticals
					if (rollResult.cssClass) {
						notice.noticeEl.classList.add(rollResult.cssClass);
					}
				}
			}
		});
	}

	rollDice(formula: string): { text: string; cssClass?: string } {
		const match = formula.match(/(\d+)[dк](\d+)([+-]\d+)?/i);
		if (!match) return { text: "Invalid dice formula" };

		const num = parseInt(match[1], 10);
		const sides = parseInt(match[2], 10);
		const modifier = match[3] ? parseInt(match[3], 10) : 0;

		let rolls: number[] = [];
		let baseSum = 0;
		for (let i = 0; i < num; i++) {
			const roll = Math.floor(Math.random() * sides) + 1;
			rolls.push(roll);
			baseSum += roll;
		}
		const finalSum = baseSum + modifier;

		// Pretty breakdown
		let noticeText = `🎲 ${formula}\n`;
		noticeText += `Rolls: [${rolls.join("] [")}]\n`;
		noticeText += `Sum: ${baseSum}`;
		if (modifier !== 0) {
			noticeText += ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}`;
		}
		noticeText += ` = ${finalSum}`;

		// Detect critical success/failure (only if it's 1d20 ± modifier)
		let cssClass: string | undefined;
		if (num === 1 && sides === 20) {
			if (rolls[0] === 20) cssClass = "dice-critical-success";
			if (rolls[0] === 1) cssClass = "dice-critical-fail";
		}

		return { text: noticeText, cssClass };
	}


	createLivePreviewPlugin() {
		const diceRegex = /(\d+[dк]\d+([\+\-]\d+)?)/ig;

		return ViewPlugin.fromClass(class {
			decorations;

			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}
			buildDecorations(view: EditorView) {
				const builder = new RangeSetBuilder<Decoration>();
				for (let { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					let match;
					while ((match = diceRegex.exec(text)) !== null) {
						const start = from + match.index;
						const end = start + match[0].length;
						builder.add(
							start,
							end,
							Decoration.mark({
								class: "clickable-dice",
								attributes: { "data-dice-formula": match[0] }
							})
						);
					}
				}
				return builder.finish();
			}
		}, {
			decorations: v => v.decorations
		});
	}
}
