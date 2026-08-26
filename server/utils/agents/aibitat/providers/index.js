const LMStudioProvider = require("./lmstudio.js");
const OllamaProvider = require("./ollama.js");
const KoboldCPPProvider = require("./koboldcpp.js");
const LocalAIProvider = require("./localai.js");
const GenericOpenAiProvider = require("./genericOpenAi.js");
const TextWebGenUiProvider = require("./textgenwebui.js");
const NvidiaNimProvider = require("./nvidiaNim.js");
const FoundryProvider = require("./foundry.js");
const DockerModelRunnerProvider = require("./dockerModelRunner.js");
const PrivatemodeProvider = require("./privatemode.js");
const LemonadeProvider = require("./lemonade.js");
const OMLXProvider = require("./omlx.js");

module.exports = {
  LMStudioProvider,
  OllamaProvider,
  KoboldCPPProvider,
  LocalAIProvider,
  GenericOpenAiProvider,
  TextWebGenUiProvider,
  NvidiaNimProvider,
  FoundryProvider,
  DockerModelRunnerProvider,
  PrivatemodeProvider,
  LemonadeProvider,
  OMLXProvider,
};
