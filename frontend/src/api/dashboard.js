import client from "./client";

export async function summary() {
  const { data } = await client.get("/dashboard/summary");
  return data;
}

/* Approved runs only, chronological — drafts never skew the trend. */
export async function monthlyTrend() {
  const { data } = await client.get("/dashboard/monthly-trend");
  return data;
}
