// // import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// // import { AuthProvider, useAuth } from "./context/AuthContext";
// // import ProtectedRoute from "./routes/ProtectedRoute";
// // import RoleRoute from "./routes/RoleRoute";

// // // Layout Shells
// // import AdminLayout from "./pages/Admin/AdminLayout";
// // import OperatorLayout from "./pages/Operator/OperatorLayout";

// // // Auth Pages
// // import SignInPage from "./pages/Operator/SignInPage";
// // import SignUpPage from "./pages/Operator/SignUpPage";
// // import AdminSignUpPage from "./pages/Admin/AdminSignUpPage";
// // import AdminSignInPage from "./pages/Admin/AdminSignInPage";

// // // Active Operator Pages
// // import OperatorDashboard from "./pages/Operator/OperatorDashboard";
// // import ApprovedCamerasPage from "./pages/Admin/ApprovedCamerasPage";
// // import RegisterCameraPage from "./pages/RegisterCameraPage";
// // import CameraManagementPage from "./pages/Operator/CameraManagementPage";

// // // Re-ID Comparison Component
// // import VehicleCompare from "./Components/VehicleCompare"; // Make sure path matches your folder structure!

// // // Placeholder Operator Pages (Prevents 404 / Signin Redirects)
// // import PlateSearchPage from "./pages/Operator/PlateSearchPage";
// // import VehicleForensicsPage from "./pages/Operator/VehicleForensicsPage";
// // import ConvoyDetectionPage from "./pages/Operator/ConvoyDetectionPage";
// // import TrafficCongestionPage from "./pages/Operator/TrafficCongestionPage";
// // import PathVisualizationPage from "./pages/Operator/PathVisualizationPage";

// // // Active Admin Pages
// // import AdminDashboard from "./pages/Admin/AdminDashboard";
// // import AdminCameraApprovals from "./pages/Admin/AdminCameraApprovals";

// // // Dev / Testing
// // import DetectionTest from "./Components/DetectionTest";
// // import PlateDetection from "./Components/PlateDetection";
// // // Redirects bare "/admin" based on current auth state
// // function AdminIndexRedirect() {
// //   const { user, isAuthenticated } = useAuth();
// //   if (!isAuthenticated) return <Navigate to="/admin/signin" replace />;
// //   return user?.role === "admin" ? (
// //     <Navigate to="/admin/dashboard" replace />
// //   ) : (
// //     <Navigate to="/admin/signin" replace />
// //   );
// // }

// // // Redirects bare "/" based on current auth state
// // function RootIndexRedirect() {
// //   const { user, isAuthenticated } = useAuth();
// //   if (!isAuthenticated) return <Navigate to="/signin" replace />;
// //   return user?.role === "admin" ? (
// //     <Navigate to="/admin/dashboard" replace />
// //   ) : (
// //     <Navigate to="/operator/dashboard" replace />
// //   );
// // }

// // export default function App() {
// //   return (
// //     <BrowserRouter>
// //       <AuthProvider>
// //         <Routes>
// //           {/* Public Auth Routes */}
// //           <Route path="/signin" element={<SignInPage />} />
// //           <Route path="/signup" element={<SignUpPage />} />
// //           <Route path="/admin/signup" element={<AdminSignUpPage />} />
// //           <Route path="/admin/signin" element={<AdminSignInPage />} />

// //           {/* Test Route */}
// //           <Route path="/test-detection" element={<DetectionTest />} />
// // <Route path="/operator/plate-detection" element={<PlateDetection />} />
// //           {/* Bare "/" & "/admin" Redirect Helpers */}
// //           <Route path="/" element={<RootIndexRedirect />} />
// //           <Route path="/admin" element={<AdminIndexRedirect />} />

// //           {/* ================= OPERATOR PORTAL ================= */}
// //           <Route element={<ProtectedRoute />}>
// //             <Route element={<RoleRoute allowedRoles={["operator", "admin"]} />}>
// //               <Route element={<OperatorLayout />}>
// //                 <Route path="/operator/dashboard" element={<OperatorDashboard />} />
// //                 <Route path="/operator/live-monitoring" element={<ApprovedCamerasPage />} />
                
// //                 {/* Vehicle Re-ID Comparison Page mounted directly here */}
// //                 <Route path="/operator/reid-review" element={<VehicleCompare />} />
// //                 <Route path="/operator/compare" element={<VehicleCompare />} />

