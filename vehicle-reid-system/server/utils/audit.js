const AuditLog = require("../models/AuditLog");
const { ACTIONS } = require("../models/AuditLog");
const User = require("../models/User");

const MAX_DETAILS_BYTES = 20000;

const clip = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

class AuditError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Write one audit entry for the logged-in user (req.user comes from authMiddleware).
 *
 * Use it from any Express route, e.g. after a camera is created:
 *   await recordAudit(req, { action: "CAMERA_REGISTER", cameraId: camera.name,
 *                            summary: `Registered ${camera.name} at ${camera.location}` });
 */
async function recordAudit(req, { action, cameraId, query, reason, summary, details } = {}) {
  if (!ACTIONS.includes(action)) {
    throw new AuditError(400, `Unknown action. Use one of: ${ACTIONS.join(", ")}`);
  }
  if (!req.user?.id) {
    throw new AuditError(401, "Not logged in");
  }

  // Identity always comes from the verified token, never from the request body.
  const user = await User.findById(req.user.id).select("name email role");
  if (!user) {
    throw new AuditError(401, "User no longer exists");
  }

  let safeDetails = details && typeof details === "object" ? details : {};
  if (JSON.stringify(safeDetails).length > MAX_DETAILS_BYTES) {
    safeDetails = { truncated: true };
  }

  return AuditLog.create({
    user: user._id,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    action,
    cameraId: clip(cameraId, 100),
    query: clip(query, 300),
    reason: clip(reason, 500),
    summary: clip(summary, 500),
    details: safeDetails,
    ip: req.ip || "",
    userAgent: clip(req.headers?.["user-agent"], 300),
  });
}

/** Same as recordAudit, but never throws: for use inside routes whose main job must not fail. */
async function recordAuditSafe(req, entry) {
  try {
    return await recordAudit(req, entry);
  } catch (err) {
    console.error("[audit] could not record:", err.message);
    return null;
  }
}

module.exports = { recordAudit, recordAuditSafe, AuditError };