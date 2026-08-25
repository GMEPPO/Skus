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

export type CombinedNomenclatureMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CombinedNomenclatureDesignation = {
  designationPt: string;
  designationEs?: string;
  designationEn?: string;
  referenceCode?: string;
};

export type CombinedNomenclatureAbbreviation = {
  levelLabel: string;
  fieldType: string;
  referenceCode: string;
  label: string;
  designationPt: string;
};

export type CombinedNomenclatureProposal = {
  cnCode: string;
  cnDescription: string;
  confidence: number;
  rationale: string;
  notes?: string;
};

export type CombinedNomenclatureResponse =
  | {
      type: "clarify";
      message: string;
      questions: string[];
    }
  | {
      type: "propose";
      message: string;
      proposal: CombinedNomenclatureProposal;
    }
  | {
      type: "message";
      message: string;
    };
