# Version 1.0.22
- BUGFIX: as linter after autogenerate
- BUGFIX: as linter ignores single line comments
- Add line and block comment config to language configuration

# Version 1.0.21
- Added keyword WHILE

# Version 1.0.20
- Added colored braces
- ignore keywords in line with ooxml Excel imports
- Fix AS alingment when tabs are used

# Version 1.0.17
- enhance trace to allow comments at the end
- don't check for keywords in trace

# Version 1.0.16
- fix trace pattern

# Version 1.0.15
- rename plugin

# Version 1.0.14
- fix JOIN class regex
- add info to readme

# Version 1.0.13
- adding more keywords
- LEFT and RIGHT is only keyword in JOIN
- match class in JOIN
- fix as alingment with \n lineending

# Version 1.0.12
- add missing config section to package.json

# Version 1.0.11
- Feature AS alingment linter setting

# Version 1.0.10
- Refactoring
- Feature AS alingment linter

# Version 1.0.9
- Bugfix line ending on none windows systems

# Version 1.0.8
- Feature add operator token
- Feature add configuration setting
- Bugfix change AS-String regex

# Version 1.0.7
- Bugfix braket string with dash
- Bugfix don't mark strings in parameters
- Bugfix SUB function match for OSx

# Version 1.0.6
- Fix linter warnings inside strings for uppercase linter check.
- Bugfix function and class token

# Version 1.0.5
- Fix os related lineending bug in quickfix

# Version 1.0.4
- Add codeAction for keyword to upper case quick fix

# Version 1.0.3
- Add github action for publishing

# Version 1.0.2
- Add more keywords
- Fix function offset
- Add keyword upper case linter

# Version 1.0.1
- Add missing keywords

# Version 1.0.0
- initial release
- return semantic token for syntax highlighting
- single and mukti line checks
