function getSTTProvider() {
  const provider = process.env.STT_PROVIDER || "native";
  switch (provider) {
    case "lemonade":
      const { LemonadeSTT } = require("./lemonade");
      return new LemonadeSTT();
    case "generic-openai":
      const { GenericOpenAiSTT } = require("./openAiGeneric");
      return new GenericOpenAiSTT();
    default:
      throw new Error(
        `STT_PROVIDER "${provider}" is not a supported local server-side provider.`
      );
  }
}

module.exports = { getSTTProvider };
