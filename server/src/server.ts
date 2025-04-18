/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
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
	type DocumentDiagnosticReport
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

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
            }
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
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	const text = textDocument.getText();
	const pattern = /\b[A-Z]{200,}\b/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;
		const diagnostic: Diagnostic = {
			severity: DiagnosticSeverity.Warning,
			range: {
				start: textDocument.positionAt(m.index),
				end: textDocument.positionAt(m.index + m[0].length)
			},
			message: `${m[0]} is all uppercase.`,
			source: 'ex'
		};
		if (hasDiagnosticRelatedInformationCapability) {
			diagnostic.relatedInformation = [
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Spelling matters'
				},
				{
					location: {
						uri: textDocument.uri,
						range: Object.assign({}, diagnostic.range)
					},
					message: 'Particularly for names'
				}
			];
		}
		diagnostics.push(diagnostic);
	}
	return diagnostics;
}

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
    console.log("[Server] onRequest textDocument/semanticTokens/full");
    const document = documents.get(params.textDocument.uri);
    if (!document) { return null; }

    const builder = new SemanticTokensBuilder();
    const text = document.getText();
    const lines = text.split("\n");

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const matches:any[] = [];

        // Helper function to collect matches
        const collectMatches = (regex:any, tokenType:any) => {
            let match;
            while ((match = regex.exec(line)) !== null) {
                if (match.index >= 0) {
                    matches.push({ 
						index: match.index, 
						length: tokenType == "function" ? match[0].length -1 : match[0].length, 
						tokenType });
                }
            }
        };

        // Collect matches for all token types
        collectMatches(/\b(?!IF|JOIN\b)([A-Z_#]+)\s*\(/gi, "function");
		collectMatches(/\b(?<=\b(?:SUB)\s)([A-Z_#]+)\s*[\(]?/gi, "function");
        collectMatches(/\b(LOAD|SELECT|TRACE|DISTINCT|FROM|WHERE|JOIN|DROP|NOT|SUB|END|GROUP|BY|LEFT|INLINE|FIELD|TABLE|AS|INNER|OUTER|IF|ELSE|LET|SET|AND|OR|NoConcatenate|RESIDENT)\b/gi, "keyword");
		collectMatches(/\@([0-9]*)/g, "property");
        // collectMatches(/\b(?:SET|LET)\s+([a-zA-Z_]*.[a-zA-Z0-9_]*)\b/gi, "variable");
        collectMatches(/\b(?<=\b(?:SET|LET)\s)[a-zA-Z_]*\.?([a-zA-Z0-9_]*)\b/gi, "variable");
        collectMatches(/(\$\([a-zA-Z0-9_.]*)\)/g, "variable"); // variables with $(variable)
        collectMatches(/(["'])(?:(?=(\\?))\2.)*?\1/g, "string");
		collectMatches(/(?<=(?:AS)\s)[\["]?[a-zA-Z0-9_ ]*[\]"]?/gi, "string");
		collectMatches(/\[lib:\/\/[^\]]*]/gi, "string");
        collectMatches(/\/\/.*/g, "comment"); // single line
        collectMatches(/\/\*[\s\S]*?\*\//g, "comment"); // multiline
        collectMatches(/^\s*(?!lib$)([a-zA-Z0-9_]+:)/g, "class");
        collectMatches(/(?<=(?:FROM)\s)[\w]+/g, "class");
        collectMatches(/(?<=(?:RESIDENT)\s)[\w]+/gi, "class");
        collectMatches(/(?<=\(|,)\s*[^(),]+?\s*(?=,|\))/g, "parameter");
        collectMatches(/(?<=(?:trace)\s)[a-z0-9 >:$(_)]*/gi, "decorator");

        // Sort matches by index to ensure correct ordering
        matches.sort((a, b) => a.index - b.index);

        // Push tokens to builder
        matches.forEach(({ index, length, tokenType }) => {
            builder.push(lineIndex, index, length, tokenTypes.indexOf(tokenType), 0);
        });
    }

    const result = builder.build();
    console.log("[Server] Sending tokens:", result);
    return result;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
