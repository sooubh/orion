const { v4 } = require("uuid");
const {
  getVectorDbClass,
  resolveProviderConnector,
} = require("../../../helpers");
const { Deduplicator } = require("../utils/dedupe");
const { HybridSearch } = require("../../../retrieval/hybridSearch");

const memory = {
  name: "rag-memory",
  startupConfig: {
    params: {},
  },
  plugin: function () {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          tracker: new Deduplicator(),
          name: this.name,
          description:
            "Search uploaded documents by content, semantic meaning, keywords and metadata. Use filename lookup only when the user explicitly identifies a filename. Search across all workspace files for facts, measurements, equipment readings, procedures, and findings. Use store only when explicitly asked to remember or save something.",
          examples: [
            {
              prompt: "Analyze the C-204 inspection report findings and measurements",
              call: JSON.stringify({
                action: "search",
                content: "C-204 inspection report findings measurements follow-up actions",
              }),
            },
            {
              prompt: "What does the maintenance procedure say about vibration above 7.0 mm/s?",
              call: JSON.stringify({
                action: "search",
                content: "maintenance SOP vibration above 7.0 mm/s threshold",
              }),
            },
            {
              prompt: "Which document contains the 7.8 mm/s vibration reading?",
              call: JSON.stringify({
                action: "search",
                content: "7.8 mm/s vibration reading",
              }),
            },
            {
              prompt: "Remember that you are a robot",
              call: JSON.stringify({
                action: "store",
                content: "I am a robot, the user told me that i am.",
              }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["search", "store"],
                description:
                  "The action we want to take to search for existing similar context or storage of new context.",
              },
              content: {
                type: "string",
                description:
                  "The plain text query to search our local documents with by content, meaning, keywords, or entities, or to store in our vector database.",
              },
            },
            additionalProperties: false,
          },
          handler: async function ({ action = "", content = "" }) {
            try {
              const { isDuplicate } = this.tracker.isDuplicate(this.name, {
                action,
                content,
              });
              if (isDuplicate)
                return `This was a duplicated call and it's output will be ignored.`;

              let response = "There was nothing to do.";
              if (action === "search") response = await this.search(content);
              if (action === "store") response = await this.store(content);

              this.tracker.trackRun(this.name, { action, content });
              return response;
            } catch (error) {
              console.log(error);
              return `There was an error while calling the function. ${error.message}`;
            }
          },
          search: async function (query = "") {
            try {
              const workspace = this.super.handlerProps.invocation.workspace;
              const { connector: LLMConnector } =
                await resolveProviderConnector({
                  workspace,
                  prompt: query,
                });

              const user = this.super.handlerProps.invocation.user_id
                ? { id: this.super.handlerProps.invocation.user_id }
                : null;

              const searchResult = await HybridSearch.searchWorkspace({
                workspace,
                query,
                user,
                LLMConnector,
                topN: workspace?.topN ?? 6,
                similarityThreshold: workspace?.similarityThreshold ?? 0.20,
                rerank: workspace?.vectorSearchMode === "rerank",
              });

              if (!searchResult.sources || searchResult.sources.length === 0) {
                this.super.introspect(
                  `${this.caller}: No relevant documents found in workspace for query "${query}".`
                );
                return (
                  searchResult.message ||
                  "No relevant document was found in the current workspace."
                );
              }

              this.super.introspect(
                `${this.caller}: Found ${searchResult.sources.length} relevant document source(s) to answer this question.`
              );

              this.super.addCitation?.(searchResult.sources);
              return searchResult.combinedContext;
            } catch (error) {
              this.super.handlerProps.log(
                `memory.search raised an error. ${error.message}`
              );
              return `An error was raised while searching the workspace documents. ${error.message}`;
            }
          },
          store: async function (content = "") {
            try {
              const workspace = this.super.handlerProps.invocation.workspace;
              const vectorDB = getVectorDbClass();
              const { error } = await vectorDB.addDocumentToNamespace(
                workspace.slug,
                {
                  docId: v4(),
                  id: v4(),
                  url: "file://embed-via-agent.txt",
                  title: "agent-memory.txt",
                  docAuthor: "@agent",
                  description: "Unknown",
                  docSource: "a text file stored by the workspace agent.",
                  chunkSource: "",
                  published: new Date().toLocaleString(),
                  wordCount: content.split(" ").length,
                  pageContent: content,
                  token_count_estimate: 0,
                },
                null
              );

              if (!!error)
                return "The content was failed to be embedded properly.";
              this.super.introspect(
                `${this.caller}: I saved the content to long-term memory in this workspaces vector database.`
              );
              return "The content given was successfully embedded. There is nothing else to do.";
            } catch (error) {
              this.super.handlerProps.log(
                `memory.store raised an error. ${error.message}`
              );
              return `Let the user know this action was not successful. An error was raised while storing data in the vector database. ${error.message}`;
            }
          },
        });
      },
    };
  },
};

module.exports = {
  memory,
};
