import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Review = {
  run: async function ({ title, content, workspaceSlug = null, perspectives = [] }) {
    return await fetch(`${API_BASE}/review/run`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ title, content, workspaceSlug, perspectives }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to execute AI Review.");
        return res.json();
      })
      .then((res) => res)
      .catch((e) => {
        console.error(e);
        return { success: false, error: e.message };
      });
  },

  history: async function () {
    return await fetch(`${API_BASE}/review/history`, {
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch review history.");
        return res.json();
      })
      .then((res) => res.reviews || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },

  getById: async function (id) {
    return await fetch(`${API_BASE}/review/${id}`, {
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch review.");
        return res.json();
      })
      .then((res) => res.review || null)
      .catch((e) => {
        console.error(e);
        return null;
      });
  },
};

export default Review;
