#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_RECORDS_PATH = "docs/test-data/signal-record-v1-batch-001.jsonl";
const DEFAULT_QUESTIONS_PATH = "docs/signal-record-v1-questions.md";
const DEFAULT_OUTPUT_DIR = "docs/test-data/results";
const DEFAULT_TRANSCRIPTS_PATH = "";
const TOP_K = 3;
const RECENT_WINDOW_DAYS = 14;
const OLD_WINDOW_DAYS = 60;

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

const POSITIVE_STANCE_MARKERS = [
  "benefit",
  "improve",
  "growth",
  "opportunity",
  "solution",
  "success",
  "better",
  "supports",
  "effective",
  "bullish",
];

const NEGATIVE_STANCE_MARKERS = [
  "risk",
  "problem",
  "worse",
  "crisis",
  "decline",
  "danger",
  "fails",
  "broken",
  "harm",
  "bearish",
  "chaos",
];

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

function tokenOverlap(questionTokens, recordTokens) {
  if (!questionTokens.length || !recordTokens.length) return 0;
  const recordSet = new Set(recordTokens);
  let count = 0;
  for (const token of questionTokens) {
    if (recordSet.has(token)) count++;
  }
  return count;
}

function detectIntent(question) {
  const q = question.toLowerCase();
  if (q.includes("against") || q.includes("disagree") || q.includes("assumptions differ")) {
    return "debate";
  }
  if (q.includes("consistent") || q.includes("follow directly")) {
    return "creator_consistency";
  }
  if (q.includes("changed recently") || q.includes("last 14 days") || q.includes("miss")) {
    return "recency";
  }
  if (q.includes("outdated")) {
    return "outdated";
  }
  if (q.includes("overrepresented") || q.includes("balanced context")) {
    return "diversity";
  }
  if (q.includes("actions i should") || q.includes("top three practical actions")) {
    return "actions";
  }
  if (q.includes("what should i read next") || q.includes("read next")) {
    return "recommendation";
  }
  return "default";
}

function trustScore(level) {
  if (level === "high") return 2;
  if (level === "med") return 1;
  return 0;
}

