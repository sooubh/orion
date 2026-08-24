import { API_BASE } from "@/utils/constants";
import { baseHeaders } from "@/utils/request";

const Deliverables = {
  all: async function () {
    return await fetch(`${API_BASE}/deliverables`, {
      headers: baseHeaders(),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch deliverables.");
        return res.json();
      })
      .then((res) => res.deliverables || [])
      .catch((e) => {
        console.error(e);
        return [];
      });
  },
};

export default Deliverables;