// //                 <Route path="/operator/register-camera" element={<RegisterCameraPage />} />
// //                 <Route path="/operator/camera-management" element={<CameraManagementPage />} />

// //                 {/* Registered Sub-pages matching OperatorLayout Sidebar */}
// //                 <Route path="/operator/plate-search" element={<PlateSearchPage />} />
// //                 <Route path="/operator/forensics" element={<VehicleForensicsPage />} />
// //                 <Route path="/operator/convoy-detection" element={<ConvoyDetectionPage />} />
// //                 <Route path="/operator/congestion" element={<TrafficCongestionPage />} />
// //                 <Route path="/operator/path-viz" element={<PathVisualizationPage />} />
// //                 <Route
// //                   path="/operator/alerts"
// //                   element={
// //                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
// //                       <h1 className="text-xl font-bold text-slate-900">System Alerts Log</h1>
// //                     </div>
// //                   }
// //                 />
// //                 <Route
// //                   path="/operator/reports"
// //                   element={
// //                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
// //                       <h1 className="text-xl font-bold text-slate-900">Reports & Analytics</h1>
// //                     </div>
// //                   }
// //                 />
// //               </Route>
// //             </Route>
// //           </Route>

// //           {/* ================= ADMIN PORTAL ================= */}
// //           <Route element={<ProtectedRoute />}>
// //             <Route element={<RoleRoute allowedRoles={["admin"]} />}>
// //               <Route element={<AdminLayout />}>
// //                 <Route path="/admin/dashboard" element={<AdminDashboard />} />
// //                 <Route path="/admin/camera-approvals" element={<AdminCameraApprovals />} />
// //               </Route>
// //             </Route>
// //           </Route>

// //           {/* Fallback */}
// //           <Route path="*" element={<Navigate to="/signin" replace />} />
// //         </Routes>
// //       </AuthProvider>
// //     </BrowserRouter>
// //   );
// // }
// import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// import { AuthProvider, useAuth } from "./context/AuthContext";
// import ProtectedRoute from "./routes/ProtectedRoute";
// import RoleRoute from "./routes/RoleRoute";

// // Layout Shells
// import AdminLayout from "./pages/Admin/AdminLayout";
// import OperatorLayout from "./pages/Operator/OperatorLayout";

// // Auth Pages
// import SignInPage from "./pages/Operator/SignInPage";
// import SignUpPage from "./pages/Operator/SignUpPage";
// import AdminSignUpPage from "./pages/Admin/AdminSignUpPage";
// import AdminSignInPage from "./pages/Admin/AdminSignInPage";

// // Active Operator Pages
// import OperatorDashboard from "./pages/Operator/OperatorDashboard";
// import ApprovedCamerasPage from "./pages/Admin/ApprovedCamerasPage";
// import RegisterCameraPage from "./pages/RegisterCameraPage";
// import CameraManagementPage from "./pages/Operator/CameraManagementPage";

// // Re-ID Comparison Component
// import VehicleCompare from "./Components/VehicleCompare";

// // Operator Pages
// // Module 3 UI is now inside PlateSearchPage
// import PlateSearchPage from "./pages/Operator/PlateSearchPage";
// import VehicleForensicsPage from "./pages/Operator/VehicleForensicsPage";
// import ConvoyDetectionPage from "./pages/Operator/ConvoyDetectionPage";
// import TrafficCongestionPage from "./pages/Operator/TrafficCongestionPage";
// import PathVisualizationPage from "./pages/Operator/PathVisualizationPage";

// // Active Admin Pages
// import AdminDashboard from "./pages/Admin/AdminDashboard";
// import AdminCameraApprovals from "./pages/Admin/AdminCameraApprovals";

// // ============================================================
// // REDIRECT BARE "/admin"
// // ============================================================

// function AdminIndexRedirect() {
//   const { user, isAuthenticated } = useAuth();

//   if (!isAuthenticated) {
//     return <Navigate to="/admin/signin" replace />;
//   }

//   return user?.role === "admin" ? (
//     <Navigate to="/admin/dashboard" replace />
//   ) : (
//     <Navigate to="/admin/signin" replace />
//   );
// }


// // ============================================================
// // REDIRECT BARE "/"
// // ============================================================

// function RootIndexRedirect() {
//   const { user, isAuthenticated } = useAuth();

//   if (!isAuthenticated) {
//     return <Navigate to="/signin" replace />;
//   }

//   return user?.role === "admin" ? (
//     <Navigate to="/admin/dashboard" replace />
//   ) : (
//     <Navigate to="/operator/dashboard" replace />
//   );
// }


