const { detectOsResources } = require("./detectors/osDetector");
const { detectGpuResources } = require("./detectors/gpuDetector");

class HardwareProfiler {
  static instance = null;
  static DEFAULT_REFRESH_SECONDS = 300;

  constructor() {
    if (HardwareProfiler.instance) return HardwareProfiler.instance;
    HardwareProfiler.instance = this;

    this.cachedProfile = null;
    this.lastCheckedAt = 0;
    this.refreshMs =
      (Number(process.env.ROUTER_HARDWARE_REFRESH_SECONDS) ||
        HardwareProfiler.DEFAULT_REFRESH_SECONDS) * 1000;
  }

  static getInstance() {
    if (!HardwareProfiler.instance) new HardwareProfiler();
    return HardwareProfiler.instance;
  }

  /**
   * Retrieves cached hardware profile or refreshes asynchronously if expired.
   * Never blocks request processing.
   * @param {boolean} [forceRefresh=false]
   * @returns {Promise<Object>} HardwareContext
   */
  async getProfile(forceRefresh = false) {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.cachedProfile &&
      now - this.lastCheckedAt < this.refreshMs
    ) {
      return this.cachedProfile;
    }

    const osRes = detectOsResources();
    const gpuRes = await detectGpuResources(
      osRes.cpuModel,
      osRes.systemRamGb,
      osRes.availableRamGb,
    );

    this.cachedProfile = {
      cpuCores: osRes.cpuCores,
      cpuModel: osRes.cpuModel,
      systemRamGb: osRes.systemRamGb,
      availableRamGb: osRes.availableRamGb,
      isGpuAvailable: gpuRes.isGpuAvailable,
      gpuName: gpuRes.gpuName,
      gpuVramGb: gpuRes.gpuVramGb,
      availableVramGb: gpuRes.availableVramGb,
      source: gpuRes.source,
      detectedAt: new Date().toISOString(),
    };
    this.lastCheckedAt = now;

    return this.cachedProfile;
  }

  /**
   * Synchronous getter that returns current cache or fast OS fallback.
   */
  getCachedOrFallback() {
    if (this.cachedProfile) return this.cachedProfile;
    const osRes = detectOsResources();
    return {
      cpuCores: osRes.cpuCores,
      cpuModel: osRes.cpuModel,
      systemRamGb: osRes.systemRamGb,
      availableRamGb: osRes.availableRamGb,
      isGpuAvailable: false,
      gpuName: "Unchecked GPU (Pending Probe)",
      gpuVramGb: 0,
      availableVramGb: 0,
      source: "fast-fallback",
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Stage A: Evaluates hard hardware feasibility.
   * Returns true if model can feasibly execute without OOM crashing.
   * @param {Object} model
   * @param {Object} hardware
   * @returns {boolean}
   */
  isHardwareFeasible(model, hardware) {
    const minRam = model.resourceRequirements?.minRamGb || 0;
    const minVram = model.resourceRequirements?.minVramGb || 0;

    // 1. Dedicated GPU available: VRAM hosts the model weights
    if (minVram > 0 && hardware.gpuVramGb > 0) {
      if (hardware.availableVramGb < minVram) {
        return false;
      }
      if (hardware.systemRamGb < Math.min(minRam, 6)) {
        return false;
      }
      return true;
    }

    // 2. System RAM check for host memory
    if (minRam > 0 && hardware.systemRamGb < minRam) {
      return false;
    }

    // 3. Pure CPU model
    if (minVram === 0) {
      return true;
    }

    // 4. GPU model with zero GPU VRAM available (CPU offloading)
    if (hardware.gpuVramGb === 0) {
      if (minRam <= 16 && hardware.systemRamGb >= minRam) {
        return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Stage B: Computes granular hardware fit score:
   * - Full Fit: 1.0 (comfortable headroom >= 25%)
   * - Marginal Fit: 0.7 (tight headroom or partial RAM offload)
   * - Not Feasible: 0.0
   * @param {Object} model
   * @param {Object} hardware
   * @returns {number}
   */
  calculateHardwareFit(model, hardware) {
    if (!this.isHardwareFeasible(model, hardware)) {
      return 0.0;
    }

    const minVram = model.resourceRequirements?.minVramGb || 0;
    const minRam = model.resourceRequirements?.minRamGb || 0;

    if (minVram === 0) {
      if (hardware.availableRamGb >= minRam * 1.4) return 1.0;
      if (hardware.availableRamGb >= minRam) return 0.7;
      return 0.3;
    }

    if (hardware.gpuVramGb > 0) {
      const ratio = hardware.availableVramGb / minVram;
      if (ratio >= 1.25) return 1.0;
      if (ratio >= 1.0) return 0.7;
      return 0.3;
    }

    return 0.7;
  }
}

module.exports = { HardwareProfiler };
