[![downloads](https://img.shields.io/visual-studio-marketplace/d/kelosky.ibm-assembler)](https://marketplace.visualstudio.com/items?itemName=kelosky.ibm-assembler)
[![license](https://img.shields.io/github/license/dkelosky/vscode-ibm-hlasm)](https://github.com/dkelosky/vscode-ibm-hlasm)

# HLASM Highlighting Extension for VS Code

Minimum featured HLASM highlighter and LSP extension for VS Code.

> Tip: Add editor configuration in `user.settings` to highlight continuation column, e.g. `[hlasm] : { "editor.rulers" : [71, 72, 80]},`

## Features

Go to definition via `Ctrl + click` or `F12`.

Highlighting and symbol resolution via `Ctrl + Shift + O`:

![Highlighting](./docs/images/symbols.png)

## Contributing

`npm run build:syntax` to convert `.yaml` to required `.json`.