// // ============================================================
// // MAIN APP
// // ============================================================

// export default function App() {
//   return (
//     <BrowserRouter>
//       <AuthProvider>

//         <Routes>

//           {/* =====================================================
//               PUBLIC AUTH ROUTES
//           ===================================================== */}

//           <Route
//             path="/signin"
//             element={<SignInPage />}
//           />

//           <Route
//             path="/signup"
//             element={<SignUpPage />}
//           />

//           <Route
//             path="/admin/signup"
//             element={<AdminSignUpPage />}
//           />

//           <Route
//             path="/admin/signin"
//             element={<AdminSignInPage />}
//           />


       

//           {/* =====================================================
//               ROOT REDIRECTS
//           ===================================================== */}

//           <Route
//             path="/"
//             element={<RootIndexRedirect />}
//           />

//           <Route
//             path="/admin"
//             element={<AdminIndexRedirect />}
//           />


//           {/* =====================================================
//               OPERATOR PORTAL
//           ===================================================== */}

//           <Route element={<ProtectedRoute />}>

//             <Route
//               element={
//                 <RoleRoute allowedRoles={["operator", "admin"]} />
//               }
//             >

//               <Route element={<OperatorLayout />}>

//                 {/* -------------------------------------------------
//                     OPERATOR DASHBOARD
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/dashboard"
//                   element={<OperatorDashboard />}
//                 />


//                 {/* -------------------------------------------------
//                     LIVE MONITORING
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/live-monitoring"
//                   element={<ApprovedCamerasPage />}
//                 />


//                 {/* =================================================
//                     MODULE 3 — LICENSE PLATE IDENTIFICATION

//                     Module 3 UI is inside:
//                     pages/Operator/PlateSearchPage.jsx

//                     No separate PlateDetection route needed.
//                 ================================================= */}

//                 <Route
//                   path="/operator/plate-search"
//                   element={<PlateSearchPage />}
//                 />


//                 {/* -------------------------------------------------
//                     VEHICLE RE-ID
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/reid-review"
//                   element={<VehicleCompare />}
//                 />

//                 <Route
//                   path="/operator/compare"
//                   element={<VehicleCompare />}
//                 />


//                 {/* -------------------------------------------------
//                     CAMERA MANAGEMENT
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/register-camera"
//                   element={<RegisterCameraPage />}
//                 />

//                 <Route
//                   path="/operator/camera-management"
//                   element={<CameraManagementPage />}
//                 />


//                 {/* -------------------------------------------------
//                     VEHICLE FORENSICS
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/forensics"
//                   element={<VehicleForensicsPage />}
//                 />


//                 {/* -------------------------------------------------
//                     CONVOY DETECTION
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/convoy-detection"
//                   element={<ConvoyDetectionPage />}
//                 />


//                 {/* -------------------------------------------------
//                     TRAFFIC CONGESTION
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/congestion"
//                   element={<TrafficCongestionPage />}
//                 />


//                 {/* -------------------------------------------------
//                     PATH VISUALIZATION
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/path-viz"
//                   element={<PathVisualizationPage />}
//                 />


//                 {/* -------------------------------------------------
//                     ALERTS
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/alerts"
//                   element={
//                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
//                       <h1 className="text-xl font-bold text-slate-900">
//                         System Alerts Log
//                       </h1>
//                     </div>
//                   }
//                 />


//                 {/* -------------------------------------------------
//                     REPORTS
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/operator/reports"
//                   element={
//                     <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
//                       <h1 className="text-xl font-bold text-slate-900">
//                         Reports & Analytics
//                       </h1>
//                     </div>
//                   }
//                 />

//               </Route>

//             </Route>

//           </Route>


//           {/* =====================================================
//               ADMIN PORTAL
//           ===================================================== */}

//           <Route element={<ProtectedRoute />}>

//             <Route
//               element={
//                 <RoleRoute allowedRoles={["admin"]} />
//               }
//             >

//               <Route element={<AdminLayout />}>

//                 {/* -------------------------------------------------
//                     ADMIN DASHBOARD
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/admin/dashboard"
//                   element={<AdminDashboard />}
//                 />


//                 {/* -------------------------------------------------
//                     ADMIN CAMERA APPROVALS
//                 ------------------------------------------------- */}

//                 <Route
//                   path="/admin/camera-approvals"
//                   element={<AdminCameraApprovals />}
//                 />

//               </Route>

//             </Route>

