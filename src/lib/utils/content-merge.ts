import { diff3Merge } from 'node-diff3';

/**
 * Resolve a conflict region by comparing each line against the base.
 * If only one side changed a line, take that change.
 * If both sides changed the same line, prefer remote (LWW).
 * Handles different-length regions by appending extra lines.
 */
function resolveConflict(
	aLines: string[],
	oLines: string[],
	bLines: string[]
): string[] {
	const maxLen = Math.max(aLines.length, bLines.length, oLines.length);
	const result: string[] = [];

	for (let i = 0; i < maxLen; i++) {
		const a = i < aLines.length ? aLines[i] : undefined;
		const o = i < oLines.length ? oLines[i] : undefined;
		const b = i < bLines.length ? bLines[i] : undefined;

		const aChanged = a !== o;
		const bChanged = b !== o;

		if (aChanged && !bChanged && a !== undefined) {
			// Only local changed this line — take local
			result.push(a);
		} else if (bChanged && !aChanged && b !== undefined) {
			// Only remote changed this line — take remote
			result.push(b);
		} else if (aChanged && bChanged) {
			// Both changed — LWW: prefer remote
			if (b !== undefined) result.push(b);
			// If remote deleted (undefined) but local has it, skip (remote wins)
		} else {
			// Neither changed, or both are the same as base
			if (o !== undefined) result.push(o);
			else if (b !== undefined) result.push(b);
			else if (a !== undefined) result.push(a);
		}
	}

	return result;
}

/**
 * 3-way line-level merge for note content.
 * Takes a base (common ancestor), local (incoming), and remote (server current).
 * For conflict regions, resolves line-by-line: if only one side changed a line,
 * take that change. If both changed the same line, prefer remote (LWW).
 */
export function mergeContent(base: string, local: string, remote: string): string {
	// If any two are identical, short-circuit
	if (local === remote) return remote;
	if (local === base) return remote;
	if (remote === base) return local;

	const baseLines = base.split('\n');
	const localLines = local.split('\n');
	const remoteLines = remote.split('\n');

	const regions = diff3Merge(localLines, baseLines, remoteLines);
	const merged: string[] = [];

	for (const region of regions) {
		if (region.ok) {
			merged.push(...region.ok);
		} else if (region.conflict) {
			merged.push(...resolveConflict(
				region.conflict.a,
				region.conflict.o,
				region.conflict.b
			));
		}
	}

	return merged.join('\n');
}

/**
 * Merge an incoming content snapshot into the current server content.
 *
 * Uses a 3-way merge when a base (common ancestor) is available. Without a base —
 * e.g. the base snapshot was pruned, or the version was bumped by a metadata-only
 * change that created no snapshot — a 3-way merge is impossible, so keep the
 * incoming edit rather than silently discarding the user's changes.
 */
export function mergeContentUpdate(input: {
	baseContent: string | null;
	incomingContent: string;
	currentContent: string;
}): string {
	const { baseContent, incomingContent, currentContent } = input;

	if (incomingContent === currentContent) return currentContent;
	if (baseContent === incomingContent) return currentContent;
	if (baseContent === currentContent) return incomingContent;

	if (baseContent === null) {
		console.warn('[content-merge] no base snapshot for concurrent edit; keeping incoming content');
		return incomingContent;
	}

	return mergeContent(baseContent, incomingContent, currentContent);
}
