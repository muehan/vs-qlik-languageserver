import { Diagnostic, DiagnosticSeverity, TextDocument } from 'vscode-languageserver';

function getVisualIndex(
	line: string,
	rawIndex: number,
	tabSize = 4
): number {
    let visualCol = 0;
	for (let i = 0; i < rawIndex; i++) {
        if (line[i] === "\t") {
            visualCol += tabSize - (visualCol % tabSize);
        } else {
            visualCol += 1;
        }
    }

    return visualCol;
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
	const fromResidentRegex = /(from|resident)\s/gi;
	const asRegex = /[\s|"]{1}?AS\s/gi;

	let inLoad = false;
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
		if (asMatch) {
			const currentAsIndex = line.indexOf(asMatch[0]);
			const fixedAsIndex = getVisualIndex(line, currentAsIndex, 4);

			console.log(`Found AS at index ${documentIndex + currentAsIndex} (fixed index: ${fixedAsIndex})`);

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

		documentIndex += line.length + lineEnding; // +1 for the newline character
	}

	return diagnostics;
}