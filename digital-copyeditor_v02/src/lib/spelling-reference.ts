import spellingLexicon from "./spelling-lexicon.json";

const MAX_REFERENCE_TERMS = 80;
const SOURCE_SEPARATORS = /[\s၊။,:;!?()[\]{}"“”‘’/\\…]/u;

function lexiconTerms() {
  const terms = new Set<string>();
  for (const entry of spellingLexicon) {
    for (const term of entry.split(/\s+/u)) {
      const normalized = term.trim();
      if (normalized.length >= 2) terms.add(normalized.normalize("NFC"));
    }
  }
  return [...terms];
}

const SPELLING_TERMS = lexiconTerms();

function occursInSource(source: string, term: string) {
  if (term.length >= 3) return source.includes(term);
  return source === term || source.split(SOURCE_SEPARATORS).includes(term);
}

/**
 * Return only lexicon terms that occur in the current source text.
 * The source workbook is a reference list, not a complete word segmenter,
 * so an absent term must never be treated as a spelling error by itself.
 */
export function getSpellingReference(sourceText: string) {
  const source = sourceText.normalize("NFC");
  const matches: string[] = [];
  for (const term of SPELLING_TERMS) {
    if (!occursInSource(source, term)) continue;
    matches.push(term);
    if (matches.length >= MAX_REFERENCE_TERMS) break;
  }
  return matches;
}

export const spellingReferenceLimit = MAX_REFERENCE_TERMS;
