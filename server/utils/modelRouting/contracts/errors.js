/**
 * Structured error classes for Adaptive Model Routing
 */

class RoutingError extends Error {
  constructor(message, code = "ROUTING_ERROR", details = {}) {
    super(message);
    this.name = "RoutingError";
    this.code = code;
    this.details = details;
  }
}

class NoEligibleModelError extends RoutingError {
  constructor(reason, details = {}) {
    super(
      `No eligible local model found: ${reason}`,
      "NO_ELIGIBLE_MODEL",
      details,
    );
    this.name = "NoEligibleModelError";
  }
}

class PermissionDeniedRoutingError extends RoutingError {
  constructor(reason, details = {}) {
    super(
      `Routing permission denied: ${reason}`,
      "ROUTING_PERMISSION_DENIED",
      details,
    );
    this.name = "PermissionDeniedRoutingError";
  }
}

module.exports = {
  RoutingError,
  NoEligibleModelError,
  PermissionDeniedRoutingError,
};
