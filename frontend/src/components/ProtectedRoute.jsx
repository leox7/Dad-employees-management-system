import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for the token restore to finish — rendering the redirect during the
  // check would log out anyone who refreshes the page.
  if (loading) return <div className="loading">Loading…</div>;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
