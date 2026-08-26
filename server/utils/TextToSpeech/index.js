function getTTSProvider() {
  const provider = process.env.TTS_PROVIDER || "native";
  switch (provider) {
    case "generic-openai":
      const { GenericOpenAiTTS } = require("./openAiGeneric");
      return new GenericOpenAiTTS();
    case "kokoro":
      const { KokoroTTS } = require("./kokoro");
      return new KokoroTTS();
    default:
      throw new Error(
        `ENV: TTS_PROVIDER "${provider}" is not a supported local server-side provider.`
      );
  }
}

module.exports = { getTTSProvider };
