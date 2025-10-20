import { TextDocument } from 'vscode-languageserver-textdocument';
import { ITokenData } from './ITokenData';

/**
 * Extracts multiline comment tokens from the given text and document.
 * 
 * @param text - The text content to analyze for multiline comments.
 * @param document - The TextDocument containing the text.
 * @param lines - An array of lines from the text document.
 * @returns An array of ITokenData representing the multiline comment tokens.
 */
export function multilineCommentToken(
	text: string,
	document: TextDocument,
	lines: string[]): ITokenData[] {

	const tokenData: ITokenData[] = [];

  //const multiLineCommentRegex = /\/\*[\s\S]*?\*\//g;
    const multiLineCommentRegex = /(?<![/\w])\/\*[\s\S]*?\*\//g;

	let match;
	while ((match = multiLineCommentRegex.exec(text)) !== null) {
		console.log('Multiline comment match: ' + match[0]);
		const startOffset = match.index;
		const endOffset = match.index + match[0].length;

		const startPosition = document.positionAt(startOffset);
		const endPosition = document.positionAt(endOffset);

		if (startPosition.line !== endPosition.line) {
			for (let line = startPosition.line; line <= endPosition.line; line++) {
				const lineStart = (line === startPosition.line) ? startPosition.character : 0;
				const lineEnd = (line === endPosition.line)
					? endPosition.character
					: lines[line].length;

				tokenData.push({
					line,
					startChar: lineStart,
					length: lineEnd - lineStart,
					tokenType: "comment",
				});
			}
		}
	}

	return tokenData;
}
