// Caret positions inside a contenteditable row, as plain-text character offsets. A row's
// text can be split across nodes (linkified URLs render as <a> elements), so offsets are
// measured over the row's whole text rather than within a single node.

/** The current selection as offsets into `el`'s text, or null if it isn't entirely inside `el`. */
export function getSelectionOffsets(el: HTMLElement): { start: number; end: number } | null {
	const sel = window.getSelection();
	if (!sel?.rangeCount) return null;
	const range = sel.getRangeAt(0);
	if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
	const prefix = document.createRange();
	prefix.selectNodeContents(el);
	prefix.setEnd(range.startContainer, range.startOffset);
	const start = prefix.toString().length;
	prefix.setEnd(range.endContainer, range.endOffset);
	return { start, end: prefix.toString().length };
}

/** Collapse the selection to `offset` characters into `el`'s text, or its end if shorter. */
export function setCaretOffset(el: HTMLElement, offset: number) {
	const range = document.createRange();
	range.selectNodeContents(el);
	range.collapse(false);
	const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
	let remaining = offset;
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const length = node.textContent?.length ?? 0;
		if (remaining <= length) {
			range.setStart(node, remaining);
			range.collapse(true);
			break;
		}
		remaining -= length;
	}
	const sel = window.getSelection();
	sel?.removeAllRanges();
	sel?.addRange(range);
}
