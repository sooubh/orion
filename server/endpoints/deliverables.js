const path = require("path");
const fs = require("fs");
const { userFromSession } = require("../utils/http");
const { validatedRequest } = require("../utils/middleware/validatedRequest");
const { flexUserRoleValid, ROLES } = require("../utils/middleware/multiUserProtected");
const { WorkspaceChats } = require("../models/workspaceChats");

function deliverablesEndpoints(app) {
  if (!app) return;

  /**
   * GET /api/deliverables
   * List all generated deliverables (DOCX, XLSX, PPTX, PDF, Code, Markdown)
   */
  app.get(
    "/deliverables",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const storageRoot =
          process.env.STORAGE_DIR || path.resolve(__dirname, "../../storage");
        const generatedDir = path.join(storageRoot, "generated-files");

        const deliverables = [];

        // Check storage directory
        if (fs.existsSync(generatedDir)) {
          const files = fs.readdirSync(generatedDir);
          for (const file of files) {
            try {
              const fullPath = path.join(generatedDir, file);
              const stats = fs.statSync(fullPath);
              if (stats.isFile()) {
                const ext = path.extname(file).replace(".", "").toLowerCase();
                const typeInfo = getDeliverableType(ext);

                const { DeliverableVerifier } = require("../utils/verification/verifiers/deliverable");
                const verification = DeliverableVerifier.verify({ filePath: fullPath });

                deliverables.push({
                  id: file,
                  filename: file,
                  storageFilename: file,
                  extension: ext,
                  type: typeInfo.name,
                  badge: typeInfo.badge,
                  badgeColor: typeInfo.badgeColor,
                  sizeBytes: stats.size,
                  createdAt: stats.birthtime || stats.mtime,
                  downloadUrl: `/api/agent-skills/generated-files/${file}`,
                  origin: "Agent Tool Execution",
                  verificationStatus: verification.status,
                  verificationConfidence: verification.confidence,
                  verificationReason: verification.reason,
                });
              }
            } catch (err) {
              console.warn(`Failed reading deliverable ${file}:`, err.message);
            }
          }
        }

        // Sort latest first
        deliverables.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        return response.status(200).json({ deliverables });
      } catch (error) {
        console.error("[deliverablesEndpoints] Error:", error.message);
        return response.status(500).json({ error: "Failed to list deliverables." });
      }
    }
  );

  /**
   * POST /api/deliverables/:filename/verify
   * On-demand deliverable verification and integrity check
   */
  app.post(
    "/deliverables/:filename/verify",
    [validatedRequest, flexUserRoleValid([ROLES.all])],
    async (request, response) => {
      try {
        const { filename } = request.params;
        const storageRoot =
          process.env.STORAGE_DIR || path.resolve(__dirname, "../../storage");
        const fullPath = path.join(storageRoot, "generated-files", path.basename(filename));

        const { DeliverableVerifier } = require("../utils/verification/verifiers/deliverable");
        const verification = DeliverableVerifier.verify({ filePath: fullPath });

        return response.status(200).json({
          filename,
          verification,
        });
      } catch (error) {
        console.error("[deliverablesEndpoints] Verify Error:", error.message);
        return response.status(500).json({ error: "Failed to verify deliverable." });
      }
    }
  );
}

function getDeliverableType(ext) {
  switch (ext) {
    case "docx":
    case "doc":
      return { name: "Word Document", badge: "DOCX", badgeColor: "blue" };
    case "xlsx":
    case "xls":
    case "csv":
      return { name: "Spreadsheet", badge: "XLSX", badgeColor: "emerald" };
    case "pptx":
    case "ppt":
      return { name: "Presentation", badge: "PPTX", badgeColor: "amber" };
    case "pdf":
      return { name: "PDF Document", badge: "PDF", badgeColor: "rose" };
    case "js":
    case "py":
    case "ts":
    case "json":
    case "sh":
    case "html":
    case "css":
      return { name: "Source Code", badge: "CODE", badgeColor: "purple" };
    case "md":
    case "txt":
      return { name: "Report / Text", badge: "DOC", badgeColor: "cyan" };
    default:
      return { name: "Artifact", badge: ext.toUpperCase().slice(0, 4) || "FILE", badgeColor: "zinc" };
  }
}

module.exports = { deliverablesEndpoints };
