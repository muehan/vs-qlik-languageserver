/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

//import { Pattern } from 'glob/dist/commonjs/pattern';
import * as path from 'path';
import { 
	workspace, 
	ExtensionContext, 
	SemanticTokensLegend,
	languages,
	commands,
	Disposable
} from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	console.log('[Client] init extension');
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [
			{ scheme: 'file', language: 'qvs' }
			//'**/*.qvs'
		],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	const legend = new SemanticTokensLegend(["keyword", "variable", "function", "string", "comment", "table"]);

	const provider = languages.registerDocumentSemanticTokensProvider(
		{ language: "qvs" },
		{
			provideDocumentSemanticTokens(document) {
				return commands.executeCommand("qvsLanguageServer.provideSemanticTokens", document.uri.toString());
			}
		},
		legend
	);

	// Create the language client and start the client.
	client = new LanguageClient(
		'qliklanguageServer',
		'Language Server Qlik',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	client.start();
	Disposable.from(provider);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
