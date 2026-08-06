"use server";

import {
  countCompletedNormalizationHistory,
  countPendingNormalizationQueue,
  searchCompletedNormalizationHistory,
  searchPendingNormalizationQueue,
} from "@/lib/normalization-data";
import type { PaginatedResult } from "@/lib/normalization-search-utils";
import type { NormalizationHistoryItem, NormalizationQueueItem } from "@/lib/types";

export async function searchPendingNormalizationAction(input: {
  page: number;
  referenceFilter?: string;
  designationFilter?: string;
}): Promise<PaginatedResult<NormalizationQueueItem>> {
  return searchPendingNormalizationQueue(input);
}

export async function countPendingNormalizationAction(input?: {
  referenceFilter?: string;
  designationFilter?: string;
}): Promise<number> {
  return countPendingNormalizationQueue(input);
}

export async function searchCompletedNormalizationHistoryAction(input: {
  page: number;
  legacyCodeFilter?: string;
  legacyDesignationFilter?: string;
  newCodeFilter?: string;
  newDesignationFilter?: string;
  categoryFilter?: string;
}): Promise<PaginatedResult<NormalizationHistoryItem>> {
  return searchCompletedNormalizationHistory(input);
}

export async function countCompletedNormalizationAction(input?: {
  legacyCodeFilter?: string;
  legacyDesignationFilter?: string;
  newCodeFilter?: string;
  newDesignationFilter?: string;
  categoryFilter?: string;
}): Promise<number> {
  return countCompletedNormalizationHistory(input);
}
