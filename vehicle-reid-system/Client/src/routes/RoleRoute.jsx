import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wrap role-gated routes with this, e.g.:
 * <Route element={<RoleRoute allowedRoles={["admin"]} />}>
 *   <Route path="/admin/dashboard" element={<AdminDashboard />} />
 * </Route>
 *
 * If the logged-in user's role isn't in allowedRoles, send them to their
 * own dashboard instead of the page they tried to access.
 */
export default function RoleRoute({ allowedRoles = [] }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (!allowedRoles.includes(user?.role)) {
    const fallback =
      user?.role === "admin" ? "/admin/dashboard" : "/operator/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
