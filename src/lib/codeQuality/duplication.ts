import type { AnalyzerIssue, AnalyzerMetric, AnalyzerResult, EffectiveScanSettings, SourceFile } from "./types";

interface SignificantLine {
  text: string; // trimmed, whitespace-collapsed
  originalLineNo: number;
}

interface FilePos {
  fileIndex: number;
  lineIndex: number; // index into that file's significantLines array
}

// Cross-file structural duplication detector (jscpd-style, hand-rolled - no dependency
// available for this, see the module's own architecture notes). Compares whitespace/comment-
// normalized lines rather than raw text, so reformatted-but-identical code still matches, and
// deliberately excludes bare punctuation lines ("{", "}", ");" etc.) from the sliding window
// since those match constantly and would otherwise dominate results with noise.
function isSignificantLine(line: string): boolean {
  const t = line.trim();
  if (t.length === 0) return false;
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return false;
  if (/^[{}();,]+$/.test(t)) return false;
  return true;
}

function normalize(line: string): string {
  return line.trim().replace(/\s+/g, " ");
}

function extractSignificantLines(file: SourceFile): SignificantLine[] {
  const out: SignificantLine[] = [];
  file.lines.forEach((line, idx) => {
    if (isSignificantLine(line)) out.push({ text: normalize(line), originalLineNo: idx + 1 });
  });
  return out;
}

export interface DuplicateBlock {
  sourceFile: string;
  sourceStartLine: number;
  sourceEndLine: number;
  matchingFile: string;
  matchingStartLine: number;
  matchingEndLine: number;
  lineCount: number;
  similarityPercent: number; // always 100 for this exact-match detector
}

function severityForBlock(lineCount: number, settings: EffectiveScanSettings): "Low" | "Medium" | "High" | "Critical" {
  const block = settings.minDuplicateBlockSize;
  if (lineCount >= block * 5) return "Critical";
  if (lineCount >= block * 3) return "High";
  if (lineCount >= block * 2) return "Medium";
  return "Low";
}

export interface DuplicationAnalysis {
  result: AnalyzerResult;
  blocks: DuplicateBlock[];
  duplicatedLineCount: number;
  totalSignificantLineCount: number;
}

export function analyzeDuplication(files: SourceFile[], settings: EffectiveScanSettings): DuplicationAnalysis {
  const blockSize = Math.max(3, settings.minDuplicateBlockSize);
  const perFileLines = files.map(extractSignificantLines);
  const totalSignificantLines = perFileLines.reduce((sum, lines) => sum + lines.length, 0);

  // windowKey -> every position where that exact window of `blockSize` normalized lines occurs
  const windowIndex = new Map<string, FilePos[]>();
  for (let fileIndex = 0; fileIndex < perFileLines.length; fileIndex++) {
    const lines = perFileLines[fileIndex];
    for (let lineIndex = 0; lineIndex + blockSize <= lines.length; lineIndex++) {
      const key = lines
        .slice(lineIndex, lineIndex + blockSize)
        .map((l) => l.text)
        .join("\n");
      const positions = windowIndex.get(key);
      if (positions) positions.push({ fileIndex, lineIndex });
      else windowIndex.set(key, [{ fileIndex, lineIndex }]);
    }
  }

  const consumed: Set<number>[] = perFileLines.map(() => new Set());
  const blocks: DuplicateBlock[] = [];

  function textAt(pos: FilePos): string | undefined {
    return perFileLines[pos.fileIndex][pos.lineIndex]?.text;
  }

  for (const positions of windowIndex.values()) {
    if (positions.length < 2) continue;

    for (let i = 0; i < positions.length; i++) {
      const a = positions[i];
      if (consumed[a.fileIndex].has(a.lineIndex)) continue;

      for (let j = i + 1; j < positions.length; j++) {
        const b = positions[j];
        if (a.fileIndex === b.fileIndex && a.lineIndex === b.lineIndex) continue;
        if (consumed[b.fileIndex].has(b.lineIndex)) continue;

        // Extend the match line-by-line for as long as both files keep agreeing, so a long
        // duplicated function reports as ONE block instead of many overlapping minimum-size
        // windows.
        let length = blockSize;
        while (textAt({ fileIndex: a.fileIndex, lineIndex: a.lineIndex + length }) !== undefined && textAt({ fileIndex: a.fileIndex, lineIndex: a.lineIndex + length }) === textAt({ fileIndex: b.fileIndex, lineIndex: b.lineIndex + length })) {
          length++;
        }

        const aLines = perFileLines[a.fileIndex];
        const bLines = perFileLines[b.fileIndex];
        blocks.push({
          sourceFile: files[a.fileIndex].relativePath,
          sourceStartLine: aLines[a.lineIndex].originalLineNo,
          sourceEndLine: aLines[a.lineIndex + length - 1].originalLineNo,
          matchingFile: files[b.fileIndex].relativePath,
          matchingStartLine: bLines[b.lineIndex].originalLineNo,
          matchingEndLine: bLines[b.lineIndex + length - 1].originalLineNo,
          lineCount: length,
          similarityPercent: 100,
        });

        for (let k = 0; k < length; k++) {
          consumed[a.fileIndex].add(a.lineIndex + k);
          consumed[b.fileIndex].add(b.lineIndex + k);
        }
        break; // a's window is consumed now - move to the next unconsumed position
      }
    }
  }

  const duplicatedLineCount = consumed.reduce((sum, set) => sum + set.size, 0);
  const duplicationPercent = totalSignificantLines > 0 ? Math.round((duplicatedLineCount / totalSignificantLines) * 10000) / 100 : 0;
  const affectedFiles = new Set<string>();
  blocks.forEach((b) => {
    affectedFiles.add(b.sourceFile);
    affectedFiles.add(b.matchingFile);
  });

  const issues: AnalyzerIssue[] = blocks.map((b) => ({
    category: "Duplication",
    ruleCode: "duplication.block",
    title: `${b.lineCount}-line block duplicated in ${b.matchingFile}`,
    description: `This block of ${b.lineCount} lines is duplicated in "${b.matchingFile}" (lines ${b.matchingStartLine}-${b.matchingEndLine}).`,
    filePath: b.sourceFile,
    startLine: b.sourceStartLine,
    endLine: b.sourceEndLine,
    severity: severityForBlock(b.lineCount, settings),
    confidenceLevel: "High",
    recommendation: "Extract the shared logic into a single function or module and have both locations call it.",
  }));

  const metrics: AnalyzerMetric[] = [
    { metricType: "Duplication", metricName: "DuplicationPercent", value: duplicationPercent, threshold: settings.duplicationThresholdPercent },
    { metricType: "Duplication", metricName: "DuplicatedBlockCount", value: blocks.length },
    { metricType: "Duplication", metricName: "AffectedFileCount", value: affectedFiles.size },
  ];

  return { result: { issues, metrics }, blocks, duplicatedLineCount, totalSignificantLineCount: totalSignificantLines };
}
