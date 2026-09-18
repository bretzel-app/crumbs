/**
 * Custom tooltip action — drop-in replacement for title attributes.
 * Usage: <button use:tooltip={"Label"}>
 * Or with options: <button use:tooltip={{ text: "Label", position: "bottom" }}>
 */

export type TooltipPosition = 'top' | 'bottom';

interface TooltipOptions {
	text: string;
	position?: TooltipPosition;
}

function parseOptions(value: string | TooltipOptions): { text: string; position: TooltipPosition } {
	if (typeof value === 'string') return { text: value, position: 'top' };
	return { text: value.text, position: value.position ?? 'top' };
}

export function tooltip(node: HTMLElement, value: string | TooltipOptions) {
	let opts = parseOptions(value);
	let el: HTMLDivElement | null = null;
	let timeout: ReturnType<typeof setTimeout> | undefined;

	function show() {
		timeout = setTimeout(() => {
			if (!opts.text) return;
			el = document.createElement('div');
			el.className = 'tooltip-popup';
			el.textContent = opts.text;
			document.body.appendChild(el);
			position();
		}, 400);
	}

	function position() {
		if (!el) return;
		const rect = node.getBoundingClientRect();
		const tipRect = el.getBoundingClientRect();

		let top: number;
		if (opts.position === 'bottom') {
			top = rect.bottom + 6;
		} else {
			top = rect.top - tipRect.height - 6;
		}

		let left = rect.left + rect.width / 2 - tipRect.width / 2;
		// Clamp to viewport
		left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

		el.style.top = `${top}px`;
		el.style.left = `${left}px`;
		el.classList.add('tooltip-visible');
	}

	function hide() {
		clearTimeout(timeout);
		if (el) {
			el.remove();
			el = null;
		}
	}

	node.addEventListener('mouseenter', show);
	node.addEventListener('mouseleave', hide);
	node.addEventListener('pointerdown', hide);
	// Remove native title to prevent double tooltip
	const nativeTitle = node.getAttribute('title');
	if (nativeTitle) node.removeAttribute('title');

	// Removing `title` also removed the only accessible name most icon-only
	// buttons had (RGAA 11.9 / WCAG 4.1.2). The tooltip text is that name, so
	// expose it to assistive tech unless the element already names itself.
	const ownsLabel = !node.hasAttribute('aria-label') && !node.hasAttribute('aria-labelledby') && !node.textContent?.trim();
	function syncLabel() {
		if (ownsLabel) node.setAttribute('aria-label', opts.text);
	}
	syncLabel();

	return {
		update(newValue: string | TooltipOptions) {
			opts = parseOptions(newValue);
			syncLabel();
		},
		destroy() {
			hide();
			node.removeEventListener('mouseenter', show);
			node.removeEventListener('mouseleave', hide);
			node.removeEventListener('pointerdown', hide);
			if (ownsLabel) node.removeAttribute('aria-label');
			if (nativeTitle) node.setAttribute('title', nativeTitle);
		}
	};
}
