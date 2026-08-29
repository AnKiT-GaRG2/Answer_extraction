import type { AnswerBlock, OcrLine, Question } from './types';

// The sub-part letter is only captured when it's unambiguously a label, not a
// word: either parenthesized ("11 (a)", "4)(a)" — space before the paren is
// fine) or directly adjacent to the digit with no space ("11a", "11.a"). A
// bare letter with a space before it is never captured here — without that
// restriction "31. K is..." reads the answer's own first word ("K") as a
// sub-label "31k", which doesn't match any real question and silently drops
// the whole anchor (verified against a real handwritten answer sheet).
const TOP_ANCHOR_RE =
  /^\s*(?:Q(?:ues(?:tion)?)?\.?\s*)?(?:Ans(?:wer)?\.?\s*)?(\d{1,2})(?:\s*[.):-]?\s*\(([a-zA-Z])\)|[.):-]?([a-zA-Z])(?![a-zA-Z]))?/;

// Many exams print a sub-part's label on its own line, parenthesized and with
// no digit at all — "(i)", "(ii)", "(a)" — reused under every top-level
// question. Requiring the literal parens keeps this from matching a normal
// sentence that happens to start with a short word.
const SUB_ANCHOR_RE = /^\s*\(\s*([a-zA-Z]{1,4})\s*\)/;

/** Normalizes "11 (a)" / "11a" / "Q11 a" all to "11a" for comparison. */
export function normalizeLabel(label: string): string {
  const m = /(\d{1,2})\s*\(?\s*([a-zA-Z])?(?![a-zA-Z])\)?/.exec(label);
  if (!m) return label.toLowerCase().replace(/\s+/g, '');
  return `${m[1]}${(m[2] ?? '').toLowerCase()}`;
}

