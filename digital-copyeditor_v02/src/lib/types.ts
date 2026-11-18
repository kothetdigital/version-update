export type TargetStyle = "SPOKEN" | "WRITTEN";

export type HousePolicy = {
  id: string;
  label: string;
  ruleText: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EditorialNote = { original: string; suggestion: string; explanation: string };

export type EditorialResult = {
  targetStyle: TargetStyle;
  sentenceStructureSummary: string;
  structureIssues: EditorialNote[];
  correctedText: string;
  spellingNotes: EditorialNote[];
  grammarNotes: EditorialNote[];
  policyNotes: string[];
};

export type EditingSession = {
  id: string;
  sourceText: string;
  result: EditorialResult;
  createdAt: string;
};
