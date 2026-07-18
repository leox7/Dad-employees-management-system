import { Outlet, Route, Routes } from "react-router-dom";

import { BottomBar, Sidebar } from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Advances from "./pages/Advances";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Loans from "./pages/Loans";
import Login from "./pages/Login";
import Payroll from "./pages/Payroll";

/* The signed-in shell: sidebar on desktop, bottom tabs on mobile (CSS decides
   which is visible — both are always mounted, so there is no layout flash on
   resize and no JS breakpoint state to keep in sync). */
function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main fade-in">
        <Outlet />
      </main>
      <BottomBar />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/loans" element={<Loans />} />
        <Route path="/advances" element={<Advances />} />
        <Route path="/payroll" element={<Payroll />} />
        <Route path="/payroll/:runId" element={<Payroll />} />
      </Route>
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
