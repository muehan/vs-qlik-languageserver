import { Linter } from './Linter';

// The example settings
export interface QlikLanguageServerSettings {
	maxNumberOfProblems: number;
	linter: Linter;
}
