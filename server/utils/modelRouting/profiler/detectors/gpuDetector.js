const { execFile } = require("child_process");
const util = require("util");
const execFileAsync = util.promisify(execFile);

/**
 * Safely inspects GPU telemetry.
 * Non-blocking with strict timeout and fallback to CPU-only.
 */
async function detectGpuResources(
  cpuModel = "",
  systemRamGb = 16,
  availableRamGb = 8,
) {
  // 1. Environment variable override check (for headless testing / CI / containers)
  if (process.env.ROUTER_HW_OVERRIDE_GPU_VRAM_GB !== undefined) {
    const gpuVramGb = Number(process.env.ROUTER_HW_OVERRIDE_GPU_VRAM_GB) || 0;
    const availableVramGb =
      process.env.ROUTER_HW_OVERRIDE_AVAILABLE_VRAM_GB !== undefined
        ? Number(process.env.ROUTER_HW_OVERRIDE_AVAILABLE_VRAM_GB) || 0
        : gpuVramGb;
    return {
      isGpuAvailable: gpuVramGb > 0,
      gpuName: process.env.ROUTER_HW_OVERRIDE_GPU_NAME || "Override GPU",
      gpuVramGb,
      availableVramGb,
      source: "env-override",
    };
  }

  // 2. NVIDIA Detection via nvidia-smi
  const nvidiaGpu = await detectNvidiaSmi();
  if (nvidiaGpu) return nvidiaGpu;

  // 3. Apple Silicon Metal Unified Memory Detection (Darwin platform)
  if (
    process.platform === "darwin" &&
    typeof cpuModel === "string" &&
    cpuModel.toLowerCase().includes("apple")
  ) {
    const unifiedVram = Math.round(systemRamGb * 0.75 * 10) / 10;
    const availableUnifiedVram = Math.round(availableRamGb * 0.75 * 10) / 10;
    return {
      isGpuAvailable: true,
      gpuName: cpuModel,
      gpuVramGb: unifiedVram,
      availableVramGb: availableUnifiedVram,
      source: "apple-metal",
    };
  }

  // 4. Safe CPU Fallback
  return {
    isGpuAvailable: false,
    gpuName: "None (CPU Only)",
    gpuVramGb: 0,
    availableVramGb: 0,
    source: "cpu-fallback",
  };
}

async function detectNvidiaSmi() {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=name,memory.total,memory.free",
        "--format=csv,noheader,nounits",
      ],
      { timeout: 1500 },
    );
    const line = stdout?.trim().split("\n")[0];
    if (!line) return null;

    const parts = line.split(",").map((s) => s.trim());
    if (parts.length < 3) return null;

    const [name, totalMibStr, freeMibStr] = parts;
    const totalMib = parseFloat(totalMibStr);
    const freeMib = parseFloat(freeMibStr);

    if (isNaN(totalMib) || isNaN(freeMib)) return null;

    const gpuVramGb = Math.round((totalMib / 1024) * 10) / 10;
    const availableVramGb = Math.round((freeMib / 1024) * 10) / 10;

    return {
      isGpuAvailable: true,
      gpuName: name,
      gpuVramGb,
      availableVramGb,
      source: "nvidia-smi",
    };
  } catch {
    return null;
  }
}

module.exports = { detectGpuResources };
