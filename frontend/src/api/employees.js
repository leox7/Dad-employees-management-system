import client from "./client";

export async function listEmployees({ activeOnly = false } = {}) {
  const { data } = await client.get("/employees", {
    params: activeOnly ? { active_only: true } : {},
  });
  return data;
}

export async function createEmployee(payload) {
  const { data } = await client.post("/employees", payload);
  return data;
}

export async function updateEmployee(id, payload) {
  const { data } = await client.put(`/employees/${id}`, payload);
  return data;
}

/* Soft delete — the backend sets status='inactive' and preserves all history.
   Named `deactivate` here to match what the UI says (design.md §7: the word
   stays the same through the whole flow). */
export async function deactivateEmployee(id) {
  const { data } = await client.delete(`/employees/${id}`);
  return data;
}

export async function reactivateEmployee(id) {
  return updateEmployee(id, { status: "active" });
}
