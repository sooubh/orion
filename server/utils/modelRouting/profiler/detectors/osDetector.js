const os = require("os");

/**
 * Safely inspects system CPU and RAM using native Node.js os module.
 * Execution is synchronous and virtually instantaneous (< 0.1ms).
 */
function detectOsResources() {
  const cpuCores = os.cpus()?.length || 1;
  const cpuModel = os.cpus()?.[0]?.model || "Generic CPU";
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
