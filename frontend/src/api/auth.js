import client, { clearToken, setToken } from "./client";

/* POST /auth/login expects an OAuth2 form body, not JSON — and its `username`
   field carries the email (login is by email; `username` is display-only). */
export async function login(email, password) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);

  const { data } = await client.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  setToken(data.access_token);
  return data;
}

export async function me() {
  const { data } = await client.get("/auth/me");
  return data;
}

export function logout() {
  clearToken();
}
