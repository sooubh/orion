const fs = require("fs");
const path = require("path");
const { VerificationStatus } = require("../types");

class DeliverableVerifier {
  static name = "DeliverableVerifier";
  static MIN_FILE_SIZE_BYTES = 100;

  /**
   * Magic bytes signatures for common file formats
   */
  static SIGNATURES = {
    docx: [0x50, 0x4b, 0x03, 0x04], // PK.. (ZIP archive)
    xlsx: [0x50, 0x4b, 0x03, 0x04],
    pptx: [0x50, 0x4b, 0x03, 0x04],
    pdf: [0x25, 0x50, 0x44, 0x46],   // %PDF
  };

  /**
   * Verify file existence, size, magic bytes, and structure.
   * @param {Object} params
   * @param {string} params.filePath - Absolute path to file on disk
   * @param {Array<string>} [params.requiredSections] - Expected section headers/keywords (for text/markdown/code)
   * @param {number} [params.minSizeBytes=100] - Minimum expected file size
   * @returns {Object} VerificationResult
   */
  static verify({ filePath, requiredSections = [], minSizeBytes = DeliverableVerifier.MIN_FILE_SIZE_BYTES }) {
    if (!filePath || typeof filePath !== "string") {
      return {
        status: VerificationStatus.FAILED,
        confidence: 1.0,
        reason: "No file path provided for deliverable verification.",
        evidence: null,
        method: this.name,
      };
    }

    if (!fs.existsSync(filePath)) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 1.0,
        reason: `Deliverable file does not exist on disk: ${path.basename(filePath)}`,
        evidence: { filePath },
        method: this.name,
      };
    }

    let stats;
    try {
      stats = fs.statSync(filePath);
    } catch (err) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 1.0,
        reason: `Failed to inspect file stats: ${err.message}`,
        evidence: { error: err.message },
        method: this.name,
      };
    }

    if (!stats.isFile()) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 1.0,
        reason: `Path is not a regular file: ${path.basename(filePath)}`,
        evidence: { isDirectory: stats.isDirectory() },
        method: this.name,
      };
    }

    if (stats.size === 0) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 1.0,
        reason: `Deliverable file is empty (0 bytes): ${path.basename(filePath)}`,
        evidence: { sizeBytes: 0 },
        method: this.name,
      };
    }

    if (stats.size < minSizeBytes) {
      return {
        status: VerificationStatus.FAILED,
        confidence: 0.95,
        reason: `Deliverable file is suspiciously small (${stats.size} bytes < min ${minSizeBytes} bytes): ${path.basename(filePath)}`,
        evidence: { sizeBytes: stats.size, minSizeBytes },
        method: this.name,
      };
    }

    const ext = path.extname(filePath).replace(".", "").toLowerCase();
    const expectedSig = this.SIGNATURES[ext];

    // Check magic bytes for binary files
    if (expectedSig) {
      let buffer = Buffer.alloc(4);
      let fd;
      try {
        fd = fs.openSync(filePath, "r");
        fs.readSync(fd, buffer, 0, 4, 0);
      } catch (err) {
        return {
          status: VerificationStatus.FAILED,
          confidence: 0.9,
          reason: `Failed to read file header: ${err.message}`,
          evidence: { error: err.message },
          method: this.name,
        };
      } finally {
        if (fd !== undefined) fs.closeSync(fd);
      }

      const matchesSig = expectedSig.every((byte, idx) => buffer[idx] === byte);
      if (!matchesSig) {
        return {
          status: VerificationStatus.FAILED,
          confidence: 1.0,
          reason: `File signature mismatch for extension .${ext}. File may be corrupted or incorrectly encoded.`,
          evidence: {
            expectedBytes: expectedSig.map((b) => b.toString(16)),
            actualBytes: Array.from(buffer).map((b) => b.toString(16)),
          },
          method: this.name,
        };
      }
    }

    // Check code / text files
    const textExtensions = ["js", "ts", "json", "py", "md", "txt", "csv", "sql", "html", "css", "yaml", "yml"];
    if (textExtensions.includes(ext)) {
      let content;
      try {
        content = fs.readFileSync(filePath, "utf-8");
      } catch (err) {
        return {
          status: VerificationStatus.FAILED,
          confidence: 0.9,
          reason: `Failed to read text content: ${err.message}`,
          evidence: { error: err.message },
          method: this.name,
        };
      }

      if (ext === "json") {
        try {
          JSON.parse(content);
        } catch (jsonErr) {
          return {
            status: VerificationStatus.FAILED,
            confidence: 1.0,
            reason: `JSON syntax error in deliverable: ${jsonErr.message}`,
            evidence: { error: jsonErr.message },
            method: this.name,
          };
        }
      }

      if (ext === "js") {
        try {
          // Basic syntax check using new Function without executing
          new Function(content);
        } catch (syntaxErr) {
          return {
            status: VerificationStatus.FAILED,
            confidence: 1.0,
            reason: `JavaScript syntax error in deliverable: ${syntaxErr.message}`,
            evidence: { error: syntaxErr.message },
            method: this.name,
          };
        }
      }

      if (Array.isArray(requiredSections) && requiredSections.length > 0) {
        const missingSections = [];
        for (const sec of requiredSections) {
          if (!content.toLowerCase().includes(sec.toLowerCase())) {
            missingSections.push(sec);
          }
        }
        if (missingSections.length > 0) {
          return {
            status: VerificationStatus.FAILED,
            confidence: 0.95,
            reason: `Deliverable content missing required section(s): [${missingSections.join(", ")}]`,
            evidence: { missingSections },
            method: this.name,
          };
        }
      }
    }

    return {
      status: VerificationStatus.PASSED,
      confidence: 1.0,
      reason: `Deliverable verified: file exists (${stats.size} bytes), valid header signature, and integrity checks passed.`,
      evidence: {
        filename: path.basename(filePath),
        sizeBytes: stats.size,
        extension: ext,
      },
      method: this.name,
    };
  }
}

module.exports = { DeliverableVerifier };
