import { Diagnostic, DiagnosticSeverity, TextDocument } from 'vscode-languageserver';

function getVisualIndex(
	line: string,
	asIndex: number
): number {
	let index = 0;
	let tabSize = 4;
	for (let i = 0; i <= asIndex; i++) {
		const char = line.charAt(i);
		//console.log(`Char: '${char}', Index: ${index}, TabSize: ${tabSize}`);
		index += char === '\t' ? tabSize : 1;
		tabSize = char === '\t' ? 4 : tabSize == 1 ? 4 : tabSize-1;
	}

    return index;
}

export function getAsAlignmentDiagnostics(
	text: string,
	textDocument: TextDocument,
	maxProblems: number
): Diagnostic[] {

	let problems = 0;

	const diagnostics: Diagnostic[] = [];

	const lines = text
		.replace(/\r(?!\n)/g, '\r\n')   // lone \r → \r\n
		.replace(/(?<!\r)\n/g, '\r\n')  // lone \n → \r\n
		.split("\n");

	const loadRegex = /\bload\s/gi;
	const fromResidentRegex = /(from|resident|autogenerate)\s/gi;
	const asRegex = /[\s|"]{1}?AS\s/gi;
	const commentStartRegex = /\/\*/;
	const commentEndRegex = /\*\//;

	let inLoad = false;
	let inComment = false;
	let skipCurrentLine = false;
	let asIndexBlock = -1;
	let documentIndex = 0;

	let lineEnding = 0; // 1 = \r\n, 0 = \n

	if (new RegExp(/\r\n/).test(text)) {
		lineEnding = 1; // \n\r
	}

	for (const line of lines) {

		if (problems >= maxProblems) {
			break; // Stop if we reached the maximum number of problems
		}

		const commentMatch = line.match(commentStartRegex);
		if (commentMatch) {
			// start of block comment
			inComment = true; 
		}

		const commentEndMatch = line.match(commentEndRegex);
		if (commentEndMatch) {
			// end of block comment
			inComment = false;
			skipCurrentLine = true; // skip the line where comment ends
		}

		const matchLoad = line.match(loadRegex);
		if (matchLoad) {
			// console.log(`Found LOAD statement at index ${documentIndex}`);
			inLoad = true;
		}

		if (!inLoad) {
			documentIndex += line.length + lineEnding; // +1 for the newline character
			continue; // Skip lines that are not in a LOAD statement
		}

		const asMatch = line.match(asRegex);
		if (asMatch && !inComment && !skipCurrentLine) {
			const currentAsIndex = line.indexOf(asMatch[0]);
			const fixedAsIndex = getVisualIndex(line, line.indexOf(asMatch[0]));

			const commentIndex = line.indexOf('//');
			if(commentIndex !== -1 && currentAsIndex > commentIndex) {
				documentIndex += line.length + lineEnding;
				continue; // AS is in a comment
			}

			console.log(`Found AS at index ${currentAsIndex} (fixed index: ${fixedAsIndex})`);

			// first as in block
			if (asIndexBlock === -1) {
				asIndexBlock = fixedAsIndex;
			}
			else if (asIndexBlock !== -1 && asIndexBlock != fixedAsIndex) {
				// If AS is not aligned with the first AS in the LOAD statement
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Warning,
					range: {
						start: textDocument.positionAt(documentIndex + currentAsIndex + 1),
						end: textDocument.positionAt(documentIndex + currentAsIndex + 3)
					},
					message: `As should be alinged`,
					source: 'Qlik Linter'
				};
				diagnostics.push(diagnostic);
				problems++;
			}
		}

		const matchFrom = line.match(fromResidentRegex);
		if (matchFrom) {
			asIndexBlock = -1; // Reset if FROM or RESIDENT found
			inLoad = false;
		}

		skipCurrentLine = false; // reset skip line
		documentIndex += line.length + lineEnding; // +1 for the newline character
	}

	return diagnostics;
}