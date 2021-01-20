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
    SymbolInformation,
    TextDocument,
    Diagnostic,
    DiagnosticSeverity,
    Location
} from "vscode-languageserver";

const MAX_LEN = 80;

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments = new TextDocuments();

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

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
            definitionProvider: true,
        }
    };
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((event) => {
            connection.console.log("Workspace folder change event received.");
        });
    }
});

interface IHlasmSettings {
    maxNumberOfProblems: number;
}

const defaultSettings: IHlasmSettings = { maxNumberOfProblems: 1000 };
let globalSettings: IHlasmSettings = defaultSettings;
const documentSettings: Map<string, Thenable<IHlasmSettings>> = new Map();
const symbolsCache: Map<string, Location[]> = new Map();

connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    } else {
        globalSettings =
            (change.settings.languageServerExample || defaultSettings);
    }

    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<IHlasmSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: "hlasmServer"
        });
        documentSettings.set(resource, result);
    }
    return result;
}

// Only keep settings for open documents
documents.onDidClose((e) => {
    documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent((change) => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {

    const settings = await getDocumentSettings(textDocument.uri);
    connection.console.info(`validateTextDocument() called - settings are: ${JSON.stringify(settings, null, 2)}`);

    const text = textDocument.getText();

    // TODO(Kelosky): stay within settings threshold
    let problems = 0;
    const diagnostics: Diagnostic[] = [];

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > MAX_LEN) {
            problems++;

            const diagnostic: Diagnostic = {
                severity: DiagnosticSeverity.Error,
                range: {
                    start: { line: i, character: MAX_LEN },
                    end: { line: i, character: lines[i].length },
                },
                message: `Exceeded ${MAX_LEN} characters`,
                source: "hlasm"
            };

            diagnostics.push(diagnostic);
        }
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDefinition((parm) => {
    connection.console.info(`onDefinition invoked ${JSON.stringify(parm, null, 2)}`);

    const document = documents.get(parm.textDocument.uri);
    if (!document) {
        return null;
    }

    const lines = document.getText().split(/\r?\n/);

    connection.console.info(`Definition ${parm.position.character} on line '${lines[parm.position.line]}'`);
    connection.console.info(`There are ${symbolsCache.size} entries in cached symbols`);

    // if (lines[parm.position.line].trim() === "") {
    //     connection.console.info(`No definition for blank line`);
    //     return;
    // }

    // if (parm.position.character === 0) {
    //     connection.console.info(`No definition for something in column 0`);
    //     return;
    // }

    // if (lines[parm.position.line][parm.position.character] === " ") {
    //     connection.console.info(`No definition for spaces`);
    //     return;
    // }

    // if (lines[parm.position.line][parm.position.character] === "*") {
    //     connection.console.info(`No definition for asterisks`);
    //     return;
    // }

    const len = lines[parm.position.line].length;
    const reg = new RegExp(/[a-z|A-Z|0-9|@|#|$]/);
    if (reg.test(lines[parm.position.line][parm.position.character])) {
        connection.console.info(`Matched`);
        let left = parm.position.character;
        let right = parm.position.character;

        while(left > 0) {
            connection.console.info(`Left is ${left} - ${lines[parm.position.line][left]}`);
            left--;
            if (!reg.test(lines[parm.position.line][left])) {
                break;
            }
        }
        while(right < lines[parm.position.line].length) {
            connection.console.info(`Right is ${right} - ${lines[parm.position.line][right]}`);
            right++;
            if (!reg.test(lines[parm.position.line][right])) {
                break;
            }
        }

        const symb = lines[parm.position.line].substring(left + 1, right);
        connection.console.info(`Left is ${left} and right is ${right}, '${symb}'`);
        return symbolsCache.get(symb);
    } else {
        connection.console.info(`Did not match valid symbol`);
        return;
    }

    // for (let i = 0; i < lines.length - 1; i++) {

    //     // if space or * in column one, it's not a symbol
    //     if (lines[i][0] !== " " && lines[i][0] !== "*") {

    //         // compress multiple spaces to a single space
    //         let tokenizedLine = lines[i].replace(/\s+/g, " ").split(" ");

    //         // remove blank entries
    //         tokenizedLine = tokenizedLine.filter((entry) => entry !== "");

    //         if (tokenizedLine.length > 0) {

    //             let kind: SymbolKind = SymbolKind.Constant;
    //             if (tokenizedLine[1]) {
    //                 if (tokenizedLine[1] === "DSECT") {
    //                     kind = SymbolKind.Object;
    //                 }
    //             }

    //             const entry: Location = {
    //                 uri: parm.textDocument.uri,
    //                 range: {
    //                     start: { line: i, character: 0 },
    //                     end: { line: i, character: tokenizedLine[0].length - 1 }
    //                 }
    //             };

    //             symbols.push(entry);
    //         }

    //     }
    // }
    // return symbols;
});


// TODO(Kelosky): workspace symbols
connection.onDocumentSymbol((parm) => {

    connection.console.info(`onDocumentSymbol invoked ${JSON.stringify(parm, null, 2)}`);

    const symbols: SymbolInformation[] = [];
    const document = documents.get(parm.textDocument.uri);
    if (!document) {
        return null;
    }

    connection.console.info(`Clearing symbol cache...`);
    symbolsCache.clear();

    const lines = document.getText().split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {

        // if space or * in column one, it's not a symbol
        if (lines[i][0] !== " " && lines[i][0] !== "*") {

            // compress multiple spaces to a single space
            let tokenizedLine = lines[i].replace(/\s+/g, " ").split(" ");

            // remove blank entries
            tokenizedLine = tokenizedLine.filter((entry) => entry !== "");

            if (tokenizedLine.length > 0) {

                let kind: SymbolKind = SymbolKind.Constant;

                // TODO(Kelosky): put all DSECT items under the object
                if (tokenizedLine[1]) {
                    if (tokenizedLine[1] === "DSECT") {
                        kind = SymbolKind.Object;
                    }
                }

                // TODO(Kelosky): put all ORG items in groups
                const entry: SymbolInformation = {
                    name: tokenizedLine[0],
                    kind,
                    location: {
                        uri: parm.textDocument.uri,
                        range: {
                            start: { line: i, character: 0 },
                            end: { line: i, character: tokenizedLine[0].length }
                        }
                    }
                };

                symbols.push(entry);

                // Node(Kelosky): if this performs poorly, consider symbols being created
                symbolsCache.set(entry.name, [entry.location]);
            }

        }
    }
    return symbols;
});

documents.listen(connection);

connection.listen();
