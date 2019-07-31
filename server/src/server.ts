/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    SymbolKind,
    SymbolInformation
} from "vscode-languageserver";

// Create a connection for the server. The connection uses Node"s IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
const documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
    let capabilities = params.capabilities;

    // Does the client support the `workspace/configuration` request?
    // If not, we will fall back using global settings
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

    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            documentSymbolProvider: true,
        }
    };
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log("Workspace folder change event received.");
        });
    }
});


// TODO(Kelosky): in the future, perform diagnostic information (red squiggle) and listen
// for configuration settings as in the LSP sample
connection.onDocumentSymbol((parm) => {

    const symbols: SymbolInformation[] = [];
    const document = documents.get(parm.textDocument.uri);
    if (!document) {
        return null;
    }

    const lines = document.getText().split('\n');
    for (let i = 0; i < lines.length - 1; i++) {

        // if space or * in column one, it's not a symbol
        if (lines[i][0] !== ' ' && lines[i][0] !== '*') {

            // compress everything to one space
            const tokenizedLine = lines[i].replace(/\s+/g, " ");
            const end = tokenizedLine.indexOf(" ");
            const instruction = tokenizedLine.substring(end + 1, tokenizedLine.indexOf(" ", end + 1))
            let kind: SymbolKind = SymbolKind.Constant;

            // TODO(Kelosky): DS, DC, perhaps could have other meaning, we can also associate
            // fields belonging to a DSECT
            if (instruction === "DSECT") {
                kind = SymbolKind.Object;
            }

            let entry: SymbolInformation = {
                name: lines[i].substring(0, end),
                kind,
                location: {
                    uri: parm.textDocument.uri,
                    range: {
                        start: { line: i, character: 0 },
                        end: { line: i, character: end - 1 }
                    }
                }
            }
            symbols.push(entry);
        }
    }
    return symbols;
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
