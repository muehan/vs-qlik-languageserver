/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	DocumentDiagnosticReportKind,
	SemanticTokensBuilder,
	SemanticTokensLegend,
	type DocumentDiagnosticReport,
	CodeAction
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
	getKeywordUppercaseDiagnostics
} from './linter/keywordsUppercase';

import * as fs from 'fs';
import * as path from 'path';
import { getUppercaseQuickfix } from './quickFix/keywordToUppercase';

let qlikKeywords: string[] = [];

try {
	const csvPath = path.resolve(__dirname, 'qlik_keywords.csv');
	const csvData = fs.readFileSync(csvPath, 'utf8');
	qlikKeywords = csvData.split(/\r?\n/).filter(Boolean);
} catch (error) {
	console.error("Failed to load Qlik keywords CSV:", error);
}

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

const tokenTypes = ["keyword", "variable", "function", "string", "comment", "class", "parameter", "property", "decorator"];
const tokenModifiers: string[] = [];

const legend: SemanticTokensLegend = { tokenTypes, tokenModifiers };

connection.onInitialize((params: InitializeParams) => {

	console.log("[Server] onInitialize");
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false
			},
			semanticTokensProvider: {
				legend,
				range: false, // Change to true if you want partial updates
				full: true
			},
			codeActionProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface QlikLanguageServerSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: QlikLanguageServerSettings = { maxNumberOfProblems: 1000 };
let globalSettings: QlikLanguageServerSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings = new Map<string, Thenable<QlikLanguageServerSettings>>();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = (
			(change.settings.qliklanguageServer || defaultSettings)
		);
	}
	// Refresh the diagnostics since the `maxNumberOfProblems` could have changed.
	// We could optimize things here and re-fetch the setting first can compare it
	// to the existing setting, but this is out of scope for this example.
	connection.languages.diagnostics.refresh();
});

function getDocumentSettings(resource: string): Thenable<QlikLanguageServerSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'qliklanguageServer'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

connection.languages.diagnostics.on(async (params) => {
	const document = documents.get(params.textDocument.uri);
	if (document !== undefined) {
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: await validateTextDocument(document)
		} satisfies DocumentDiagnosticReport;
	} else {
		// We don't know the document. We can either try to read it from disk
		// or we don't report problems for it.
		return {
			kind: DocumentDiagnosticReportKind.Full,
			items: []
		} satisfies DocumentDiagnosticReport;
	}
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
	const settings = await getDocumentSettings(textDocument.uri);
	const text = textDocument.getText();

	// Collect diagnostics from all checkers
	const diagnostics: Diagnostic[] = [];

	// Check for lowercase keywords
	diagnostics.push(...getKeywordUppercaseDiagnostics(text, textDocument, settings.maxNumberOfProblems, qlikKeywords));

	// Add other diagnostic checks here in future, if needed

	return diagnostics;
}


// Add this handler after your other connection handlers
connection.onCodeAction(async (params) => {

	const document = documents.get(params.textDocument.uri);
	if (!document) {
		return [];
	}

	const diagnostics = params.context.diagnostics;
	const text = document.getText();
	const codeActions: CodeAction[] = [];

	getUppercaseQuickfix(
		diagnostics,
		text,
		params,
		codeActions
	);

	return codeActions;
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// Define a list of keywords for QVS
		const keywords = [
			"LOAD", "SELECT", "FROM", "WHERE", "JOIN", "GROUP BY", "ORDER BY", "SET", "LET"
		];

		// Convert keywords to CompletionItems
		return keywords.map((keyword, index) => ({
			label: keyword,
			kind: CompletionItemKind.Keyword,
			data: index
		}));
	}
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.kind === CompletionItemKind.Keyword) {
			item.detail = 'QlikScript details';
			item.documentation = 'QlikScript documentation';
		}
		return item;
	}
);

