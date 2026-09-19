const { VerificationStatus } = require("../types");

class CalculationVerifier {
  static name = "CalculationVerifier";
  static DEFAULT_EPSILON = 0.001; // Allowable numeric rounding margin

  /**
   * Safely evaluate a basic arithmetic expression deterministically without eval().
   * Supports: numbers, +, -, *, /, %, ^, parentheses.
   * @param {string} expr
   * @returns {number}
   */
  static safeEvaluateExpression(expr) {
    if (typeof expr === "number") return expr;
    if (typeof expr !== "string") throw new Error("Expression must be a string or number");

    // Clean whitespace and sanitize
    const cleanExpr = expr.replace(/\s+/g, "").replace(/,/g, "");
    if (!/^[0-9.+\-*/%^()]+$/.test(cleanExpr)) {
      throw new Error(`Expression contains unsupported characters: ${expr}`);
    }

    // Tokenize
    const tokens = cleanExpr.match(/\d+(?:\.\d+)?|[+\-*/%^()]/g);
    if (!tokens) throw new Error("Unable to parse expression tokens");

    // Shunting-yard algorithm to convert infix to RPN
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2, "^": 3 };
    const outputQueue = [];
    const operatorStack = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!isNaN(token)) {
        outputQueue.push(parseFloat(token));
      } else if (token === "(") {
        operatorStack.push(token);
      } else if (token === ")") {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== "(") {
          outputQueue.push(operatorStack.pop());
        }
        if (operatorStack.length === 0) throw new Error("Mismatched parentheses");
        operatorStack.pop(); // Pop "("
      } else {
        // Operator
        // Handle unary minus: if at start or previous token was an operator or "("
        if (token === "-" && (i === 0 || ["+", "-", "*", "/", "%", "^", "("].includes(tokens[i - 1]))) {
          // Represent unary minus as 0 - nextToken or handle by pushing -1 and *
          outputQueue.push(0);
        }
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== "(" &&
          precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]
        ) {
          outputQueue.push(operatorStack.pop());
        }
        operatorStack.push(token);
      }
    }

    while (operatorStack.length > 0) {
      const op = operatorStack.pop();
      if (op === "(") throw new Error("Mismatched parentheses");
      outputQueue.push(op);
    }

    // Evaluate RPN
    const evalStack = [];
    for (const token of outputQueue) {
      if (typeof token === "number") {
        evalStack.push(token);
      } else {
        const b = evalStack.pop();
        const a = evalStack.pop();
        if (a === undefined || b === undefined) throw new Error("Invalid expression syntax");
        let res;
        switch (token) {
          case "+":
            res = a + b;
            break;
          case "-":
            res = a - b;
            break;
          case "*":
            res = a * b;
            break;
          case "/":
            if (Math.abs(b) < 1e-12) throw new Error("Division by zero");
            res = a / b;
            break;
          case "%":
            res = a % b;
            break;
          case "^":
            res = Math.pow(a, b);
            break;
          default:
            throw new Error(`Unsupported operator: ${token}`);
        }
        evalStack.push(res);
      }
    }

    if (evalStack.length !== 1) throw new Error("Evaluation failed: malformed expression");
    return evalStack[0];
  }

  /**
   * Verify an explicit calculation claim against ground-truth deterministic recomputation.
   * @param {Object} params
   * @param {string|number} params.claimedValue - The value stated by the agent or model
   * @param {string} [params.expression] - The mathematical formula / operation to verify
   * @param {number} [params.expectedValue] - Directly supplied expected numerical result
   * @param {Array<number>} [params.sumOf] - If verifying a total/sum of values
   * @param {number} [params.epsilon=0.001] - Tolerance threshold
   * @returns {Object} VerificationResult
   */
  static verify({ claimedValue, expression, expectedValue, sumOf, epsilon = CalculationVerifier.DEFAULT_EPSILON }) {
    const numClaimed = typeof claimedValue === "number" ? claimedValue : parseFloat(String(claimedValue).replace(/,/g, ""));
    if (isNaN(numClaimed)) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 1.0,
        reason: `Claimed value "${claimedValue}" could not be parsed as a number.`,
        evidence: { claimedValue },
        method: this.name,
      };
    }

    let calculatedExpected;
    try {
      if (typeof expectedValue === "number") {
        calculatedExpected = expectedValue;
      } else if (Array.isArray(sumOf)) {
        calculatedExpected = sumOf.reduce((acc, val) => acc + Number(val || 0), 0);
      } else if (expression) {
        calculatedExpected = this.safeEvaluateExpression(expression);
      } else {
        return {
          status: VerificationStatus.UNCERTAIN,
          confidence: 0.5,
          reason: "No reference expression, sum, or expected value provided for calculation verification.",
          evidence: { claimedValue },
          method: this.name,
        };
      }
    } catch (err) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 0.9,
        reason: `Calculation verification failed: ${err.message}`,
        evidence: { error: err.message, expression },
        method: this.name,
      };
    }

    const diff = Math.abs(numClaimed - calculatedExpected);
    const passes = diff <= epsilon;

    if (!passes) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 1.0,
        expected: calculatedExpected,
        actual: numClaimed,
        errorMargin: diff,
        reason: `Calculation mismatch: expected ${calculatedExpected}, claimed ${numClaimed} (delta: ${diff.toFixed(6)} > tolerance ${epsilon})`,
        evidence: {
          expected: calculatedExpected,
          actual: numClaimed,
          diff,
          expression: expression || (sumOf ? `sum([${sumOf.join(", ")}])` : "explicit expected"),
        },
        method: this.name,
      };
    }

    return {
      status: VerificationStatus.PASSED,
      confidence: 1.0,
      expected: calculatedExpected,
      actual: numClaimed,
      errorMargin: diff,
      reason: `Calculation verified deterministically: ${numClaimed} matches expected ${calculatedExpected} within tolerance.`,
      evidence: { expected: calculatedExpected, actual: numClaimed, diff },
      method: this.name,
    };
  }

  /**
   * Helper to detect and verify common arithmetic patterns in text (e.g., "$120 + $40 = $170" or "Total: 500").
   * @param {string} text
   * @returns {Array<Object>} Found calculations and verification results
   */
  static extractAndVerifyCalculations(text) {
    if (!text || typeof text !== "string") return [];
    const results = [];

    // Pattern: num op num = claimedNum
    const eqRegex = /([\d,]+(?:\.\d+)?)\s*([\+\-\*\/])\s*([\d,]+(?:\.\d+)?)\s*=\s*([\d,]+(?:\.\d+)?)/g;
    let match;
    while ((match = eqRegex.exec(text)) !== null) {
      const left = match[1];
      const op = match[2];
      const right = match[3];
      const claimed = match[4];
      const expr = `${left} ${op} ${right}`;
      const verification = this.verify({
        claimedValue: claimed,
        expression: expr,
      });
      results.push({
        rawText: match[0],
        expr,
        verification,
      });
    }

    return results;
  }
}

module.exports = { CalculationVerifier };
