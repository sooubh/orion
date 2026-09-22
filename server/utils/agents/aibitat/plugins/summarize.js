const { Document } = require("../../../../models/documents");
const { safeJsonParse } = require("../../../http");
const { summarizeContent } = require("../utils/summarize");
const Provider = require("../providers/ai-provider");
const { HybridSearch } = require("../../../retrieval/hybridSearch");
const { resolveProviderConnector } = require("../../../helpers");

const docSummarizer = {
  name: "document-summarizer",
  startupConfig: {
    params: {},
  },
  plugin: function () {
    return {
      name: this.name,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          description:
            "List all documents in the workspace or summarize an explicitly specified document. To search document content by topic, concept, question, or measurements, use rag-memory instead. Only use summarize when a specific document is identified.",
          examples: [
            {
              prompt: "List my files",
              call: JSON.stringify({ action: "list", document_filename: null }),
            },
            {
              prompt: "Open 03_CONFIDENTIAL_Inspection_Report.pdf",
              call: JSON.stringify({
                action: "summarize",
                document_filename: "03_CONFIDENTIAL_Inspection_Report.pdf",
              }),
            },
            {
              prompt: "Summarize 04_CONFIDENTIAL_Maintenance_SOP.docx",
              call: JSON.stringify({
                action: "summarize",
                document_filename: "04_CONFIDENTIAL_Maintenance_SOP.docx",
              }),
            },
          ],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["list", "summarize"],
                description:
                  "The action to take. 'list' will return all files available with their filename and descriptions. 'summarize' will open and summarize the file by name or best-matching document content.",
              },
              document_filename: {
                type: "string",
                "x-nullable": true,
                description:
                  "The exact file name of the document you want to get the full content of. If you do not know the exact filename, use rag-memory to search by content.",
              },
            },
            additionalProperties: false,
          },
          handler: async function ({ action, document_filename }) {
            if (action === "list") return await this.listDocuments();
            if (action === "summarize")
              return await this.summarizeDoc(document_filename);
            return "There is nothing we can do. This function call returns no information.";
          },

          /**
           * List all documents available in a workspace
           * @returns List of files and their descriptions if available.
           */
          listDocuments: async function () {
            try {
              this.super.introspect(
                `${this.caller}: Looking at the available documents.`
              );
              const documents = await Document.where({
                workspaceId: this.super.handlerProps.invocation.workspace_id,
              });
              if (documents.length === 0)
                return "No documents found - nothing can be done. Stop.";

              this.super.introspect(
                `${this.caller}: Found ${documents.length} documents`
              );
              const foundDocuments = documents.map((doc) => {
                const metadata = safeJsonParse(doc.metadata, {});
                return {
                  document_id: doc.docId,
                  filename: metadata?.title ?? doc.filename ?? "unknown.txt",
                  description: metadata?.description ?? "no description",
                  classification: metadata?.classification ?? "INTERNAL",
                };
              });

              return JSON.stringify(foundDocuments);
            } catch (error) {
              this.super.handlerProps.log(
                `document-summarizer.list raised an error. ${error.message}`
              );
              return `Let the user know this action was not successful. An error was raised while listing available files. ${error.message}`;
            }
          },

          summarizeDoc: async function (filenameOrQuery) {
            try {
              const workspace = this.super.handlerProps.invocation.workspace;
              const user = this.super.handlerProps.invocation.user_id
                ? { id: this.super.handlerProps.invocation.user_id }
                : null;

              const { connector: LLMConnector } =
                await resolveProviderConnector({
                  workspace,
                  prompt: String(filenameOrQuery || ""),
                });

              // Use HybridSearch to locate the document by exact filename, fuzzy name, or content concepts
              const matchedResult = await HybridSearch.findBestMatchingDocument({
                workspace,
                filenameOrQuery,
                user,
                LLMConnector,
              });

              if (matchedResult.error) {
                this.super.handlerProps.log(
                  `${this.caller}: ${matchedResult.error}`
                );
                return matchedResult.error;
              }

              const resolvedFilename = matchedResult.filename;
              const content = matchedResult.content;

              if (!content || content.length === 0) {
                throw new Error(
                  `Document "${resolvedFilename}" has no readable content.`
                );
              }

              this.super.introspect(
                `${this.caller}: Retrieved content for "${resolvedFilename}" (via ${matchedResult.matchMethod}).`
              );

              // Report citation for the document being summarized
              this.super.addCitation?.({
                id: matchedResult.documentId,
                title: resolvedFilename,
                text: content,
                chunkSource: null,
                score: null,
              });

              const { TokenManager } = require("../../../helpers/tiktoken");
              if (
                new TokenManager(this.super.model).countFromString(content) <
                Provider.contextLimit(this.super.provider, this.super.model)
              ) {
                return content;
              }

              this.super.introspect(
                `${this.caller}: Summarizing "${resolvedFilename}"...`
              );

              return await summarizeContent({
                provider: this.super.provider,
                model: this.super.model,
                content,
                aibitat: this.super,
              });
            } catch (error) {
              this.super.handlerProps.log(
                `document-summarizer.summarizeDoc raised an error. ${error.message}`
              );
              return `Let the user know this action was not successful. An error was raised while summarizing the file: ${error.message}`;
            }
          },
        });
      },
    };
  },
};

module.exports = {
  docSummarizer,
};
