const fs = require("fs");
const path = require("path");
const { CheckpointStatus } = require("./types");
const { CacheData } = require("../../models/cacheData");

class CheckpointStore {
  static inMemoryStore = new Map(); // Fast session lookup / test mock

  /**
   * Root directory for persistent checkpoint storage on disk.
   */
  static getStorageDir(taskId = "default") {
    const storageRoot =
      process.env.STORAGE_DIR || path.resolve(__dirname, "../../storage");
    const sanitizedTask = String(taskId).replace(/[^a-zA-Z0-9_\-]/g, "_");
    const taskDir = path.join(storageRoot, "checkpoints", sanitizedTask);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }
    return taskDir;
  }

  /**
   * Reset in-memory cache (for testing)
   */
  static reset() {
    this.inMemoryStore.clear();
  }

  /**
   * Persist a checkpoint record to disk and the database index.
   * @param {Object} record - The CheckpointRecord object
   * @returns {Promise<Object>} The saved record
   */
  static async saveCheckpoint(record) {
    if (!record || !record.checkpointId) {
      throw new Error("Invalid checkpoint record: missing checkpointId");
    }

    const taskId = record.taskId || "default";
    const taskDir = this.getStorageDir(taskId);
    const fileName = `checkpoint_${String(record.stepOrder || 0).padStart(3, "0")}_${record.checkpointId}.json`;
    const filePath = path.join(taskDir, fileName);

    const serialized = JSON.stringify(record, null, 2);
    fs.writeFileSync(filePath, serialized, "utf-8");

    // In-memory cache
    this.inMemoryStore.set(record.checkpointId, record);

    // Database index entry via CacheData
    try {
      await CacheData.delete({ name: `cp_${record.checkpointId}` });
      await CacheData.new({
        name: `cp_${record.checkpointId}`,
        belongsTo: "workflow_checkpoint",
        data: JSON.stringify({
          checkpointId: record.checkpointId,
          taskId: record.taskId,
          workflowId: record.workflowId,
          stepId: record.stepId,
          stepOrder: record.stepOrder,
          stepTitle: record.stepTitle,
          status: record.status,
          classification: record.classificationContext || "INTERNAL",
          createdAt: record.createdAt,
          filePath,
        }),
      });
    } catch (e) {
      // Non-fatal if DB cache fails; disk is source of truth
      console.warn("[CheckpointStore] DB cache index warning:", e.message);
    }

    return record;
  }

  /**
   * Retrieve a checkpoint by ID.
   * @param {string} checkpointId
   * @param {string} [taskId]
   * @returns {Promise<Object|null>}
   */
  static async getCheckpoint(checkpointId, taskId = null) {
    if (!checkpointId) return null;

    if (this.inMemoryStore.has(checkpointId)) {
      return this.inMemoryStore.get(checkpointId);
    }

    const storageRoot =
      process.env.STORAGE_DIR || path.resolve(__dirname, "../../storage");
    const checkpointsBase = path.join(storageRoot, "checkpoints");

    if (!fs.existsSync(checkpointsBase)) return null;

    // If taskId is provided, search direct directory; otherwise scan task folders
    const searchDirs = taskId
      ? [this.getStorageDir(taskId)]
      : fs.readdirSync(checkpointsBase).map((d) => path.join(checkpointsBase, d));

    for (const dir of searchDirs) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.endsWith(`${checkpointId}.json`)) {
          const content = fs.readFileSync(path.join(dir, file), "utf-8");
          const parsed = JSON.parse(content);
          this.inMemoryStore.set(checkpointId, parsed);
          return parsed;
        }
      }
    }

    return null;
  }

  /**
   * List all checkpoints for a given task, sorted by stepOrder ascending.
   * @param {string} taskId
   * @returns {Promise<Array<Object>>}
   */
  static async listCheckpoints(taskId) {
    if (!taskId) return [];
    const taskDir = this.getStorageDir(taskId);
    if (!fs.existsSync(taskDir)) return [];

    const files = fs.readdirSync(taskDir).filter((f) => f.endsWith(".json"));
    const records = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(taskDir, file), "utf-8");
        const parsed = JSON.parse(content);
        records.push(parsed);
      } catch (err) {
        console.warn(`[CheckpointStore] Failed reading checkpoint file ${file}:`, err.message);
      }
    }

    return records.sort((a, b) => (a.stepOrder || 0) - (b.stepOrder || 0));
  }

  /**
   * Identify the most recent valid checkpoint for a task.
   * A checkpoint is valid ONLY if status is VALIDATED or ACTIVE.
   * @param {string} taskId
   * @returns {Promise<Object|null>}
   */
  static async getLastValidCheckpoint(taskId) {
    const list = await this.listCheckpoints(taskId);
    // Find the last checkpoint with VALIDATED or ACTIVE status
    for (let i = list.length - 1; i >= 0; i--) {
      const cp = list[i];
      if (
        (cp.status === CheckpointStatus.VALIDATED || cp.status === CheckpointStatus.ACTIVE) &&
        cp.status !== CheckpointStatus.INVALIDATED
      ) {
        return cp;
      }
    }
    return null;
  }

  /**
   * Update checkpoint status (e.g. mark ACTIVE, SUPERSEDED, or INVALIDATED)
   * @param {string} checkpointId
   * @param {string} status - CheckpointStatus
   * @param {string} [reason]
   * @returns {Promise<Object|null>}
   */
  static async updateCheckpointStatus(checkpointId, status, reason = null) {
    const cp = await this.getCheckpoint(checkpointId);
    if (!cp) return null;

    cp.status = status;
    cp.lastUpdatedAt = new Date().toISOString();
    if (reason) cp.statusReason = reason;

    await this.saveCheckpoint(cp);
    return cp;
  }

  /**
   * Invalidate a checkpoint (e.g. due to source document change or policy invalidation).
   * @param {string} checkpointId
   * @param {string} reason
   * @returns {Promise<Object|null>}
   */
  static async invalidateCheckpoint(checkpointId, reason) {
    return await this.updateCheckpointStatus(
      checkpointId,
      CheckpointStatus.INVALIDATED,
      reason || "Checkpoint invalidated due to dependency or security change."
    );
  }

  /**
   * Clear all checkpoints for a task (e.g. on task cancellation or reset).
   * @param {string} taskId
   */
  static async clearTaskCheckpoints(taskId) {
    if (!taskId) return;
    const taskDir = this.getStorageDir(taskId);
    if (fs.existsSync(taskDir)) {
      try {
        fs.rmSync(taskDir, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[CheckpointStore] Failed clearing task dir ${taskDir}:`, err.message);
      }
    }
    for (const [id, cp] of this.inMemoryStore.entries()) {
      if (cp.taskId === taskId) this.inMemoryStore.delete(id);
    }
  }
}

module.exports = { CheckpointStore };
