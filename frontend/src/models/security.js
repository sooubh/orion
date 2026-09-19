import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Security = {
  status: async function () {
    return await fetch(`${API_BASE}/security/status`, {
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch security status.");
        return res.json();
      })
      .then((res) => res)
      .catch((e) => {
        console.error(e);
        return null;
      });
  },

  auditLogs: async function () {
    return await fetch(`${API_BASE}/security/audit-logs`, {
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch audit logs.");
        return res.json();
      })
      .then((res) => res.logs || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },

  policies: async function () {
    return await fetch(`${API_BASE}/security/policies`, {
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res.policies || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },

  policyAudit: async function () {
    return await fetch(`${API_BASE}/security/policy-audit`, {
      headers: baseHeaders(),
    })
      .then((res) => res.json())
      .then((res) => res.logs || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },

  evaluatePolicy: async function (payload) {
    return await fetch(`${API_BASE}/security/evaluate-policy`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(payload),
    })
      .then((res) => res.json())
      .catch((e) => ({ success: false, error: e.message }));
  },

  updateClassification: async function (folder, filename, newClassification, reason) {
    return await fetch(
      `${API_BASE}/document/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}/classification`,
      {
        method: "POST",
        headers: baseHeaders(),
        body: JSON.stringify({ newClassification, reason }),
      }
    )
      .then((res) => res.json())
      .catch((e) => ({ success: false, error: e.message }));
  },
};

export default Security;
