import client from "./client";

export async function createLoan(payload) {
  const { data } = await client.post("/loans", payload);
  return data;
}

/* Manual repayment. The backend rejects (400) an amount above the outstanding
   balance rather than capping it — dad gets told immediately if he mistyped. */
export async function repayLoan(loanId, payload) {
  const { data } = await client.post(`/loans/${loanId}/repay`, payload);
  return data;
}

/* Each loan comes back with its full repayment ledger attached. */
export async function loansForEmployee(employeeId) {
  const { data } = await client.get(`/loans/employee/${employeeId}`);
  return data;
}