// Function to compute semantic tokens
connection.onRequest("textDocument/semanticTokens/full", async (params) => {
	const document = documents.get(params.textDocument.uri);
	if (!document) { return null; }

	const builder = new SemanticTokensBuilder();
	const text = document.getText();
	const lines = text.split("\n");

	const tokenData: {
		line: number;
		startChar: number;
		length: number;
		tokenType: string;
	}[] = [];

	// === 1. Handle multi-line comments ===
	const multiLineCommentRegex = /\/\*[\s\S]*?\*\//g;
	let match;
	while ((match = multiLineCommentRegex.exec(text)) !== null) {
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

	//  tokenData.forEach(({ line, startChar, length, tokenType }) => {
	// 	builder.push(line, startChar, length, tokenTypes.indexOf(tokenType), 0);
	// });


	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		const matches: any[] = [];

		// Helper function to collect matches
		const collectMatches = (regex: any, tokenType: any) => {
			let match;
			while ((match = regex.exec(line)) !== null) {

				try {
					if (match.index >= 0) {
						matches.push({
							index: match.index,
							length: tokenType == "function" ? match[0].length - 1 : match[0].length,
							tokenType
						});
					}
				} catch (e) {
					console.log('error in line: ' + line);
				}
			}
		};

		// Collect matches for all token types

		// Match keywords
		//const keywordPattern = new RegExp(`\\b(${qlikKeywords.join('|')})\\b`, 'gi');
		//collectMatches(keywordPattern, "keyword");
		const keywordPattern = new RegExp(`\\b(${qlikKeywords.join('|')})\\b`, 'gi');
		collectMatches(keywordPattern, "keyword");

		// detect function, ignore IF and JOIN
		collectMatches(/\b(?!IF|JOIN\b)([A-Z_#]+)\s*\(/gi, "function");

		// Match functions that start with SUB
		collectMatches(/\b(?<=\b(?:SUB)\s)([A-Z0-9_#]+)[\(|\n\r|\r|\n]{1}/gi, "function");
		collectMatches(/\b(?<=\b(?:CALL)\s)([A-Z0-9_#]+)\s*[\(|;]?/gi, "function");

		// Match properties that start with @
		collectMatches(/\@([0-9]*)/g, "property");

		// Match variables that start with SET or LET
		collectMatches(/\b(?<=\b(?:SET|LET)\s)[a-zA-Z_]*\.?([a-zA-Z0-9_]*)\b/gi, "variable");

		// Match variables that start with $()
		collectMatches(/(\$\([a-zA-Z0-9_.]*)\)/g, "variable");

		// Match strings enclosed in single or double quotes
		collectMatches(/(["'])(?:(?=(\\?))\2.)*?\1/g, "string");

		// Match strings that start with AS and end with ], allowing for any content in between
		collectMatches(/(?<=(?:AS)\s)[\["]{1}[a-zA-Z0-9_\- ]*[\]"]{1}/gi, "string");

		// Match lib: URLs
		// Match strings that start with lib: and end with ], allowing for any content in between
		collectMatches(/\[lib:\/\/[^\]].*]/gi, "string");

		// Single-line comments
		// Match comments that start with //, but not those that start with lib:
		collectMatches(/(?<!lib:)\/\/.*/g, "comment");

		// Multi-line comments
		// Match comments that start with /* and end with */, allowing for any content in between
		collectMatches(/\/\*[\s\S]*?\*\//g, "comment");

		// Match class names that start with lib: but not the keyword lib
		collectMatches(/^\s*(?!lib$)([a-zA-Z0-9_]+:)/g, "class");

		// Match class names after FROM, RESIDENT, and TABLE keywords, TABLE can have multiple classes separated by commas
		collectMatches(/(?<=(?:FROM)\s)[\w]+/g, "class");
		collectMatches(/(?<=(?:RESIDENT)\s)[\w]+/gi, "class");
		collectMatches(/(?<=(?:STORE)\s)[\w]+/gi, "class");
		collectMatches(/(?<=(?:TABLE)\s)[\w, ]+/gi, "class");
		collectMatches(/(?<=(?:TO)\s)[\w,]+/gi, "class");

		// Match parameters in function calls
		collectMatches(/(?<=\(|,)\s*[^(),'"]+?\s*(?=,|\))/g, "parameter");

		// Match decorators that start with trace
		collectMatches(/(?<=(?:trace)\s)[a-z0-9 >:$(_)'.]*/gi, "decorator");

		// Sort matches by index to ensure correct ordering
		matches.sort((a, b) => a.index - b.index);

		// Push tokens to builder
		matches.forEach(({ index, length, tokenType }) => {
			tokenData.push(
				{
					line: lineIndex,
					startChar: index,
					length: length,
					tokenType: tokenType
				});
		});
	}

	tokenData.sort((a, b) => a.line - b.line);

	tokenData.forEach(({ line, startChar, length, tokenType }) => {
		builder.push(line, startChar, length, tokenTypes.indexOf(tokenType), 0);
	});

	const result = builder.build();
	//console.log("[Server] Sending tokens:", result);
	return result;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
