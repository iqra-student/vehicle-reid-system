import axios from "axios";

// Same base URL as axiosInstance.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

// AuthContext saves the JWT with localStorage.setItem("token", ...)
export function getToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Record one operator action in the audit log.
 * Fire-and-forget: never throws and never blocks the page, so a logging
 * problem can't break the feature the operator is using.
 *
 * logActivity({
 *   action:   one of the keys in ACTION_LABELS below,
 *   cameraId: "CAM_01",
 *   query:    plate text / uploaded file name,
 *   reason:   "Case #2231 - stolen vehicle report",
 *   summary:  "Top match on camera 7 (94%)",
 *   details:  { ...small result object, no images },
 * })
 */
export function logActivity(entry) {
  axios
    .post(`${API_BASE}/audit`, entry, { headers: authHeaders() })
    .catch((err) => {
      console.warn("[audit] could not record activity:", err?.response?.data?.message || err.message);
    });
}

export const ACTION_LABELS = {
  REID_SEARCH: "Re-ID search",
  PLATE_SEARCH: "Plate history search",
  PLATE_DETECT: "Plate detection",
  PLATE_TRACK: "Plate tracking",
  CONGESTION_ANALYSIS: "Congestion analysis",
  ALERT_RESOLVE: "Alert dismissed",
  CAMERA_REGISTER: "Camera registered",
  LIVE_FEED_VIEW: "Live feed viewed",
  OTHER: "Other",
};

// Lookups of one specific vehicle — a reason / case number is expected.
export const REASON_EXPECTED = ["REID_SEARCH", "PLATE_SEARCH"];