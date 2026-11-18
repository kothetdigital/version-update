---
name: burmese-proofreading
description: Proofread Burmese/Myanmar text for spelling, grammar, sentence structure, punctuation, word usage, and spoken or written style while preserving meaning. Use when the user asks to correct, edit, polish, or explain Burmese text.
---

# Burmese Grammar and Usage Proofreading Skill

Use this skill for Burmese/Myanmar proofreading requests. Read `agent.md` in this folder for the editor's identity and output contract.

## Scope

This skill covers two related review modes:

- **Grammar proofreading:** spelling, Unicode consistency, punctuation, sentence boundaries, particles, postpositions, clause connections, agreement, and sentence structure.
- **Usage proofreading:** word choice, naturalness, register, collocation, tone, context, terminology, and house-style preferences.

Always preserve the writer's meaning. A usage suggestion is not automatically a grammatical correction.

## Spelling reference

The project includes a bundled reference lexicon at `src/lib/spelling-lexicon.json`. It was prepared from the user-supplied `Myanmar-Spelling` workbook: 11,614 source rows, 11,604 unique entries, and 34 letter-specific sheets. The workbook is a reference list, not a complete or official language authority.

Use the reference this way:

- Check exact entries that occur in the source text before proposing a spelling change.
- Treat parenthetical text as a contextual gloss or alternative, not as text to insert automatically.
- Do not call a word incorrect only because it is absent from the reference. The list is not a complete dictionary and does not provide correction pairs by itself.
- When the reference and sentence context appear to conflict, preserve meaning, identify the uncertainty, and explain the smallest safe correction.
- Keep the source wording and the reference entry separate in notes so readers can distinguish an observed spelling from an editorial suggestion.

The application uses `src/lib/spelling-reference.ts` to pass only source-matched entries to the provider, with a maximum of 80 entries per review. The bounded list keeps the reference useful without turning the provider prompt into a full dictionary dump.

## Style gate

Before style-sensitive editing, identify the target register:

- `အပြော` — natural spoken/conversational Burmese.
- `အရေး` — written/literary/formal Burmese.

If the user has not selected a register and the text does not make the intent clear, ask which register to use. Do not silently convert spoken text into literary text or literary text into casual speech.

## Proofreading procedure

1. Read the complete passage before changing individual words.
2. Preserve names, numbers, quoted text, product names, and intentional dialect unless the user asks for normalization.
3. Check Burmese Unicode and obvious spelling issues.
4. Check punctuation, sentence boundaries, clause order, particles, and postpositions.
5. Check word usage against the surrounding context.
6. Apply the selected register.
7. Apply active house rules and explain every policy-driven override.
8. Return the complete corrected text plus concise notes for changes that affect meaning, grammar, or style.

## Correction categories

### Grammar notes

Use grammar notes for changes required to make the sentence structurally correct, unambiguous, or conventionally formed. Explain the affected phrase and the reason for the correction.

### Usage notes

Use structure or grammar notes only when appropriate; otherwise explain usage in the sentence-structure summary or a concise note. Usage notes may cover:

- a more natural word for the context;
- spoken versus written register;
- overly literal translation;
- inconsistent terminology;
- formal or informal tone;
- a house-style preference.

Do not label a stylistic preference as an objective error.

## Output rules

- Return the complete `correctedText`.
- Keep `structureIssues`, `spellingNotes`, `grammarNotes`, and `policyNotes` as arrays.
- Use the original phrase and suggested phrase for every actionable note.
- Keep explanations short and understandable in Burmese when possible.
- If no correction is needed, say so and return the original text unchanged.
- If the text is ambiguous, preserve it and explain what additional context is needed.

## House-policy precedence

An active house policy may override a general usage preference, but it must not be used to justify an obviously malformed sentence unless the user explicitly asks for that behavior. Record applied overrides in `policyNotes`.

## Safety and privacy

- Do not invent information that is not present in the source.
- Do not expose API keys, tokens, or private configuration in the review.
- Treat the user's text as private editorial content.
- Do not use HTML or executable content in corrections.
