const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { SystemSettings } = require("../models/systemSettings");
const { WORKSPACE_AGENT } = require("../utils/agents/defaults");
const { memory } = require("../utils/agents/aibitat/plugins/memory");
const { docSummarizer } = require("../utils/agents/aibitat/plugins/summarize");

describe("SIH PS 26117 — Strict Document Grounding & Agent Retrieval Rules", () => {
  describe("1. SystemSettings.saneDefaultSystemPrompt", () => {
    it("should enforce strict document grounding in rule 4", () => {
      const prompt = SystemSettings.saneDefaultSystemPrompt;
      assert.ok(
        prompt.includes("When a query is document-grounded"),
        "Must specify document-grounded query rule"
      );
      assert.ok(
        prompt.includes(
          "I could not find sufficient relevant information in the uploaded documents to answer this question."
        ),
        "Must contain exact truthful failure string"
      );
      assert.ok(
        prompt.includes(
          "NEVER fall back to general model knowledge or provide general knowledge alternatives like \"However, based on general knowledge...\"."
        ),
        "Must strictly forbid fallback to general knowledge"
      );
      assert.ok(
        prompt.includes(
          "Only when a query is general-knowledge and does NOT request uploaded documents may general knowledge be used."
        ),
        "Must restrict general knowledge use to non-document queries only"
      );
    });
  });

  describe("2. WORKSPACE_AGENT.getDefinition Guidelines", () => {
    it("should append complete Document Grounding & Retrieval Guidelines to agent role", async () => {
      const definition = await WORKSPACE_AGENT.getDefinition();
      const role = definition.role;

      // Mode distinction
      assert.ok(
        role.includes("Mode Distinction") &&
          role.includes("Document-Grounded requests") &&
          role.includes("General-Knowledge requests"),
        "Must instruct on mode distinction"
      );

      // Search by content first
      assert.ok(
        role.includes("Search by Content First") &&
          role.includes("rag-memory") &&
          role.includes("NEVER invent, fabricate, or guess document filenames"),
        "Must instruct to search by content first without guessing filenames"
      );

      // Strict evidence requirement
      assert.ok(
        role.includes("Strict Evidence Requirement") &&
          role.includes("Never add unsupported claims from general model knowledge") &&
          role.includes('Never claim "According to the uploaded documents..." unless relevant content was actually retrieved'),
        "Must enforce strict evidence requirement"
      );

      // Mandatory no-fallback rule
      assert.ok(
        role.includes("Mandatory No-Fallback Rule") &&
          role.includes('NEVER say "However, based on general knowledge..."') &&
          role.includes("I could not find sufficient relevant information in the uploaded documents to answer this question."),
        "Must enforce mandatory no-fallback rule"
      );

      // Multi-document comparison
      assert.ok(
        role.includes("Multi-Document Comparison") &&
          role.includes("search for all concepts across all documents in the workspace using rag-memory"),
        "Must instruct on multi-document comparison grounded in retrieved evidence"
      );
    });
  });

  describe("3. rag-memory Plugin Directive on No Sources", () => {
    it("should return explicit directive when searchWorkspace yields no sources", async () => {
      let registeredFunc = null;
      const mockAibitat = {
        function: (config) => {
          registeredFunc = config;
        },
        introspect: () => {},
        caller: "agent",
        handlerProps: {
          invocation: {
            workspace: {
              slug: "test-empty-ws",
              id: 999999,
              topN: 4,
              similarityThreshold: 0.2,
            },
            user_id: null,
          },
          log: () => {},
        },
      };

      const pluginInstance = memory.plugin();
      pluginInstance.setup(mockAibitat);

      assert.ok(registeredFunc, "rag-memory function must be registered");

      const response = await registeredFunc.search("unmatched fictional test query 12345");
      const expectedDirective =
        'NO_RELEVANT_DOCUMENTS: No relevant document was found in the current workspace for query. Because this request is document-grounded, state that you could not find sufficient relevant information in the uploaded documents to answer this question. DO NOT answer from general model knowledge, and NEVER say \'However, based on general knowledge...\'.';

      assert.equal(response, expectedDirective);
    });
  });

  describe("4. document-summarizer Plugin Tool Description", () => {
    it("should clarify that summarizer is only for listing files or explicitly identified documents", () => {
      let registeredFunc = null;
      const mockAibitat = {
        function: (config) => {
          registeredFunc = config;
        },
        introspect: () => {},
        caller: "agent",
        handlerProps: {
          invocation: {},
          log: () => {},
        },
      };

      const pluginInstance = docSummarizer.plugin();
      pluginInstance.setup(mockAibitat);

      assert.ok(registeredFunc, "document-summarizer function must be registered");
      assert.ok(
        registeredFunc.description.includes(
          "List all documents in the workspace or summarize an explicitly identified document by exact name"
        ),
        "Description must state it is only for listing or exact name summarization"
      );
      assert.ok(
        registeredFunc.description.includes(
          "For natural-language queries, questions, comparisons, differences, or concepts, rag-memory must be used."
        ),
        "Description must direct natural-language and conceptual queries to rag-memory"
      );
    });
  });

  describe("5. AIbitat Strict Document-Grounded Failure Interceptor", () => {
    const AIbitat = require("../utils/agents/aibitat");

    const FAILURE_MESSAGE =
      "I could not find sufficient relevant information in the uploaded documents to answer this question.";

    it("should intercept 'However, based on general knowledge...' for document-grounded prompts", () => {
      const aibitat = new AIbitat();
      const messages = [
        {
          role: "user",
          content: "According to the uploaded documents, what is the bearing temperature limit?",
        },
      ];
      const modelOutput =
        "No relevant documents were found. However, based on general knowledge, bearing temperatures typically should not exceed 80°C.";

      const result = aibitat.interceptDocumentGroundedFailure(modelOutput, messages);
      assert.equal(result.intercepted, true);
      assert.equal(result.text, FAILURE_MESSAGE);
    });

    it("should intercept general knowledge fallback when rag-memory was invoked and returned no sources", () => {
      const aibitat = new AIbitat();
      const messages = [
        {
          role: "user",
          content: "What is the vibration threshold for pump P-101?",
        },
        {
          role: "function",
          name: "rag-memory",
          content:
            "NO_RELEVANT_DOCUMENTS: No relevant document was found in the current workspace for query.",
        },
      ];
      const modelOutput =
        "Could not find any relevant documents in the workspace. However, based on general knowledge, vibration thresholds are usually 7 mm/s.";

      const result = aibitat.interceptDocumentGroundedFailure(modelOutput, messages);
      assert.equal(result.intercepted, true);
      assert.equal(result.text, FAILURE_MESSAGE);
    });

    it("should strictly intercept ungrounded answers when user explicitly requests 'Use only the uploaded documents'", () => {
      const aibitat = new AIbitat();
      const messages = [
        {
          role: "user",
          content: "Use only the uploaded documents to explain the oil change interval.",
        },
      ];
      // LLM attempts to answer from general knowledge without citing any documents
      const modelOutput =
        "The oil change interval is 6 months or 1000 operational hours.";

      const result = aibitat.interceptDocumentGroundedFailure(modelOutput, messages);
      assert.equal(result.intercepted, true);
      assert.equal(result.text, FAILURE_MESSAGE);
    });

    it("should preserve document-grounded answer when valid citations exist", () => {
      const aibitat = new AIbitat();
      aibitat.addCitation({
        id: "chunk-1",
        title: "maintenance_sop.pdf",
        text: "The vibration threshold for P-101 is 7.0 mm/s.",
      });

      const messages = [
        {
          role: "user",
          content: "According to the uploaded documents, what is the vibration threshold for P-101?",
        },
        {
          role: "function",
          name: "rag-memory",
          content: "Found relevant sources: ...",
        },
      ];
      const modelOutput =
        "According to the maintenance SOP, the vibration threshold for P-101 is 7.0 mm/s.";

      const result = aibitat.interceptDocumentGroundedFailure(modelOutput, messages);
      assert.equal(result.intercepted, false);
      assert.equal(result.text, modelOutput);
    });

    it("should preserve general-knowledge answers for non-document queries", () => {
      const aibitat = new AIbitat();
      const messages = [
        {
          role: "user",
          content: "What is the capital of Australia?",
        },
      ];
      const modelOutput = "The capital of Australia is Canberra.";

      const result = aibitat.interceptDocumentGroundedFailure(modelOutput, messages);
      assert.equal(result.intercepted, false);
      assert.equal(result.text, modelOutput);
    });
  });

  describe("6. Stream Chat Document Grounding & Refusal Logic", () => {
    const { HybridSearch } = require("../utils/retrieval/hybridSearch");

    it("should detect document-grounded queries accurately via analyzeQuery", () => {
      assert.equal(
        HybridSearch.analyzeQuery("use only the uploaded documents to check the date").isDocumentGrounded,
        true
      );
      assert.equal(
        HybridSearch.analyzeQuery("According to the uploaded documents, what happened?").isDocumentGrounded,
        true
      );
      assert.equal(
        HybridSearch.analyzeQuery("based on the files in this workspace, summarize findings").isDocumentGrounded,
        true
      );
      assert.equal(
        HybridSearch.analyzeQuery("compare the uploaded files").isDocumentGrounded,
        true
      );
      assert.equal(
        HybridSearch.analyzeQuery("Write a python script to sort an array").isDocumentGrounded,
        false
      );
    });
  });
});

