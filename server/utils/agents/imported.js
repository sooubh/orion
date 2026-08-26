const fs = require("fs");
const path = require("path");
const { safeJsonParse } = require("../http");
const { isWithin, normalizePath } = require("../files");
const { CollectorApi } = require("../collectorApi");
const pluginsPath =
  process.env.NODE_ENV === "development"
    ? path.resolve(__dirname, "../../storage/plugins/agent-skills")
    : path.resolve(
        process.env.STORAGE_DIR || path.resolve(__dirname, "../../storage"),
        "plugins",
        "agent-skills"
      );
const sharedWebScraper = new CollectorApi();

class ImportedPlugin {
  constructor(config) {
    this.config = config;
    this.handlerLocation = path.resolve(
      pluginsPath,
      normalizePath(this.config.hubId),
      "handler.js"
    );
    if (!isWithin(pluginsPath, this.handlerLocation))
      throw new Error("Plugin handler does not pass path validation.");
    delete require.cache[require.resolve(this.handlerLocation)];
    this.handler = require(this.handlerLocation);
    this.name = config.hubId;
    this.startupConfig = {
      params: {},
    };
  }

  /**
   * Gets the imported plugin handler.
   * @param {string} hubId - The hub ID of the plugin.
   * @returns {ImportedPlugin} - The plugin handler.
   */
  static loadPluginByHubId(hubId) {
    const configLocation = path.resolve(
      pluginsPath,
      normalizePath(hubId),
      "plugin.json"
    );
    if (!this.isValidLocation(configLocation)) return;
    const config = safeJsonParse(fs.readFileSync(configLocation, "utf8"));
    return new ImportedPlugin(config);
  }

  static isValidLocation(pathToValidate) {
    if (!isWithin(pluginsPath, pathToValidate)) return false;
    if (!fs.existsSync(pathToValidate)) return false;
    return true;
  }

