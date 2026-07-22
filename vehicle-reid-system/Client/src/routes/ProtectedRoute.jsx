import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wrap protected routes with this. Redirects unauthenticated users to /signin
 * and remembers where they were trying to go so we can send them back after login.
 */
export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
