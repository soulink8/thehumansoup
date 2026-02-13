#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_RECORDS_PATH = "docs/test-data/signal-record-v1-batch-001.jsonl";
const DEFAULT_QUESTIONS_PATH = "docs/signal-record-v1-questions.md";
const DEFAULT_OUTPUT_DIR = "docs/test-data/results";
const DEFAULT_TRANSCRIPTS_PATH = "";
const TOP_K = 3;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "you",
  "your",
]);

function parseArgs(argv) {
  const args = {
    records: DEFAULT_RECORDS_PATH,
    questions: DEFAULT_QUESTIONS_PATH,
    outDir: DEFAULT_OUTPUT_DIR,
    transcripts: DEFAULT_TRANSCRIPTS_PATH,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--records" && next) {
      args.records = next;
      i++;
      continue;
    }
    if (arg === "--questions" && next) {
      args.questions = next;
      i++;
      continue;
    }
    if (arg === "--out-dir" && next) {
      args.outDir = next;
      i++;
      continue;
    }
    if (arg === "--transcripts" && next) {
      args.transcripts = next;
      i++;
      continue;
    }
  }

  return args;
}

function readJsonl(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${filePath}:${index + 1}: ${error}`);
      }
    });
}

function readQuestionsMarkdown(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const questions = [];
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\.\s+(.+)\s*$/);
    if (!match) continue;
    questions.push({
      questionId: `Q${match[1]}`,
      question: match[2].trim(),
    });
  }

  if (questions.length === 0) {
    throw new Error(`No numbered questions found in ${filePath}`);
  }

  return questions;
}

function loadTranscriptMap(filePath) {
  if (!filePath) return new Map();
  const rows = readJsonl(filePath);
  const map = new Map();

  for (const row of rows) {
    const sourceUrl = row?.source_url;
    const transcript = row?.transcript;
    if (typeof sourceUrl === "string" && typeof transcript === "string") {
      map.set(sourceUrl, transcript);
    }
  }

  return map;
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function buildRecordText(record, transcript) {
  return [
    record.title,
    record.claim,
    record.excerpt,
    record.why_it_matters,
    record.content_type,
    transcript,
  ]
    .filter(Boolean)
    .join(" ");
}

function scoreRecord(questionTokens, recordTokens, record, transcript) {
  if (questionTokens.length === 0) return 0;
  const tokenSet = new Set(recordTokens);
  let overlap = 0;

  for (const token of questionTokens) {
    if (tokenSet.has(token)) overlap++;
  }

  const overlapScore = overlap * 2;
  const trustBoost =
    record.trust_level === "high" ? 2 : record.trust_level === "med" ? 1 : 0;
  const citationBoost = record.source_url ? 1 : 0;
  const transcriptBoost = transcript ? 1 : 0;

  return overlapScore + trustBoost + citationBoost + transcriptBoost;
}

function toYesNo(value) {
  return value ? "yes" : "no";
}

function summariseRecords(records) {
  return records
    .map((record) => {
      const url = record.source_url ?? "(no source_url)";
      return `- ${record.title ?? "Untitled"} (${url})`;
    })
    .join("\n");
}

function evaluateQuestion(question, records, transcriptMap) {
  const questionTokens = tokenize(question.question);
  const ranked = records
    .map((record) => {
      const transcript = record.source_url
        ? transcriptMap.get(record.source_url)
        : undefined;
      const recordText = buildRecordText(record, transcript);
      const recordTokens = tokenize(recordText);
      const score = scoreRecord(questionTokens, recordTokens, record, transcript);
      return { record, score, transcriptUsed: Boolean(transcript) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  const topRecords = ranked.map((item) => item.record);
  const citations = topRecords
    .map((record) => record.source_url)
    .filter((value) => typeof value === "string");
  const trustLevels = topRecords.map((record) => record.trust_level ?? "med");

  const topScore = ranked[0]?.score ?? 0;
  const lowTrustCount = trustLevels.filter((t) => t === "low").length;
  const transcriptHits = ranked.filter((item) => item.transcriptUsed).length;

  const useful =
    topScore >= 4 &&
    topRecords.length >= 2 &&
    citations.length >= 2 &&
    questionTokens.length > 0;
  const cited = citations.length > 0;
  const trustworthy =
    cited &&
    lowTrustCount <= 1 &&
    trustLevels.filter((t) => t === "high" || t === "med").length >= 2;

  return {
    question_id: question.questionId,
    question: question.question,
    useful: toYesNo(useful),
    cited: toYesNo(cited),
    trustworthy: toYesNo(trustworthy),
    notes: `top_score=${topScore}; citations=${citations.length}; transcripts_used=${transcriptHits}`,
    top_records: topRecords.map((record) => ({
      id: record.id,
      title: record.title,
      source_url: record.source_url ?? null,
      trust_level: record.trust_level ?? "med",
    })),
    answer_preview: summariseRecords(topRecords),
  };
}

function computeMetrics(rows) {
  const total = rows.length;
  const useful = rows.filter((row) => row.useful === "yes").length;
  const cited = rows.filter((row) => row.cited === "yes").length;
  const trustworthy = rows.filter((row) => row.trustworthy === "yes").length;

  const percentage = (value) =>
    total === 0 ? 0 : Number(((value / total) * 100).toFixed(1));

  return {
    total_questions: total,
    useful_yes: useful,
    useful_pct: percentage(useful),
    cited_yes: cited,
    cited_pct: percentage(cited),
    trustworthy_yes: trustworthy,
    trustworthy_pct: percentage(trustworthy),
    pass_thresholds: {
      useful: useful >= 7,
      cited: cited >= 9,
      trustworthy: trustworthy >= 8,
    },
  };
}

function toCsv(rows) {
  const header = ["question_id", "question", "useful", "cited", "trustworthy", "notes"];
  const escape = (value) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replaceAll("\"", "\"\"")}"`;
    }
    return text;
  };

  const lines = [header.join(",")];
  for (const row of rows) {
    const line = header.map((key) => escape(row[key])).join(",");
    lines.push(line);
  }
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const records = readJsonl(args.records);
  const questions = readQuestionsMarkdown(args.questions);
  const transcriptMap = loadTranscriptMap(args.transcripts);

  const rows = questions.map((question) =>
    evaluateQuestion(question, records, transcriptMap),
  );
  const metrics = computeMetrics(rows);

  fs.mkdirSync(args.outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(args.outDir, `signal-record-v1-eval-report-${timestamp}.json`);
  const latestReportPath = path.join(args.outDir, "signal-record-v1-eval-report-latest.json");
  const scorecardPath = path.join(args.outDir, `signal-record-v1-scorecard-auto-${timestamp}.csv`);
  const latestScorecardPath = path.join(args.outDir, "signal-record-v1-scorecard-auto-latest.csv");

  const report = {
    created_at: new Date().toISOString(),
    input: {
      records_path: args.records,
      questions_path: args.questions,
      transcripts_path: args.transcripts || null,
      records_count: records.length,
      questions_count: questions.length,
    },
    metrics,
    results: rows,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(latestReportPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(scorecardPath, toCsv(rows));
  fs.writeFileSync(latestScorecardPath, toCsv(rows));

  console.log(`Evaluation complete.
Report: ${reportPath}
Scorecard: ${scorecardPath}
Useful: ${metrics.useful_yes}/${metrics.total_questions} (${metrics.useful_pct}%)
Cited: ${metrics.cited_yes}/${metrics.total_questions} (${metrics.cited_pct}%)
Trustworthy: ${metrics.trustworthy_yes}/${metrics.total_questions} (${metrics.trustworthy_pct}%)
Threshold pass: useful=${metrics.pass_thresholds.useful}, cited=${metrics.pass_thresholds.cited}, trustworthy=${metrics.pass_thresholds.trustworthy}`);
}

main();
