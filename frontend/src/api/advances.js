import client from "./client";

/* Advances carry an outstanding balance (like loans), but there is no manual repay
   endpoint: the balance is only drawn down by the payroll deduction dad enters on
   the draft, which the server applies on approve. */
export async function createAdvance(payload) {
  const { data } = await client.post("/advances", payload);
  return data;
}

export async function advancesForEmployee(employeeId) {
  const { data } = await client.get(`/advances/employee/${employeeId}`);
  return data;
}
