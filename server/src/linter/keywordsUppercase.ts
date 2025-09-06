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

function isInTrace(index: number, text: string): boolean {
	let currentPos = 0; // track position in text

    // Split text by lines
    const lines = text.split(/\r?\n/);

    for (const line of lines) {
        const lineLength = line.length + 1; // +1 for newline character

        if (index < currentPos + lineLength) {
            // The index is inside this line
            return /^\s*trace\s+/i.test(line);
        }

        currentPos += lineLength;
    }

    // index beyond text
    return false;
}

/**
 * Checks if the given index is inside an XLSX import options line.
 * Example:
 * (ooxml, embedded labels, table is Sheet1);
 */
function IsXlsxImport(index: number, text: string): boolean {
    // Find the line containing the index
    const beforeIndex = text.slice(0, index);
    const lineStart = beforeIndex.lastIndexOf("\n") + 1;
    const lineEnd = text.indexOf("\n", index);
    const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).trim();

    // Match lines that start with "(" and contain "ooxml"
    return /^\(.*ooxml.*\);?$/i.test(line);
}

/**
 * Linter function to check for Qlik keywords that are not uppercase.
 * @param text The text content of the document.
 * @param textDocument The TextDocument object.
 * @param maxProblems The maximum number of problems to report.
 * @param qlikKeywords An array of Qlik keywords to check against.
 * @returns An array of Diagnostic objects for each keyword that is not uppercase.
 */
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

		if (isInComment(index, commentRanges)) {continue;}
		if (isInTrace(index, text)) {continue;}
		if (isInString(index, text)) {continue;}
		if (IsXlsxImport(index, text)) {continue;}

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
