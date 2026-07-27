import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import OperatorDashboard from "./pages/Operator/OperatorDashboard";
import RoleRoute from "./routes/RoleRoute";
import DetectionTest from './Components/DetectionTest';

import SignInPage from "./pages/Operator/SignInPage";
import SignUpPage from "./pages/Operator/SignUpPage";
import AdminSignUpPage from "./pages/Admin/AdminSignUpPage";
import AdminSignInPage from "./pages/Admin/AdminSignInPage";
import RegisterCameraPage from "./pages/RegisterCameraPage";
import AdminCameraApprovals from "./pages/Admin/AdminCameraApprovals";



// Redirects bare "/admin" based on current auth state.
function AdminIndexRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  return user?.role === "admin" ? (
    <Navigate to="/admin/dashboard" replace />
  ) : (
    <Navigate to="/signin" replace />
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
          <Route path="/admin/signup" element={<AdminSignUpPage />} />
          <Route path="/admin/signin" element={<AdminSignInPage />} />

          {/* Bare "/admin" redirects based on auth state */}
          <Route path="/admin" element={<AdminIndexRedirect />} />

          <Route path="/test-detection" element={<DetectionTest />} />

          {/* Any authenticated user */}
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allowedRoles={["operator", "admin"]} />}>
              <Route path="/register-camera" element={<RegisterCameraPage />} />
            </Route>

            <Route element={<RoleRoute allowedRoles={["operator"]} />}>
              <Route path="/operator/dashboard" element={<OperatorDashboard />} />
            </Route>

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