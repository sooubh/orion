const { v4 } = require("uuid");
const { SystemSettings } = require("./systemSettings");

// Sovereign AI: Telemetry is completely local and never makes outbound requests.
// External connections remain strictly 0.
const Telemetry = {
  label: "telemetry_id",

  id: async function () {
    const result = await SystemSettings.get({ label: this.label });
    return result?.value || null;
  },

  connect: async function () {
    return { client: null, distinctId: "local-instance" };
  },

  isDev: function () {
    return process.env.NODE_ENV === "development";
  },

  client: function () {
    return null;
  },

  runtime: function () {
    return "sovereign-local";
  },

  isOnCooldown: function () {
    return false;
  },

  markOnCooldown: function () {},

  sendTelemetry: async function (
    event,
    eventProperties = {},
    subUserId = null,
    silent = false
  ) {
    // Local no-op / local logging only - zero external network requests
    if (!silent && process.env.NODE_ENV === "development") {
      console.log(`[SOVEREIGN LOCAL EVENT]`, {
        event,
        properties: eventProperties,
      });
    }
    return;
  },

  flush: async function () {
    return;
  },

  setUid: async function () {
    const newId = v4();
    await SystemSettings._updateSettings({ [this.label]: newId });
    return newId;
  },

  findOrCreateId: async function () {
    let currentId = await this.id();
    if (currentId) return currentId;

    currentId = await this.setUid();
    return currentId;
  },
};

module.exports = { Telemetry };

