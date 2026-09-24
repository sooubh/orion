const os = require("os");

/**
 * Safely inspects system CPU and RAM using native Node.js os module.
 * Execution is synchronous and virtually instantaneous (< 0.1ms).
 */
function detectOsResources() {
  let cpuCores = 1;
  let cpuModel = "Generic CPU";
  try {
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      cpuCores = cpus.length;
      cpuModel = cpus[0]?.model || "Generic CPU";
    } else {
      cpuCores = os.availableParallelism?.() || 1;
    }
  } catch (_e) {
    cpuCores = os.availableParallelism?.() || 1;
  }
  const totalMemBytes = os.totalmem() || 0;
  const freeMemBytes = os.freemem() || 0;

  const overrideRam = process.env.ROUTER_HW_OVERRIDE_SYSTEM_RAM_GB;
  const systemRamGb =
    overrideRam !== undefined
      ? Number(overrideRam) || 16
      : Math.round((totalMemBytes / 1024 ** 3) * 10) / 10;
  const availableRamGb =
    overrideRam !== undefined
      ? Number(overrideRam) || 16
      : Math.round((freeMemBytes / 1024 ** 3) * 10) / 10;

  return {
    cpuCores,
    cpuModel,
    systemRamGb,
    availableRamGb,
  };
}

module.exports = { detectOsResources };
