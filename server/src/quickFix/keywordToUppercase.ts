import {
	CodeAction,
	CodeActionKind,
	CodeActionParams,
	Diagnostic,
	Position,
	TextEdit,
	WorkspaceEdit
} from 'vscode-languageserver/node';

function positionToOffset(text: string, position: Position): number {
	const isWindows = text.includes('\r\n');
	const lineEndingLength = isWindows ? 2 : 1;

	const lines = text.split(/\r?\n/g);
	let offset = 0;
	
	for (let i = 0; i < position.line; i++) {
		offset += lines[i].length + lineEndingLength;
	}
	
	offset += position.character;

	return offset;
}

export function getUppercaseQuickfix(
	diagnostics: Diagnostic[],
	text: string,
	params: CodeActionParams,
	codeActions: CodeAction[]) {

	diagnostics.forEach(diagnostic => {
		if (
			diagnostic.message.startsWith('Qlik keyword') &&
			diagnostic.message.includes('should be uppercase')
		) {
			const range = diagnostic.range;
			const startOffset = positionToOffset(text, range.start);
			const endOffset = positionToOffset(text, range.end);
			const keyword = text.substring(startOffset, endOffset);
			const uppercaseKeyword = keyword.toUpperCase().trim();

			const edit: WorkspaceEdit = {
				changes: {
					[params.textDocument.uri]: [
						TextEdit.replace(range, uppercaseKeyword)
					]
				}
			};

			codeActions.push({
				title: `Convert "${keyword}" to "${uppercaseKeyword}"`,
				kind: CodeActionKind.QuickFix,
				diagnostics: [diagnostic],
				edit
			});
		}
	});

	return codeActions;
}