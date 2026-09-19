/**
 * Configurable scoring weights for Stage B Suitability Scoring.
 * Matches Section 12 of the ORION Adaptive Model Routing specification.
 */
const DEFAULT_ROUTING_WEIGHTS = {
  taskFit: 0.3,
  capabilityFit: 0.25,
  sensitivityFit: 0.2,
  hardwareFit: 0.15,
  contextFit: 0.05,
  priority: 0.05,
};

module.exports = {
  DEFAULT_ROUTING_WEIGHTS,
};
