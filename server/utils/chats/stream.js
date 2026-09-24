const { v4: uuidv4 } = require("uuid");
const { DocumentManager } = require("../DocumentManager");
const { WorkspaceChats } = require("../../models/workspaceChats");
const { WorkspaceParsedFiles } = require("../../models/workspaceParsedFiles");
const { getVectorDbClass, resolveProviderConnector } = require("../helpers");
const { addChatCostToMetrics } = require("../helpers/modelPricing");
const { writeResponseChunk } = require("../helpers/chat/responses");
const { abortConnectorOnClientDisconnect } = require("../helpers/abortSignals");
const { grepAgents } = require("./agents");
const {
  grepCommand,
  VALID_COMMANDS,
  chatPrompt,
  recentChatHistory,
  sourceIdentifier,
} = require("./index");

const VALID_CHAT_MODE = ["automatic", "chat", "query"];

async function streamChatWithWorkspace(
  response,
  workspace,
  message,
  chatMode = "automatic",
  user = null,
  thread = null,
  attachments = []
) {
  const uuid = uuidv4();
  const updatedMessage = await grepCommand(message, user);

  if (Object.keys(VALID_COMMANDS).includes(updatedMessage)) {
    const data = await VALID_COMMANDS[updatedMessage](
      workspace,
      message,
      uuid,
      user,
      thread,
      response,
      attachments
    );
    writeResponseChunk(response, data);
    return;
  }

  // If is agent enabled chat we will exit this flow early.
  const isAgentChat = await grepAgents({
    uuid,
    response,
    message: updatedMessage,
    user,
    workspace,
    thread,
    attachments,
  });
  if (isAgentChat) return;

  const {
    connector: LLMConnector,
    routingMetadata,
    prefetchedContext,
    error: routerError,
  } = await resolveLLMConnector({
    workspace,
    message: updatedMessage,
    user,
    thread,
    attachments,
  });

  if (routerError) {
    return writeResponseChunk(response, {
      id: uuid,
      uuid: uuid,
      type: "abort",
      textResponse: null,
      sources: [],
      close: true,
      error: routerError,
    });
  }

  // Stopping the generation (or closing the tab) should stop the provider
  // generating too, not just stop us reading the response.
  abortConnectorOnClientDisconnect(response, LLMConnector);

  if (routingMetadata?.routedTo?.shouldNotify) {
    writeResponseChunk(response, {
      id: `${uuid}:route`,
      uuid: `${uuid}:route`,
      type: "modelRouteNotification",
      routedTo: routingMetadata.routedTo,
    });
  }

  const VectorDb = getVectorDbClass();

  const messageLimit = workspace?.openAiHistory || 20;
  const hasVectorizedSpace = await VectorDb.hasNamespace(workspace.slug);
  const embeddingsCount = await VectorDb.namespaceCount(workspace.slug);

  // User is trying to query-mode chat a workspace that has no data in it - so
  // we should exit early as no information can be found under these conditions.
  if ((!hasVectorizedSpace || embeddingsCount === 0) && chatMode === "query") {
    const textResponse =
      workspace?.queryRefusalResponse ??
      "There is no relevant information in this workspace to answer your query.";
    writeResponseChunk(response, {
      id: uuid,
      uuid: uuid,
      type: "textResponse",
      textResponse,
      sources: [],
      attachments,
      close: true,
      error: null,
    });
    await WorkspaceChats.new({
      workspaceId: workspace.id,
      prompt: message,
      response: {
        text: textResponse,
        sources: [],
        type: chatMode,
        attachments,
      },
      threadId: thread?.id || null,
      include: false,
      user,
    });
    return;
  }

  // If we are here we know that we are in a workspace that is:
  // 1. Chatting in "chat" mode and may or may _not_ have embeddings
  // 2. Chatting in "query" mode and has at least 1 embedding
  let completeText;
  let metrics = {};
  let contextTexts = [];
  let sources = [];
  let pinnedDocIdentifiers = [];

  // If the router pre-fetched context we can reuse it; otherwise fetch fresh.
  const {
    rawHistory,
    chatHistory,
    pinnedDocs: prefetchedPinnedDocs,
    parsedFiles: prefetchedParsedFiles,
  } = prefetchedContext ??
  (await recentChatHistory({ user, workspace, thread, messageLimit }));

  // Pinned docs — reuse pre-fetched if available, otherwise fetch with token cap.
  const pinnedDocs =
    prefetchedPinnedDocs ??
    (await new DocumentManager({
      workspace,
      maxTokens: LLMConnector.promptWindowLimit(),
    }).pinnedDocs());
  pinnedDocs.forEach((doc) => {
    const { pageContent, ...metadata } = doc;
    pinnedDocIdentifiers.push(sourceIdentifier(doc));
    contextTexts.push(doc.pageContent);
    sources.push({
      text:
        pageContent.slice(0, 1_000) + "...continued on in source document...",
      ...metadata,
    });
  });

  // Parsed files — reuse pre-fetched if available, otherwise fetch fresh.
  const parsedFiles =
    prefetchedParsedFiles ??
    (await WorkspaceParsedFiles.getContextFiles(
      workspace,
      thread || null,
      user || null
    ));
  parsedFiles.forEach((doc) => {
    const { pageContent, ...metadata } = doc;
    contextTexts.push(doc.pageContent);
    sources.push({
      text:
        pageContent.slice(0, 1_000) + "...continued on in source document...",
      ...metadata,
    });
  });

  const { HybridSearch } = require("../retrieval/hybridSearch");
  const vectorSearchResults =
    embeddingsCount !== 0
      ? await HybridSearch.searchWorkspace({
          workspace,
          query: updatedMessage,
          user,
          LLMConnector,
          similarityThreshold: workspace?.similarityThreshold ?? 0.20,
          topN: workspace?.topN ?? 4,
          filterIdentifiers: pinnedDocIdentifiers,
          rerank: workspace?.vectorSearchMode === "rerank",
        })
      : {
          contextTexts: [],
          sources: [],
          message: null,
        };

  // Failed similarity search if it was run at all and failed.
  if (!!vectorSearchResults.message && vectorSearchResults.sources.length === 0) {
    writeResponseChunk(response, {
      id: uuid,
      uuid: uuid,
      type: "abort",
      textResponse: null,
      sources: [],
      close: true,
      error: vectorSearchResults.message,
    });
    return;
  }

  // Policy Engine: Filter retrieved knowledge sources based on sensitivity clearance
  const { PolicyEngine } = require("../policy");
  const { EventLogs } = require("../../models/eventLogs");
  const authorizedSources = [];

  for (const src of (vectorSearchResults.sources || [])) {
    const chunkClassification = src.metadata?.classification || "INTERNAL";
    const policyResult = PolicyEngine.evaluatePolicy({
      requestedCapability: "knowledge",
      classification: chunkClassification,
      source: src.metadata,
      user,
      workspace,
      model: LLMConnector,
    });

    if (policyResult.decision === "ALLOW") {
      authorizedSources.push(src);
    } else {
      console.warn(
        `[Policy Engine] RAG chunk (${src.metadata?.title || src.metadata?.docpath}) blocked: ${policyResult.reason}`
      );
      await EventLogs.logEvent(
        "knowledge_source_blocked",
        {
          docTitle: src.metadata?.title || "unknown",
          docpath: src.metadata?.docpath || "unknown",
          classification: chunkClassification,
          reason: policyResult.reason,
          policyRule: policyResult.policyRule,
        },
        user?.id ? Number(user.id) : null
      );
    }
  }

  vectorSearchResults.sources = authorizedSources;

  const { fillSourceWindow } = require("../helpers/chat");
  const filledSources = fillSourceWindow({
    nDocs: workspace?.topN || 4,
    searchResults: vectorSearchResults.sources,
    history: rawHistory,
    filterIdentifiers: pinnedDocIdentifiers,
  });

  // Why does contextTexts get all the info, but sources only get current search?
  // This is to give the ability of the LLM to "comprehend" a contextual response without
  // populating the Citations under a response with documents the user "thinks" are irrelevant
  // due to how we manage backfilling of the context to keep chats with the LLM more correct in responses.
  // If a past citation was used to answer the question - that is visible in the history so it logically makes sense
  // and does not appear to the user that a new response used information that is otherwise irrelevant for a given prompt.
  // TLDR; reduces GitHub issues for "LLM citing document that has no answer in it" while keep answers highly accurate.
  contextTexts = [...contextTexts, ...filledSources.contextTexts];
  sources = [...sources, ...vectorSearchResults.sources];

  const queryAnalysis = HybridSearch.analyzeQuery(updatedMessage);
  const isDocumentGrounded = Boolean(queryAnalysis?.isDocumentGrounded);

  // If the user's prompt is strictly document-grounded and no context chunks are found,
  // do not allow the LLM to hallucinate or use general knowledge. Return strict failure message.
  if (isDocumentGrounded && contextTexts.length === 0) {
    const textResponse =
      "I could not find sufficient relevant information in the uploaded documents to answer this question.";
    writeResponseChunk(response, {
      id: uuid,
      uuid: uuid,
      type: "textResponse",
      textResponse,
      sources: [],
      attachments,
      close: true,
      error: null,
    });

    await WorkspaceChats.new({
      workspaceId: workspace.id,
      prompt: message,
      response: {
        text: textResponse,
        sources: [],
        type: chatMode,
        attachments,
      },
      threadId: thread?.id || null,
      include: false,
      user,
    });
    return;
  }

  // If in query mode and no context chunks are found from search, backfill, or pins -  do not
  // let the LLM try to hallucinate a response or use general knowledge and exit early
  if (chatMode === "query" && contextTexts.length === 0) {
    const textResponse =
      workspace?.queryRefusalResponse ??
      "There is no relevant information in this workspace to answer your query.";
    writeResponseChunk(response, {
      id: uuid,
      uuid: uuid,
      type: "textResponse",
      textResponse,
      sources: [],
      attachments,
      close: true,
      error: null,
    });

    await WorkspaceChats.new({
      workspaceId: workspace.id,
      prompt: message,
      response: {
        text: textResponse,
        sources: [],
        type: chatMode,
        attachments,
      },
      threadId: thread?.id || null,
      include: false,
      user,
    });
    return;
  }

  // Compress & Assemble message to ensure prompt passes token limit with room for response
  // and build system messages based on inputs and history.
  // Reuse the system prompt from routing pre-fetch when available.
  let systemPrompt =
    prefetchedContext?.systemPrompt ??
    (await chatPrompt(workspace, user, {
      prompt: updatedMessage,
      rawHistory,
    }));

  if (contextTexts.length > 0 && isDocumentGrounded) {
    systemPrompt = `${systemPrompt}\n\nStrict Document Grounding Directive:\nThe user inquiry is strictly document-grounded. You MUST answer using ONLY the factual content directly provided in the context from the uploaded documents. Under NO circumstances should you extrapolate, use outside knowledge, or fall back to general model knowledge. If the provided document context is insufficient to answer the question, state: "I could not find sufficient relevant information in the uploaded documents to answer this question." NEVER say "However, based on general knowledge..." or provide general knowledge alternatives.`;
  }

  const messages = await LLMConnector.compressMessages(
    {
      systemPrompt,
      userPrompt: updatedMessage,
      contextTexts,
      chatHistory,
      attachments,
    },
    rawHistory
  );

  // If streaming is not explicitly enabled for connector
  // we do regular waiting of a response and send a single chunk.
  if (LLMConnector.streamingEnabled() !== true) {
    console.log(
      `\x1b[31m[STREAMING DISABLED]\x1b[0m Streaming is not available for ${LLMConnector.constructor.name}. Will use regular chat method.`
    );
    const { textResponse, metrics: performanceMetrics } =
      await LLMConnector.getChatCompletion(messages, {
        temperature: workspace?.openAiTemp ?? LLMConnector.defaultTemp,
        user: user,
      });

    completeText = textResponse;
    if (
      isDocumentGrounded &&
      (/(?:no\s+relevant\s+documents?(?:\s+(?:were|are|was))?\s+found|could\s+not\s+find\s+(?:any|sufficient)\s+relevant\s+documents?).*?(?:however|but\s+based|based\s+on\s+general|from\s+general|general\s+model\s+knowledge)/is.test(
        completeText
      ) ||
        /(?:however,?\s+based\s+on\s+general\s+knowledge|based\s+on\s+general\s+knowledge|from\s+general\s+(?:model\s+)?knowledge)/i.test(
          completeText
        ))
    ) {
      completeText =
        "I could not find sufficient relevant information in the uploaded documents to answer this question.";
    }
    metrics = addChatCostToMetrics(performanceMetrics, {
      routingMetadata,
      workspace,
      connector: LLMConnector,
    });
    writeResponseChunk(response, {
      id: uuid,
      uuid,
      sources,
      type: "textResponseChunk",
      textResponse: completeText,
      close: true,
      error: false,
      metrics,
    });
  } else {
    const stream = await LLMConnector.streamGetChatCompletion(messages, {
      temperature: workspace?.openAiTemp ?? LLMConnector.defaultTemp,
      user: user,
    });
    completeText = await LLMConnector.handleStream(response, stream, {
      uuid,
      sources,
    });
    metrics = addChatCostToMetrics(stream.metrics, {
      routingMetadata,
      workspace,
      connector: LLMConnector,
    });
  }

  if (
    completeText?.length > 0 &&
    isDocumentGrounded &&
    (/(?:no\s+relevant\s+documents?(?:\s+(?:were|are|was))?\s+found|could\s+not\s+find\s+(?:any|sufficient)\s+relevant\s+documents?).*?(?:however|but\s+based|based\s+on\s+general|from\s+general|general\s+model\s+knowledge)/is.test(
      completeText
    ) ||
      /(?:however,?\s+based\s+on\s+general\s+knowledge|based\s+on\s+general\s+knowledge|from\s+general\s+(?:model\s+)?knowledge)/i.test(
        completeText
      ))
  ) {
    completeText =
      "I could not find sufficient relevant information in the uploaded documents to answer this question.";
  }

  if (completeText?.length > 0) {
    const { ClassificationService } = require("../classification");
    const promptClass = ClassificationService.classifyDocument({
      content: message,
      filename: "user-prompt.txt",
    }).classification;
    const sourceClasses = (sources || []).map(
      (s) => s.metadata?.classification || "INTERNAL"
    );
    const outputClassification = ClassificationService.resolveSupremum([
      promptClass,
      ...sourceClasses,
      workspace?.classification,
    ]);

    const { VerificationManager, StepType } = require("../verification");
    const groundingVerification = await VerificationManager.verifyStep({
      step: {
        stepId: `${uuid}_rag_grounding`,
        type: StepType.RAG_GROUNDING,
        sources: sources || [],
      },
      output: completeText,
      context: { user, workspace, classification: outputClassification },
    });

    const { chat } = await WorkspaceChats.new({
      workspaceId: workspace.id,
      prompt: message,
      response: {
        text: completeText,
        sources,
        type: chatMode,
        attachments,
        metrics,
        outputClassification,
        groundingVerification,
      },
      threadId: thread?.id || null,
      user,
    });

    writeResponseChunk(response, {
      id: uuid,
      uuid,
      type: "finalizeResponseStream",
      close: true,
      error: false,
      chatId: chat.id,
      metrics,
      classification: outputClassification,
      groundingVerification,
    });
    return;
  }

  writeResponseChunk(response, {
    id: uuid,
    uuid,
    type: "finalizeResponseStream",
    close: true,
    error: false,
    metrics,
  });
  return;
}

async function resolveLLMConnector({
  workspace,
  message,
  user,
  thread,
  attachments,
}) {
  try {
    const result = await resolveProviderConnector({
      workspace,
      prompt: message,
      user,
      thread,
      attachments,
    });
    return { ...result, error: null };
  } catch (routerError) {
    return {
      connector: null,
      routingMetadata: null,
      prefetchedContext: null,
      error: `Model router error: ${routerError.message}`,
    };
  }
}

module.exports = {
  VALID_CHAT_MODE,
  streamChatWithWorkspace,
};
