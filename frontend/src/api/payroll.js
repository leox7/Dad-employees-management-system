import client from "./client";

export async function createRun(month, year) {
  const { data } = await client.post("/payroll/run", { month, year });
  return data;
}

export async function history() {
  const { data } = await client.get("/payroll/history");
  return data;
}

/* No status guard on the backend — safe to read a draft or an approved run.
   This is what the draft table loads from on mount, on browser reload (so
   autosaved state survives a refresh), and on navigating in from history. */
export async function getRun(runId) {
  const { data } = await client.get(`/payroll/${runId}`);
  return data;
}

/* Autosave. loan_deduction and advance_deduction are both editable; net_salary is
   always recomputed server-side, so the response — not our local guess — is the
   source of truth. */
export async function saveDraft(runId, lines) {
  const { data } = await client.put(`/payroll/${runId}/draft`, { lines });
  return data;
}

export async function approveRun(runId) {
  const { data } = await client.post(`/payroll/${runId}/approve`);
  return data;
}

export async function deleteRun(runId) {
  await client.delete(`/payroll/${runId}`);
}

/* The export endpoint is authenticated, so it can't be a plain <a href> — the
   browser wouldn't attach the bearer token. Fetch it as a blob through the same
   interceptor stack, then hand it to a temporary object-URL link.

   The filename is taken from the server's Content-Disposition when it survives
   the trip (it's a simple-response header, so it needs no CORS expose config for
   same-origin, but a cross-origin dev setup will hide it) — falling back to the
   backend's own payroll_MM_YYYY.xlsx convention rather than inventing a name. */
export async function exportRun(runId, month, year) {
  let response;
  try {
    response = await client.get(`/payroll/${runId}/export`, {
      responseType: "blob",
    });
  } catch (error) {
    // responseType 'blob' applies to error bodies too, so a 409's {detail: ...}
    // arrives as a Blob and would otherwise surface as "[object Blob]". Re-read
    // it as JSON and put it back where errorMessage() looks for it.
    const body = error.response?.data;
    if (body instanceof Blob) {
      try {
        error.response.data = JSON.parse(await body.text());
      } catch {
        error.response.data = { detail: await body.text() };
      }
    }
    throw error;
  }

  const disposition = response.headers["content-disposition"] ?? "";
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename =
    match?.[1] ?? `payroll_${String(month).padStart(2, "0")}_${year}.xlsx`;

  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}