  /**
   * Checks if the plugin folder exists and if it does not, creates the folder.
   */
  static checkPluginFolderExists() {
    const dir = path.resolve(pluginsPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return;
  }

  /**
   * Loads plugins from `plugins` folder in storage that are custom loaded and defined.
   * only loads plugins that are active: true.
   * @returns {string[]} - array of plugin names to be loaded later.
   */
  static activeImportedPlugins() {
    const plugins = [];
    this.checkPluginFolderExists();
    const folders = fs.readdirSync(path.resolve(pluginsPath));
    for (const folder of folders) {
      const configLocation = path.resolve(
        pluginsPath,
        normalizePath(folder),
        "plugin.json"
      );
      if (!this.isValidLocation(configLocation)) continue;
      const config = safeJsonParse(fs.readFileSync(configLocation, "utf8"));
      if (config.active) plugins.push(`@@${config.hubId}`);
    }
    return plugins;
  }

  /**
   * Lists all imported plugins.
   * @returns {Array} - array of plugin configurations (JSON).
   */
  static listImportedPlugins() {
    const plugins = [];
    this.checkPluginFolderExists();
    if (!fs.existsSync(pluginsPath)) return plugins;

    const folders = fs.readdirSync(path.resolve(pluginsPath));
    for (const folder of folders) {
      const configLocation = path.resolve(
        pluginsPath,
        normalizePath(folder),
        "plugin.json"
      );
      if (!this.isValidLocation(configLocation)) continue;
      const config = safeJsonParse(fs.readFileSync(configLocation, "utf8"));
      plugins.push(config);
    }
    return plugins;
  }

  /**
   * Updates a plugin configuration.
   * @param {string} hubId - The hub ID of the plugin.
   * @param {object} config - The configuration to update.
   * @returns {object} - The updated configuration.
   */
  static updateImportedPlugin(hubId, config) {
    const configLocation = path.resolve(
      pluginsPath,
      normalizePath(hubId),
      "plugin.json"
    );
    if (!this.isValidLocation(configLocation)) return;

    const currentConfig = safeJsonParse(
      fs.readFileSync(configLocation, "utf8"),
      null
    );
    if (!currentConfig) return;

    const { hubId: _drop, ...safeConfig } = config;
    const updatedConfig = { ...currentConfig, ...safeConfig };
    fs.writeFileSync(configLocation, JSON.stringify(updatedConfig, null, 2));
    return updatedConfig;
  }

  /**
   * Deletes a plugin. Removes the entire folder of the object.
   * @param {string} hubId - The hub ID of the plugin.
   * @returns {boolean} - True if the plugin was deleted, false otherwise.
   */
  static deletePlugin(hubId) {
    if (!hubId) throw new Error("No plugin hubID passed.");
    const pluginFolder = path.resolve(pluginsPath, normalizePath(hubId));
    if (!this.isValidLocation(pluginFolder)) return;
    fs.rmSync(pluginFolder, { recursive: true });
    return true;
  }

  /**
  /**
   * Validates if the handler.js file exists for the given plugin.
   * @param {string} hubId - The hub ID of the plugin.
   * @returns {boolean} - True if the handler.js file exists, false otherwise.
   */
  static validateImportedPluginHandler(hubId) {
    const handlerLocation = path.resolve(
      pluginsPath,
      normalizePath(hubId),
      "handler.js"
    );
    return this.isValidLocation(handlerLocation);
  }

  /**
   * Creates a requestToolApproval function bound to a specific aibitat
   * instance and skill name via closure — no `this` binding required.
   *
   * The returned function pauses the agent and asks the user to approve a
   * potentially destructive action before the skill performs it.
   *
   * `skillName` is captured from the skill's hubId so a skill cannot spoof
   * another tool's name to bypass its own approval.
   *
   * When no approval channel exists (e.g. scheduled jobs) it resolves
   * approved so the skill still runs, matching how built-in tools fall
   * through their approval guard.
   *
   * @param {object} aibitat - The aibitat instance.
   * @param {string} skillName - The skill's hubId.
   * @returns {function({payload?: object, description?: string}): Promise<{approved: boolean, message: string}>}
   */
  static createToolApprovalFn(aibitat, skillName) {
    return async function requestToolApproval({
      payload = {},
      description = null,
    } = {}) {
      if (typeof aibitat?.requestToolApproval !== "function") {
        return {
          approved: true,
          message: "Approval not required in this context.",
        };
      }
      return aibitat.requestToolApproval({
        skillName,
        payload,
        description,
      });
    };
  }

  parseCallOptions() {
    const callOpts = {};
    if (!this.config.setup_args || typeof this.config.setup_args !== "object") {
      return callOpts;
    }
    for (const [param, definition] of Object.entries(this.config.setup_args)) {
      if (definition.required && !definition?.value) {
        console.log(
          `'${param}' required value for '${this.name}' plugin is missing. Plugin may not function or crash agent.`
        );
        continue;
      }
      callOpts[param] = definition.value || definition.default || null;
    }
    return callOpts;
  }

  plugin(runtimeArgs = {}) {
    const customFunctions = this.handler.runtime;
    return {
      runtimeArgs,
      name: this.name,
      config: this.config,
      setup(aibitat) {
        aibitat.function({
          super: aibitat,
          name: this.name,
          config: this.config,
          runtimeArgs: this.runtimeArgs,
          description: this.config.description,
          logger: aibitat?.handlerProps?.log || console.log,
          introspect: aibitat?.introspect || console.log,
          runtime: "docker",
          webScraper: sharedWebScraper,
          examples: this.config.examples ?? [],
          parameters: {
            $schema: "http://json-schema.org/draft-07/schema#",
            type: "object",
            properties: this.config.entrypoint.params ?? {},
            additionalProperties: false,
          },
          ...customFunctions,

          // Add the requestToolApproval function to the plugin
          // but do not allow the skill's own handler.js exports to override it.
          // because it requires an explict shape to return elements to the UI.
          requestToolApproval: ImportedPlugin.createToolApprovalFn(
            aibitat,
            this.config.name
          ),
        });
      },
    };
  }
}

module.exports = ImportedPlugin;
