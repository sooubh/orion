const { VerificationStatus } = require("../types");

class StructuredOutputVerifier {
  static name = "StructuredOutputVerifier";

  /**
   * Verify output matches expected structured schema.
   * @param {Object} params
   * @param {any} params.output - The actual output string or object
   * @param {Object} params.schema - Expected JSON schema / requirements
   * @returns {Object} VerificationResult
   */
  static verify({ output, schema }) {
    if (!schema) {
      return {
        status: VerificationStatus.PASSED,
        confidence: 1.0,
        reason: "No schema constraints specified; output accepted.",
        evidence: null,
        method: this.name,
      };
    }

    let parsed = output;
    if (typeof output === "string") {
      try {
        parsed = JSON.parse(output);
      } catch (err) {
        // Try extracting JSON from markdown code block if present
        const jsonMatch = output.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[1]);
          } catch (e2) {
            return {
              status: VerificationStatus.FAILED,
              confidence: 0.99,
              reason: `Failed to parse output as valid JSON: ${err.message}`,
              evidence: { error: err.message, rawSnippet: output.slice(0, 150) },
              method: this.name,
            };
          }
        } else {
          return {
            status: VerificationStatus.FAILED,
            confidence: 0.99,
            reason: `Output is not valid JSON: ${err.message}`,
            evidence: { error: err.message, rawSnippet: output.slice(0, 150) },
            method: this.name,
          };
        }
      }
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        status: VerificationStatus.FAILED,
        confidence: 0.95,
        reason: `Expected JSON object but received ${typeof parsed}`,
        evidence: { receivedType: typeof parsed },
        method: this.name,
      };
    }

    const missingKeys = [];
    const typeMismatches = [];
    const constraintViolations = [];

    // Check required properties
    if (Array.isArray(schema.required)) {
      for (const requiredKey of schema.required) {
        if (!(requiredKey in parsed) || parsed[requiredKey] === null || parsed[requiredKey] === undefined) {
          missingKeys.push(requiredKey);
        }
      }
    }

    // Check property types and constraints
    if (schema.properties && typeof schema.properties === "object") {
      for (const [key, propDef] of Object.entries(schema.properties)) {
        if (key in parsed && parsed[key] !== null && parsed[key] !== undefined) {
          const val = parsed[key];
          if (propDef.type) {
            const actualType = Array.isArray(val) ? "array" : typeof val;
            if (actualType !== propDef.type) {
              typeMismatches.push({
                field: key,
                expected: propDef.type,
                actual: actualType,
              });
            }
          }

          if (propDef.type === "number") {
            if (typeof propDef.minimum === "number" && val < propDef.minimum) {
              constraintViolations.push({
                field: key,
                rule: `minimum ${propDef.minimum}`,
                actual: val,
              });
            }
            if (typeof propDef.maximum === "number" && val > propDef.maximum) {
              constraintViolations.push({
                field: key,
                rule: `maximum ${propDef.maximum}`,
                actual: val,
              });
            }
          }

          if (propDef.type === "string" && propDef.minLength && val.length < propDef.minLength) {
            constraintViolations.push({
              field: key,
              rule: `minLength ${propDef.minLength}`,
              actualLength: val.length,
            });
          }
        }
      }
    }

    if (missingKeys.length > 0 || typeMismatches.length > 0 || constraintViolations.length > 0) {
      const issues = [];
      if (missingKeys.length > 0) issues.push(`missing required fields: [${missingKeys.join(", ")}]`);
      if (typeMismatches.length > 0) {
        issues.push(
          `type mismatches: ${typeMismatches.map((t) => `${t.field} (expected ${t.expected}, got ${t.actual})`).join("; ")}`
        );
      }
      if (constraintViolations.length > 0) {
        issues.push(
          `constraint violations: ${constraintViolations.map((c) => `${c.field} violated ${c.rule}`).join("; ")}`
        );
      }

      return {
        status: VerificationStatus.FAILED,
        confidence: 0.98,
        reason: `Schema validation failed: ${issues.join(" | ")}`,
        evidence: {
          missingKeys,
          typeMismatches,
          constraintViolations,
          parsedKeys: Object.keys(parsed),
        },
        method: this.name,
      };
    }

    return {
      status: VerificationStatus.PASSED,
      confidence: 1.0,
      reason: "Structured output conforms to expected schema and constraints.",
      evidence: { validatedKeys: Object.keys(parsed) },
      method: this.name,
    };
  }
}

module.exports = { StructuredOutputVerifier };
