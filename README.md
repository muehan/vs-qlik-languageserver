# Qlik language server extension

PLease use this version of the Plugin: [vs-qlik-languageserver](https://marketplace.visualstudio.com/items?itemName=andremuehle.vs-qlik-languageserver).

There is a other version published, with a old name of the same plugin.
Don't use this [qlik-linter](https://marketplace.visualstudio.com/items?itemName=andremuehle.qlik-linter).

## Functionality

This Language Server works for QVS files. It has the following language features:
- Syntax highlighting
- Linter for uppercase keywords with quickfix
- Linter for as alingment
- bot linter function can be disabled in the config

## Build and Run

- Run `npm install` to install all necessary npm modules in both the client and server folder
- Run `npm run compile` to build
- Press F5 to run the project
- Run `npm run build` (`npm install -g vsce` if not yet done)

## Versioning

- tag versions
- tag with X.X.X match does trigger github action for a new release


## Changelog
Check changelog.md
