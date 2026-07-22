import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";

// Placeholder dashboards / camera pages — replace with real components
// as they're built out. Kept here so the routing below is fully functional.
function OperatorDashboard() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Operator dashboard</h1>
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Admin dashboard</h1>
    </div>
  );
}

function RegisterCameraPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Register a camera</h1>
    </div>
  );
}

function AdminCameraApprovals() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Pending camera approvals</h1>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Any authenticated user */}
          <Route element={<ProtectedRoute />}>
            {/* Operator-only routes */}
            <Route element={<RoleRoute allowedRoles={["operator"]} />}>
              <Route path="/operator/dashboard" element={<OperatorDashboard />} />
              <Route
                path="/operator/register-camera"
                element={<RegisterCameraPage />}
              />
            </Route>

            {/* Admin-only routes */}
            <Route element={<RoleRoute allowedRoles={["admin"]} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route
                path="/admin/camera-approvals"
                element={<AdminCameraApprovals />}
              />
            </Route>
          </Route>

          {/* Fallbacks */}
          <Route path="/" element={<Navigate to="/signin" replace />} />
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