//           </Route>


//           {/* =====================================================
//               FALLBACK
//           ===================================================== */}

//           <Route
//             path="*"
//             element={<Navigate to="/signin" replace />}
//           />

//         </Routes>

//       </AuthProvider>
//     </BrowserRouter>
//   );
// }


import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

// Layout Shells
import AdminLayout from "./pages/Admin/AdminLayout";
import OperatorLayout from "./pages/Operator/OperatorLayout";

// Auth Pages
import SignInPage from "./pages/Operator/SignInPage";
import SignUpPage from "./pages/Operator/SignUpPage";
import AdminSignUpPage from "./pages/Admin/AdminSignUpPage";
import AdminSignInPage from "./pages/Admin/AdminSignInPage";

// Active Operator Pages
import OperatorDashboard from "./pages/Operator/OperatorDashboard";
import ApprovedCamerasPage from "./pages/Admin/ApprovedCamerasPage";
import OperatorCameraManagement from "./pages/Operator/OperatorCameraManagement";

// Re-ID Comparison Component
import VehicleCompare from "./Components/VehicleCompare";

// Operator Pages
import PlateSearchPage from "./pages/Operator/PlateSearchPage";
import VehicleForensicsPage from "./pages/Operator/VehicleForensicsPage";
import ConvoyDetectionPage from "./pages/Operator/ConvoyDetectionPage";
import TrafficCongestionPage from "./pages/Operator/TrafficCongestionPage";
import PathVisualizationPage from "./pages/Operator/PathVisualizationPage";
import AlertsPage from "./pages/Operator/AlertsPage";

// Active Admin Pages
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminUsers from "./pages/Admin/AdminUsers";
import AdminAuditLog from "./pages/Admin/AdminAuditLog";
// FIX: this import was missing, which crashed /admin/cameras.
// Adjust the path/filename if your file is named differently.
import AdminCameraManagement from "./pages/Admin/AdminCameraManagement";

// Redirects bare "/admin" based on current auth state
function AdminIndexRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/admin/signin" replace />;
  return user?.role === "admin" ? (
    <Navigate to="/admin/dashboard" replace />
  ) : (
    <Navigate to="/admin/signin" replace />
  );
}

// Redirects bare "/" based on current auth state
function RootIndexRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  return user?.role === "admin" ? (
    <Navigate to="/admin/dashboard" replace />
  ) : (
    <Navigate to="/operator/dashboard" replace />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/admin/signup" element={<AdminSignUpPage />} />
          <Route path="/admin/signin" element={<AdminSignInPage />} />

          {/* Bare "/" & "/admin" Redirect Helpers */}
          <Route path="/" element={<RootIndexRedirect />} />
          <Route path="/admin" element={<AdminIndexRedirect />} />

          {/* ================= OPERATOR PORTAL ================= */}
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allowedRoles={["operator", "admin"]} />}>
              <Route element={<OperatorLayout />}>
                <Route path="/operator/dashboard" element={<OperatorDashboard />} />
                <Route path="/operator/live-monitoring" element={<ApprovedCamerasPage />} />

                {/* Vehicle Re-ID Comparison */}
                <Route path="/operator/reid-review" element={<VehicleCompare />} />
                <Route path="/operator/compare" element={<VehicleCompare />} />

                {/* Sub-pages matching OperatorLayout sidebar */}
                <Route path="/operator/plate-search" element={<PlateSearchPage />} />
                <Route path="/operator/forensics" element={<VehicleForensicsPage />} />
                <Route path="/operator/convoy-detection" element={<ConvoyDetectionPage />} />
                <Route path="/operator/congestion" element={<TrafficCongestionPage />} />
                <Route path="/operator/path-viz" element={<PathVisualizationPage />} />
                <Route path="/operator/alerts" element={<AlertsPage />} />

               <Route path="/operator/camera-management" element={<OperatorCameraManagement />} />

                <Route
                  path="/operator/reports"
                  element={
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
                      <h1 className="text-xl font-bold text-slate-900">Reports & Analytics</h1>
                    </div>
                  }
                />
              </Route>
            </Route>
          </Route>

          {/* ================= ADMIN PORTAL ================= */}
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allowedRoles={["admin"]} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/audit-log" element={<AdminAuditLog />} />
                {/* Camera Approvals, Register Camera, and Live Cameras are
                    tabs inside this one page instead of separate routes. */}
                <Route path="/admin/cameras" element={<AdminCameraManagement />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/signin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}