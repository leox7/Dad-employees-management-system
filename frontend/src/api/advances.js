import client from "./client";

/* No repay endpoint by design: an advance is always auto-deducted in full in the
   month it applies to, never partially. */
export async function createAdvance(payload) {
  const { data } = await client.post("/advances", payload);
  return data;
}

export async function advancesForEmployee(employeeId) {
  const { data } = await client.get(`/advances/employee/${employeeId}`);
  return data;
}
