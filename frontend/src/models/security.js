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
};

export default Security;
