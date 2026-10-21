// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getSelectionOffsets, setCaretOffset } from '$lib/utils/caret.js';

function row(html: string): HTMLElement {
	const el = document.createElement('div');
	el.innerHTML = html;
	document.body.appendChild(el);
	return el;
}

function select(startNode: Node, startOffset: number, endNode = startNode, endOffset = startOffset) {
	const range = document.createRange();
	range.setStart(startNode, startOffset);
	range.setEnd(endNode, endOffset);
	const sel = window.getSelection()!;
	sel.removeAllRanges();
	sel.addRange(range);
}

beforeEach(() => {
	document.body.innerHTML = '';
});

describe('getSelectionOffsets', () => {
	it('returns the caret position as a character offset', () => {
		const el = row('Buy milk');
		select(el.firstChild!, 4);
		expect(getSelectionOffsets(el)).toEqual({ start: 4, end: 4 });
	});

	it('counts the text of links before the caret', () => {
		const el = row('Visit <a href="https://example.com">example.com</a> now');
		select(el.lastChild!, 1);
		expect(getSelectionOffsets(el)).toEqual({ start: 18, end: 18 });
	});

	it('returns both ends of a selection', () => {
		const el = row('Milk, eggs');
		select(el.firstChild!, 4, el.firstChild!, 6);
		expect(getSelectionOffsets(el)).toEqual({ start: 4, end: 6 });
	});

	it('returns null when the selection is in another element', () => {
		const el = row('Milk');
		const other = row('Eggs');
		select(other.firstChild!, 2);
		expect(getSelectionOffsets(el)).toBeNull();
	});

	it('returns null when the selection only starts in the element', () => {
		const el = row('Milk');
		const other = row('Eggs');
		select(el.firstChild!, 2, other.firstChild!, 2);
		expect(getSelectionOffsets(el)).toBeNull();
	});
});

describe('setCaretOffset', () => {
	it('places the caret inside a link when the offset falls there', () => {
		const el = row('Visit <a href="https://example.com">example.com</a> now');
		setCaretOffset(el, 8);
		const sel = window.getSelection()!;
		expect(sel.isCollapsed).toBe(true);
		expect(sel.focusNode).toBe(el.querySelector('a')!.firstChild);
		expect(sel.focusOffset).toBe(2);
	});

	it('places the caret at the end when the offset is past the text', () => {
		const el = row('Milk');
		setCaretOffset(el, 99);
		expect(getSelectionOffsets(el)).toEqual({ start: 4, end: 4 });
	});

	it('places the caret inside an empty element', () => {
		const el = row('');
		setCaretOffset(el, 0);
		expect(getSelectionOffsets(el)).toEqual({ start: 0, end: 0 });
	});
});
