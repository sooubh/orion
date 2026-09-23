import OrionIcon from "@/media/logo/sovereign-ai.svg";
import GenericOpenAiLogo from "@/media/llmprovider/generic-openai.png";
import OllamaLogo from "@/media/llmprovider/ollama.png";
import NvidiaNimLogo from "@/media/llmprovider/nvidia-nim.png";
import LMStudioLogo from "@/media/llmprovider/lmstudio.png";
import LocalAiLogo from "@/media/llmprovider/localai.png";
import KoboldCPPLogo from "@/media/llmprovider/koboldcpp.png";
import TextGenWebUILogo from "@/media/llmprovider/text-generation-webui.png";
import ChromaLogo from "@/media/vectordbs/chroma.png";
import LanceDbLogo from "@/media/vectordbs/lancedb.png";
import WeaviateLogo from "@/media/vectordbs/weaviate.png";
import QDrantLogo from "@/media/vectordbs/qdrant.png";
import MilvusLogo from "@/media/vectordbs/milvus.png";
import PGVectorLogo from "@/media/vectordbs/pgvector.png";
import FoundryLogo from "@/media/llmprovider/foundry-local.png";
import DockerModelRunnerLogo from "@/media/llmprovider/docker-model-runner.png";
import PrivateModeLogo from "@/media/llmprovider/privatemode.png";
import LemonadeLogo from "@/media/llmprovider/lemonade.png";
import OMLXLogo from "@/media/llmprovider/omlx.png";


const LLM_PROVIDER_PRIVACY_MAP = {
  ollama: {
    name: "Ollama",
    description: [
      "Your model and chats are only accessible on the machine running Ollama models 100% offline.",
    ],
    logo: OllamaLogo,
  },
  lmstudio: {
    name: "LMStudio",
    description: [
      "Your model and chats are only accessible on the server running LMStudio locally.",
    ],
    logo: LMStudioLogo,
  },
  localai: {
    name: "LocalAI",
    description: [
      "Your model and chats are only accessible on the server running LocalAI locally.",
    ],
    logo: LocalAiLogo,
  },
  "generic-openai": {
    name: "Generic OpenAI compatible service",
    description: [
      "Data is stored and processed locally on your self-hosted endpoint.",
    ],
    logo: GenericOpenAiLogo,
  },
  koboldcpp: {
    name: "KoboldCPP",
    description: [
      "Your model and chats are only accessible on the server running KoboldCPP locally.",
    ],
    logo: KoboldCPPLogo,
  },
  textgenwebui: {
    name: "Oobabooga Web UI",
    description: [
      "Your model and chats are only accessible on the server running the Oobabooga Text Generation Web UI locally.",
    ],
    logo: TextGenWebUILogo,
  },
  "nvidia-nim": {
    name: "NVIDIA NIM",
    description: [
      "Your model and chats are only accessible on the local machine running the NVIDIA NIM.",
    ],
    logo: NvidiaNimLogo,
  },
  foundry: {
    name: "Microsoft Foundry Local",
    description: [
      "Your model and chats are only accessible on the machine running Foundry Local.",
    ],
    logo: FoundryLogo,
  },
  "docker-model-runner": {
    name: "Docker Model Runner",
    description: [
      "Your model and chats are only accessible on the machine running Docker Model Runner locally.",
    ],
    logo: DockerModelRunnerLogo,
  },
  privatemode: {
    name: "Privatemode",
    description: [
      "Your model and chats are processed privately on your local instance.",
    ],
    logo: PrivateModeLogo,
  },
  lemonade: {
    name: "Lemonade",
    description: [
      "Your model and chats are only accessible on the machine running the Lemonade server locally.",
    ],
    logo: LemonadeLogo,
  },
  omlx: {
    name: "oMLX",
    description: [
      "Your model and chats are only accessible on the machine running the oMLX server locally.",
    ],
    logo: OMLXLogo,
  },
};

const VECTOR_DB_PROVIDER_PRIVACY_MAP = {
  pgvector: {
    name: "PGVector",
    description: [
      "Your vectors and document text are stored on your PostgreSQL instance.",
      "Access to your instance is managed by you.",
    ],
    logo: PGVectorLogo,
  },
  chroma: {
    name: "Chroma",
    description: [
      "Your vectors and document text are stored on your Chroma instance.",
      "Access to your instance is managed by you.",
    ],
    logo: ChromaLogo,
  },
  qdrant: {
    name: "Qdrant",
    description: [
      "Your vectors and document text are stored on your local Qdrant instance.",
    ],
    logo: QDrantLogo,
  },
  weaviate: {
    name: "Weaviate",
    description: [
      "Your vectors and document text are stored on your local Weaviate instance.",
    ],
    logo: WeaviateLogo,
  },
  milvus: {
    name: "Milvus",
    description: [
      "Your vectors and document text are stored on your local Milvus instance.",
    ],
    logo: MilvusLogo,
  },
  lancedb: {
    name: "LanceDB",
    description: [
      "Your vectors and document text are stored privately on this instance of Orion.",
    ],
    logo: LanceDbLogo,
  },
};

const EMBEDDING_ENGINE_PROVIDER_PRIVACY_MAP = {
  native: {
    name: "Orion Embedder",
    description: [
      "Your document text is embedded privately on this instance of Orion.",
    ],
    logo: OrionIcon,
  },
  localai: {
    name: "LocalAI",
    description: [
      "Your document text is embedded privately on the server running LocalAI.",
    ],
    logo: LocalAiLogo,
  },
  ollama: {
    name: "Ollama",
    description: [
      "Your document text is embedded privately on the server running Ollama.",
    ],
    logo: OllamaLogo,
  },
  lmstudio: {
    name: "LMStudio",
    description: [
      "Your document text is embedded privately on the server running LMStudio.",
    ],
    logo: LMStudioLogo,
  },
  "generic-openai": {
    name: "Generic OpenAI compatible service (Local)",
    description: [
      "Data is stored and processed locally on your self-hosted endpoint.",
    ],
    logo: GenericOpenAiLogo,
  },
  lemonade: {
    name: "Lemonade",
    description: [
      "Your document text is embedded privately on the machine running the Lemonade server.",
    ],
    logo: LemonadeLogo,
  },
};

export const PROVIDER_PRIVACY_MAP = {
  llm: LLM_PROVIDER_PRIVACY_MAP,
  embeddingEngine: EMBEDDING_ENGINE_PROVIDER_PRIVACY_MAP,
  vectorDb: VECTOR_DB_PROVIDER_PRIVACY_MAP,
};
