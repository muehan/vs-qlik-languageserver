import { Diagnostic, DiagnosticSeverity, TextDocument } from 'vscode-languageserver';

function getCommentRanges(text: string): { start: number; end: number }[] {
	const ranges: { start: number; end: number }[] = [];

	const singleLineCommentRegex = /\/\/.*/g;
	const multiLineCommentRegex = /\/\*[\s\S]*?\*\//g;

	let match: RegExpExecArray | null;

	while ((match = singleLineCommentRegex.exec(text)) !== null) {
		const start = match.index;
		const end = match.index + match[0].length;
		ranges.push({ start, end });
	}

	while ((match = multiLineCommentRegex.exec(text)) !== null) {
		const start = match.index;
		const end = match.index + match[0].length;
		ranges.push({ start, end });
	}

	return ranges;
}

function isInComment(offset: number, commentRanges: { start: number; end: number }[]): boolean {
	return commentRanges.some(range => offset >= range.start && offset < range.end);
}

/// Checks if the given index is inside a string literal in the provided text.
/// @param index - The index to check.
/// @param text - The text to check against.
/// @returns True if the index is inside a string, false otherwise.
/// check char by char until we hit the index and see if we are in a string
/// maybe there is a performance issue with this, but it should be fine for small texts
function isInString(index: number, text: string): boolean {
	let inString = false;
	let stringChar = '';
	let escapeNext = false;

	for (let i = 0; i < text.length; i++) {
		if (i === index) {
			// hit the index we are checking
			return inString;
		}

		const char = text[i];

		if (escapeNext) {
			escapeNext = false;
			continue;
		}

		// currently inside a string
		if (inString) {
			if (char === '\\') {
				escapeNext = true;
			} else if (char === stringChar) {
				inString = false;
				stringChar = '';
			}
		} else {
			// Not inside a string currently
			if (char === '\'' || char === '"') {
				inString = true;
				stringChar = char;
			}
		}
	}

	// If offset is beyond the text length or after end of string, return false
	return false;
}

export function getKeywordUppercaseDiagnostics(
	text: string,
	textDocument: TextDocument,
	maxProblems: number,
	qlikKeywords: string[]
): Diagnostic[] {
	const diagnostics: Diagnostic[] = [];
	const keywordRegex = new RegExp(`\\b(${qlikKeywords.join('|')})\\b`, 'gi');

	const commentRanges = getCommentRanges(text);
	let match: RegExpExecArray | null;
	let problems = 0;

	while ((match = keywordRegex.exec(text)) !== null && problems < maxProblems) {
		const keyword = match[0];
		const index = match.index;

		if (isInComment(index, commentRanges)) {
			continue;
		}

		if (isInString(index, text)) {
			continue;
		}

		if (keyword !== keyword.toUpperCase()) {
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Warning,
				range: {
					start: textDocument.positionAt(index),
					end: textDocument.positionAt(index + keyword.length)
				},
				message: `Qlik keyword "${keyword}" should be uppercase.`,
				source: 'Qlik Linter'
			};
			diagnostics.push(diagnostic);
			problems++;
		}
	}

	return diagnostics;
}
