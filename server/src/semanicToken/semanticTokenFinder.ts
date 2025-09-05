import { ITokenData } from './ITokenData';

/**
 * Finds semantic tokens in the provided lines of Qlik script code.
 * 
 * @param lines - An array of strings representing the lines of code.
 * @param qlikKeywords - An array of Qlik keywords to match against.
 * @returns An array of ITokenData objects representing the found tokens.
 */
export function semanticTokenFinder(
	lines: string[],
	qlikKeywords: string[]
): ITokenData[] {

	const tokenData: ITokenData[] = [];

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];

		if (!line || line.trim() === '') {
			continue; // Skip empty lines
		}

		const matches: { index: number, length: number, tokenType: string }[] = [];

		// Helper function to collect matches
		const collectMatches = (regex: RegExp, tokenType: string) => {
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
				} catch (ex) {
					console.log('error in line: ' + line + ' with regex: ' + regex + ' and match: ' + match[0] + ' length: ' + match[0].length + ' and index: ' + match.index + ' with error: ' + ex);
					throw ex;
				}
			}
		};

		// Collect matches for all token types

		// Match keywords
		//const keywordPattern = new RegExp(`\\b(${qlikKeywords.join('|')})\\b`, 'gi');
		//collectMatches(keywordPattern, "keyword");
		// const keywordPattern = new RegExp(`\\b(${qlikKeywords.join('|')})\\b`, 'gi');
		// collectMatches(keywordPattern, "keyword");

		if (/^\s*trace\s+/i.test(line)) { 
			// Match decorators that start with trace 
			// //collectMatches(/(?<=(?:trace)\s)[a-z0-9 >:$(_)'.=!?~;:]*/gi, "decorator"); 
			// //collectMatches(/(?<=(?:trace)\s)[\p{L}\p{N}\p{S}\p{P}\p{M}\p{C}\p{Z}]*/gu, "decorator"); 
			//collectMatches(/(?<=\btrace\s).*/gi, "decorator");
			collectMatches(/(?<=\btrace\s)(.*?)(?=(\/\/|\/\*|$))/gi, "decorator");
			const keywordPattern = new RegExp(`\\btrace\\b`, 'gi');
			collectMatches(keywordPattern, "keyword");
		} else { 
			const keywordPattern = new RegExp(`\\b(${qlikKeywords.join('|')})\\b`, 'gi');
			collectMatches(keywordPattern, "keyword");
		}
		
		// detect function, ignore IF and JOIN
		collectMatches(/\b(?!IF|JOIN\b)([A-Z_#]+)\s*\(/gi, "function");

		// Match functions that start with SUB
		collectMatches(/\b(?<=\b(?:SUB)\s)([A-Z0-9_#]+)(\(|\r)/gi, "function");
		collectMatches(/\b(?<=\b(?:CALL)\s)([A-Z0-9_#]+)\s*[(|;]?/gi, "function");

		// Match properties that start with @
		collectMatches(/@([0-9]*)/g, "property");

		// Match variables that start with SET or LET
		collectMatches(/\b(?<=\b(?:SET|LET)\s)[a-zA-Z_]*\.?([a-zA-Z0-9_]*)\b/gi, "variable");

		// Match variables that start with $()
		collectMatches(/(\$\([a-zA-Z0-9_.]*)\)/g, "variable");

		// Match strings enclosed in single or double quotes
		collectMatches(/["'[](?:(?=(\\?)).)*?[\]"']/g, "string");

		// Match strings that start with AS and end with ], allowing for any content in between
		//collectMatches(/(?<=(?:AS)\s)[["]{1}[a-zA-Z0-9_\-+%/\\&$#. ]*[\]"]{1}/gi, "string");

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
		collectMatches(/(?<=(?:JOIN\s?\())[\w,]+/gi, "class");

		// Match parameters in function calls
		//collectMatches(/(?<!JOIN\s)(?<=\(|,)\s*[^(),'"]+?\s*(?=,|\))/g, "parameter");
		collectMatches(/(?<!JOIN\s\()(?<=\(|,)\s*[^(),'"]+?\s*(?=,|\))/gi, "parameter");

		// Match decorators that start with trace
		//collectMatches(/(?<=(?:trace)\s)[a-z0-9 >:$(_)'.=!?~;:]*/gi, "decorator");
		//collectMatches(/(?<=(?:trace)\s)[\p{L}\p{N}\p{S}\p{P}\p{M}\p{C}\p{Z}]*/gu, "decorator");
		collectMatches(/(?<=\btrace\s).*/gi, "decorator");

		// Match operators
		// find a solution for / not to be seen in paths and comments
		collectMatches(/<>|<=|>=|==|=|<|>|\+|-|\*|%|&|\||!|~|<<|>>/g, "operator");

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

	return tokenData;
}