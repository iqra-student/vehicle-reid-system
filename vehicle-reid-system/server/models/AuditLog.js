const mongoose = require("mongoose");

// Every operator action that touches vehicle / camera data is recorded here.
// The collection is append-only: the hooks at the bottom refuse updates and
// deletes, so nobody (including a buggy route) can quietly edit history.

const ACTIONS = [
  "REID_SEARCH",          // Vehicle re-identification (/find-match)
  "CONGESTION_ANALYSIS",  // Uploaded video analysed for congestion
  "PLATE_DETECT",         // ANPR on a single image
  "PLATE_TRACK",          // ANPR tracking on a video
  "PLATE_SEARCH",         // Looked up a plate's sighting history
  "CAMERA_REGISTER",      // Operator registered a new camera
  "LIVE_FEED_VIEW",       // Operator opened a live camera feed
  "ALERT_RESOLVE",        // Operator dismissed a congestion alert
  "OTHER",
];

const auditLogSchema = new mongoose.Schema(
  {
    // Who (copied at write time so the log still reads correctly if the
    // user is later renamed or deleted)
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    role: { type: String, enum: ["operator", "admin"], required: true },

    // What
    action: { type: String, enum: ACTIONS, required: true, index: true },
    cameraId: { type: String, default: "" },
    query: { type: String, default: "" },    // e.g. plate text, uploaded file name
    reason: { type: String, default: "" },   // operator-supplied reason / case number
    summary: { type: String, default: "" },  // one-line human-readable result
    details: { type: mongoose.Schema.Types.Mixed, default: {} }, // compact result data

    // Where from
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });

// Append-only: block every update / delete path Mongoose offers.
const BLOCKED = [
  "updateOne", "updateMany", "findOneAndUpdate", "replaceOne",
  "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete",
];
auditLogSchema.pre(BLOCKED, async function () {
  throw new Error("Audit logs are append-only and cannot be modified or deleted");
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
module.exports.ACTIONS = ACTIONS;