function resolveTranscript(record, transcriptMap) {
  const sidecar =
    typeof record?.source_url === "string"
      ? transcriptMap.get(record.source_url)
      : undefined;
  const inline =
    typeof record?.transcript === "string"
      ? record.transcript
      : typeof record?.transcript_text === "string"
      ? record.transcript_text
      : undefined;
  return sidecar ?? inline ?? null;
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

function parseDateMs(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function computeStanceScore(tokens) {
  const set = new Set(tokens);
  const positive = POSITIVE_STANCE_MARKERS.filter((marker) => set.has(marker)).length;
  const negative = NEGATIVE_STANCE_MARKERS.filter((marker) => set.has(marker)).length;
  return positive - negative;
}

function buildCorpus(records, transcriptMap) {
  const creatorCounts = new Map();
  const metas = [];

  for (const record of records) {
    const creatorId = record.creator_id ?? "unknown";
    creatorCounts.set(creatorId, (creatorCounts.get(creatorId) ?? 0) + 1);
  }

  const maxCreatorCount = Math.max(1, ...creatorCounts.values());

  const publishedValues = records
    .map((record) => parseDateMs(record.published_at))
    .filter((value) => value !== null);
  const newestPublishedAt = publishedValues.length
    ? Math.max(...publishedValues)
    : Date.now();
  const oldestPublishedAt = publishedValues.length
    ? Math.min(...publishedValues)
    : newestPublishedAt;
  const dateRange = Math.max(1, newestPublishedAt - oldestPublishedAt);

  for (const record of records) {
    const transcript = resolveTranscript(record, transcriptMap);
    const text = buildRecordText(record, transcript);
    const tokens = tokenize(text);
    const publishedAtMs = parseDateMs(record.published_at);
    const recencyScore =
      publishedAtMs === null ? 0.2 : (publishedAtMs - oldestPublishedAt) / dateRange;

    metas.push({
      record,
      tokens,
      transcriptPresent: Boolean(transcript),
      publishedAtMs,
      recencyScore,
      trust: trustScore(record.trust_level),
      creatorCount: creatorCounts.get(record.creator_id ?? "unknown") ?? 1,
      creatorConsistency: (creatorCounts.get(record.creator_id ?? "unknown") ?? 1) / maxCreatorCount,
      diversityBoost: 1 - (creatorCounts.get(record.creator_id ?? "unknown") ?? 1) / maxCreatorCount,
      stanceScore: computeStanceScore(tokens),
      ageDays:
        publishedAtMs === null
          ? null
          : Math.max(0, (Date.now() - publishedAtMs) / (1000 * 60 * 60 * 24)),
    });
  }

  return {
    metas,
    maxCreatorCount,
  };
}

function scoreByIntent(meta, questionTokens, intent) {
  const overlap = tokenOverlap(questionTokens, meta.tokens);
  const relevanceScore = overlap * 2;
  const transcriptBonus = meta.transcriptPresent ? 1 : 0;
  const citationBonus = meta.record.source_url ? 1 : 0;

  switch (intent) {
    case "creator_consistency":
      return (
        relevanceScore +
        meta.creatorConsistency * 4 +
        meta.trust * 1.5 +
        meta.recencyScore +
        citationBonus +
        transcriptBonus
      );
    case "recency":
      return (
        relevanceScore +
        meta.recencyScore * 4 +
        meta.trust +
        citationBonus +
        transcriptBonus
      );
    case "outdated":
      return (
        relevanceScore +
        (meta.ageDays !== null && meta.ageDays > OLD_WINDOW_DAYS ? 3 : 0) +
        meta.trust +
        citationBonus +
        transcriptBonus
      );
    case "diversity":
      return (
        relevanceScore +
        meta.diversityBoost * 4 +
        meta.trust +
        meta.recencyScore +
        citationBonus +
        transcriptBonus
      );
    case "debate":
      return (
        relevanceScore +
        Math.abs(meta.stanceScore) * 2 +
        meta.trust +
        meta.recencyScore +
        citationBonus +
        transcriptBonus
      );
    case "actions":
    case "recommendation":
      return (
        relevanceScore +
        meta.trust * 2 +
        meta.recencyScore * 2 +
        meta.creatorConsistency +
        citationBonus +
        transcriptBonus
      );
    default:
      return (
        relevanceScore +
        meta.trust +
        meta.recencyScore +
        citationBonus +
        transcriptBonus
      );
  }
}

function selectTopWithDiversity(scored, limit) {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const selected = [];
  const usedCreators = new Set();

  for (const item of sorted) {
    if (selected.length >= limit) break;

    const creatorId = item.meta.record.creator_id ?? "unknown";
    const wantDiversity = selected.length < 2;
    if (wantDiversity && usedCreators.has(creatorId)) {
      continue;
    }

    selected.push(item);
    usedCreators.add(creatorId);
  }

  if (selected.length < limit) {
    for (const item of sorted) {
      if (selected.length >= limit) break;
      if (selected.some((entry) => entry.meta.record.id === item.meta.record.id)) {
        continue;
      }
      selected.push(item);
    }
  }

  return selected;
}

function hasContradiction(selected) {
  const stances = selected.map((item) => item.meta.stanceScore);
  const hasPositive = stances.some((value) => value > 0);
  const hasNegative = stances.some((value) => value < 0);
  return hasPositive && hasNegative;
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

function evaluateQuestion(question, corpus) {
  const intent = detectIntent(question.question);
  const questionTokens = tokenize(question.question);

  const scored = corpus.metas.map((meta) => ({
    meta,
    score: scoreByIntent(meta, questionTokens, intent),
  }));

  const selected = selectTopWithDiversity(scored, TOP_K);
  const topRecords = selected.map((item) => item.meta.record);
  const citations = topRecords
    .map((record) => record.source_url)
    .filter((value) => typeof value === "string");
  const trustLevels = topRecords.map((record) => record.trust_level ?? "med");
  const uniqueCreators = new Set(
    topRecords.map((record) => record.creator_id ?? "unknown"),
  ).size;

  const topScore = selected[0]?.score ?? 0;
  const lowTrustCount = trustLevels.filter((t) => t === "low").length;
  const transcriptHits = selected.filter((item) => item.meta.transcriptPresent).length;
  const contradiction = hasContradiction(selected);
  const recentCount = selected.filter(
    (item) => item.meta.ageDays !== null && item.meta.ageDays <= RECENT_WINDOW_DAYS,
  ).length;
  const oldCount = selected.filter(
    (item) => item.meta.ageDays !== null && item.meta.ageDays > OLD_WINDOW_DAYS,
  ).length;

  const cited = citations.length > 0;

  let useful;
  switch (intent) {
    case "debate":
      useful = cited && uniqueCreators >= 2 && (contradiction || topScore >= 5);
      break;
    case "creator_consistency":
      useful = cited && uniqueCreators >= 2 && selected.some((item) => item.meta.creatorCount >= 2);
      break;
    case "recency":
      useful = cited && recentCount >= 2;
      break;
    case "outdated":
      useful = cited && recentCount >= 1 && oldCount >= 1;
      break;
    case "diversity":
      useful = cited && uniqueCreators >= 2;
      break;
    case "actions":
    case "recommendation":
      useful = cited && uniqueCreators >= 2 && topScore >= 3;
      break;
    default:
      useful = cited && topScore >= 2;
      break;
  }

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
    notes: `intent=${intent}; top_score=${topScore.toFixed(2)}; creators=${uniqueCreators}; citations=${citations.length}; recent=${recentCount}; old=${oldCount}; transcripts_used=${transcriptHits}; contradiction=${contradiction}`,
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
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replaceAll('"', '""')}"`;
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

  const corpus = buildCorpus(records, transcriptMap);
  const rows = questions.map((question) => evaluateQuestion(question, corpus));
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
