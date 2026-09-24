const { TASK_TYPES } = require("../contracts/types");

/**
 * Deterministic taxonomy pattern rules.
 * Uses sub-millisecond regex / keyword matching for zero latency overhead.
 */
const TASK_PATTERNS = [
  {
    type: TASK_TYPES.CODE_REVIEW,
    pattern:
      /\b(review code|code review|audit code|lint|find bug|security vulnerability in|refactor code|inspect function)\b/i,
    priority: 90,
  },
  {
    type: TASK_TYPES.CODE_GENERATION,
    pattern:
      /(```|\b(write code|generate code|implement function|write script|create class|sql query|python script|javascript function|bash script)\b)/i,
    priority: 85,
  },
  {
    type: TASK_TYPES.DOCUMENT_SUMMARY,
    pattern:
      /\b(summarize|summary|tldr|brief overview|key takeaways|synopsis|executive summary|recap)\b/i,
    priority: 80,
  },
  {
    type: TASK_TYPES.DOCUMENT_EXTRACTION,
    pattern:
      /\b(extract|extract entities|parse json|pull out fields|extract table|tabular data|scrape fields|key-value pairs)\b/i,
    priority: 75,
  },
  {
    type: TASK_TYPES.CALCULATION,
    pattern:
      /\b(calculate|computation|solve equation|formula|sum of|percentage|arithmetic|math problem)\b/i,
    priority: 70,
  },
  {
    type: TASK_TYPES.DATA_ANALYSIS,
    pattern:
      /\b(analyze dataset|data analysis|correlation|statistical|metrics|trend analysis|distribution|dataset)\b/i,
    priority: 65,
  },
  {
    type: TASK_TYPES.REPORT_GENERATION,
    pattern:
      /\b(generate report|full report|formal report|write report|compliance report|audit report)\b/i,
    priority: 60,
  },
  {
    type: TASK_TYPES.GENERAL_REASONING,
    pattern:
      /\b(think step by step|chain of thought|deduce|hypothesize|evaluate pros and cons|logical deduction|counterfactual)\b/i,
    priority: 50,
  },
  {
    type: TASK_TYPES.MULTIMODAL_ANALYSIS,
    pattern:
      /\b(inspect image|image analysis|visual inspection|describe image|transcribe image|ocr|scanned document)\b/i,
    priority: 40,
  },
];

const CODE_INDICATORS = [
  /```[\s\S]*?```/,
  /\b(function\s*\w*\s*\(|def\s+\w+\s*\(|(?:const|let|var)\s+\w+\s*=|import\s+(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+['"][^'"]+['"]|import\s+['"][^'"]+['"]|from\s+\w+\s+import\s+|class\s+[A-Za-z0-9_]+\s*(?:extends\s+\w+\s*)?\{|class\s+[A-Za-z0-9_]+\s*(?:\([^)]*\))?\s*:|SELECT\s+[\s\S]+?\s+FROM|git\s+(commit|push|pull|checkout|branch|merge|status|clone|diff)\b)/i,
];

module.exports = {
  TASK_PATTERNS,
  CODE_INDICATORS,
};
