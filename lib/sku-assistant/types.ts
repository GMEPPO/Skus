export type SkuAssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type SkuAssistantCandidate = {
  levelId: string;
  levelLabel: string;
  fieldType: string;
  wordId: string;
  label: string;
  referenceCode: string;
  designationPt: string;
};

export type SkuAssistantProposal = {
  selections: Record<string, string>;
  codeHyphen: string;
  codeCompact: string;
  designationPt: string;
  designationEs: string;
  designationEn: string;
  rationale: string;
  confidence: number;
};

export type SkuAssistantResponse =
  | {
      type: "clarify";
      message: string;
      questions: string[];
      partialSelections?: Record<string, string>;
    }
  | {
      type: "propose";
      message: string;
      proposal: SkuAssistantProposal;
    }
  | {
      type: "message";
      message: string;
    };