/** Normalizes a bare sub-part label ("(i)", "I.", "a)") down to just its letters, e.g. "i". */
function normalizeSubLabel(label: string): string {
  return label.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Finds lines that open a new answer. Two tiers, tracked as a small state
 * machine while scanning lines top-to-bottom:
 *  - a top-level match ("4.", "5 (a)") both anchors that question AND becomes
 *    the "current group" for sub-part matching that follows;
 *  - a sub-part match ("(i)", "(ii)") is resolved against whichever question
 *    is grouped under the current top-level group — the same bare "(i)" means
 *    a different question once a new top-level group has started.
 * A top-level match is accepted purely on matching a real question's label —
 * no requirement that its printed order keeps increasing. Students legitimately
 * answer out of order (verified against real answer sheets: e.g. question 31
 * answered before 24), and rejecting a genuine anchor for regressing "loses"
 * those lines into whatever question was previously current, which is worse
 * than the rare false positive this would otherwise guard against.
 */
function findAnchors(lines: OcrLine[], questions: Question[]): Map<string, string> {
  const topLevel = questions.filter((q) => !q.groupLabel);
  const topLevelByNormalized = new Map(topLevel.map((q) => [normalizeLabel(q.label), q.id]));

  const subByGroup = new Map<string, Map<string, string>>();
  for (const q of questions) {
    if (!q.groupLabel) continue;
    const groupKey = normalizeLabel(q.groupLabel);
    let group = subByGroup.get(groupKey);
    if (!group) {
      group = new Map();
      subByGroup.set(groupKey, group);
    }
    group.set(normalizeSubLabel(q.label), q.id);
  }

  const anchors = new Map<string, string>();
  let currentGroupKey: string | null = null;

  for (const line of lines) {
    const topMatch = TOP_ANCHOR_RE.exec(line.text);
    if (topMatch?.[1]) {
      const letter = topMatch[2] ?? topMatch[3] ?? '';
      const norm = `${topMatch[1]}${letter.toLowerCase()}`;
      const qId = topLevelByNormalized.get(norm);
      if (qId) {
        anchors.set(line.id, qId);
        currentGroupKey = norm;
        continue;
      }
    }

    const subMatch = SUB_ANCHOR_RE.exec(line.text);
    if (subMatch?.[1] && currentGroupKey) {
      const qId = subByGroup.get(currentGroupKey)?.get(normalizeSubLabel(subMatch[1]));
      if (qId) anchors.set(line.id, qId);
    }
  }

  return anchors;
}

export type AnchorResult = {
  blocks: Map<string, string[]>; // questionId -> lineIds, in reading order
  detectedLabels: Map<string, string>; // questionId -> the label text as OCR'd
  unassignedLineIds: string[]; // lines before the first anchor, or on sheets with none
};

/**
 * Deterministic first pass: a line matching a known question label starts a
 * new block, and every line after it belongs to that block until the next
 * anchor. This alone resolves most answer sheets since students generally
 * label each answer.
 */
export function buildAnchorBlocks(lines: OcrLine[], questions: Question[]): AnchorResult {
  const sorted = [...lines].sort((a, b) => a.page - b.page || a.box.y - b.box.y);
  const anchors = findAnchors(sorted, questions);

  const blocks = new Map<string, string[]>();
  const detectedLabels = new Map<string, string>();
  const unassignedLineIds: string[] = [];
  let current: string | null = null;

  for (const line of sorted) {
    const anchorQ = anchors.get(line.id);
    if (anchorQ) {
      current = anchorQ;
      if (!detectedLabels.has(anchorQ)) detectedLabels.set(anchorQ, line.text.trim());
    }
    if (current) {
      const arr = blocks.get(current) ?? [];
      arr.push(line.id);
      blocks.set(current, arr);
    } else {
      unassignedLineIds.push(line.id);
    }
  }

  return { blocks, detectedLabels, unassignedLineIds };
}

export type LlmAssignment = { questionId: string | null; lineIds: string[]; confidence: number };

/**
 * Merges the deterministic anchor blocks with the LLM's resolution of the
 * leftover lines into final AnswerBlock[]. Drops hallucinated line ids and
 * dedupes lines claimed twice (keeping the higher-confidence claim). This is
 * a plain function, not a prompt — the LLM never gets the final say.
 */
export function sanitizeMapping(opts: {
  questions: Question[];
  allLineIds: Set<string>;
  anchors: AnchorResult;
  llmAssignments: LlmAssignment[];
}): AnswerBlock[] {
  const { questions, allLineIds, anchors, llmAssignments } = opts;
  const claimedBy = new Map<string, { questionId: string | null; confidence: number }>();

  for (const [questionId, lineIds] of anchors.blocks) {
    for (const lineId of lineIds) {
      claimedBy.set(lineId, { questionId, confidence: 1 });
    }
  }

  const unassignedSet = new Set(anchors.unassignedLineIds);
  for (const assignment of llmAssignments) {
    for (const lineId of assignment.lineIds) {
      if (!allLineIds.has(lineId)) continue; // hallucinated id
      if (!unassignedSet.has(lineId)) continue; // not ours to reassign
      const existing = claimedBy.get(lineId);
      if (!existing || assignment.confidence > existing.confidence) {
        claimedBy.set(lineId, { questionId: assignment.questionId, confidence: assignment.confidence });
      }
    }
  }

  const byQuestion = new Map<string | null, { lineIds: string[]; confidence: number }>();
  for (const [lineId, claim] of claimedBy) {
    const entry = byQuestion.get(claim.questionId) ?? { lineIds: [], confidence: claim.confidence };
    entry.lineIds.push(lineId);
    entry.confidence = Math.min(entry.confidence, claim.confidence);
    byQuestion.set(claim.questionId, entry);
  }

  const blocks: AnswerBlock[] = [];
  for (const question of questions) {
    const entry = byQuestion.get(question.id);
    if (entry && entry.lineIds.length > 0) {
      blocks.push({
        questionId: question.id,
        lineIds: entry.lineIds,
        confidence: entry.confidence,
        detectedLabel: anchors.detectedLabels.get(question.id) ?? null,
      });
    }
  }

  const orphan = byQuestion.get(null);
  if (orphan && orphan.lineIds.length > 0) {
    blocks.push({
      questionId: null,
      lineIds: orphan.lineIds,
      confidence: orphan.confidence,
      detectedLabel: null,
    });
  }

  return blocks;
}
