const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const AuditLog = require("../models/AuditLog");
const { ACTIONS } = require("../models/AuditLog");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/requireAdmin");
const { recordAudit, AuditError } = require("../utils/audit");

// Hours counted as "after hours" for the misuse indicator (local time).
const TIMEZONE = process.env.AUDIT_TIMEZONE || "Asia/Karachi";
const AFTER_HOURS_START = 22; // 10 pm
const AFTER_HOURS_END = 6;    // 6 am

// Lookups of one specific vehicle: the operator is expected to give a reason / case number.
const SEARCH_ACTIONS = ["REID_SEARCH", "PLATE_SEARCH"];

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ------------------------------------------------------------------
// POST /api/audit  — any logged-in user records one of their own actions
// ------------------------------------------------------------------
router.post("/", authMiddleware, async (req, res) => {
  try {
    const log = await recordAudit(req, req.body || {});
    res.status(201).json({ status: "success", id: log._id });
  } catch (err) {
    if (err instanceof AuditError) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Audit log write error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ------------------------------------------------------------------
// Shared filter builder for list + export
//   ?user=<id>&action=REID_SEARCH&camera=CAM_01&from=2026-09-01&to=2026-09-30&q=text
// ------------------------------------------------------------------
function buildFilter(q) {
  const filter = {};

  if (q.user && mongoose.isValidObjectId(q.user)) filter.user = q.user;
  if (q.action && ACTIONS.includes(q.action)) filter.action = q.action;
  if (q.camera) filter.cameraId = new RegExp(escapeRegex(String(q.camera).trim()), "i");

  if (q.from || q.to) {
    filter.createdAt = {};
    if (q.from) {
      const d = new Date(q.from);
      if (!isNaN(d)) filter.createdAt.$gte = d;
    }
    if (q.to) {
      const d = new Date(q.to);
      if (!isNaN(d)) {
        // Date-only values ("2026-09-28") should include that whole day
        if (/^\d{4}-\d{2}-\d{2}$/.test(String(q.to))) d.setDate(d.getDate() + 1);
        filter.createdAt.$lt = d;
      }
    }
    if (Object.keys(filter.createdAt).length === 0) delete filter.createdAt;
  }

  if (q.q) {
    const rx = new RegExp(escapeRegex(String(q.q).trim()), "i");
    filter.$or = [{ summary: rx }, { query: rx }, { reason: rx }, { userName: rx }, { userEmail: rx }];
  }

  return filter;
}

// ------------------------------------------------------------------
// GET /api/audit  — admin: paginated, filtered log
// ------------------------------------------------------------------
router.get("/", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = buildFilter(req.query);

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ status: "success", logs, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    console.error("Audit log read error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/audit/summary  — admin: one row per operator
// ------------------------------------------------------------------
router.get("/summary", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const hourExpr = { $hour: { date: "$createdAt", timezone: TIMEZONE } };

    const rows = await AuditLog.aggregate([
      {
        $group: {
          _id: { user: "$user", action: "$action" },
          count: { $sum: 1 },
          last: { $max: "$createdAt" },
          afterHours: {
            $sum: {
              $cond: [
                { $or: [{ $gte: [hourExpr, AFTER_HOURS_START] }, { $lt: [hourExpr, AFTER_HOURS_END] }] },
                1,
                0,
              ],
            },
          },
          noReason: {
            $sum: {
              $cond: [
                { $and: [{ $in: ["$action", SEARCH_ACTIONS] }, { $eq: ["$reason", ""] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $group: {
          _id: "$_id.user",
          actions: { $push: { k: "$_id.action", v: "$count" } },
          total: { $sum: "$count" },
          lastActive: { $max: "$last" },
          afterHours: { $sum: "$afterHours" },
          noReason: { $sum: "$noReason" },
        },
      },
      { $project: { actions: { $arrayToObject: "$actions" }, total: 1, lastActive: 1, afterHours: 1, noReason: 1 } },
    ]);

    const byUser = new Map(rows.map((r) => [String(r._id), r]));

    // Every operator appears, even with zero activity; admins appear only if they logged actions.
    const users = await User.find({
      $or: [{ role: "operator" }, { _id: { $in: rows.map((r) => r._id) } }],
    })
      .select("name email role createdAt")
      .lean();

    const operators = users
      .map((u) => {
        const r = byUser.get(String(u._id));
        return {
          userId: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          actions: r?.actions || {},
          total: r?.total || 0,
          afterHours: r?.afterHours || 0,
          noReason: r?.noReason || 0,
          lastActive: r?.lastActive || null,
        };
      })
      .sort((a, b) => new Date(b.lastActive || 0) - new Date(a.lastActive || 0));

    res.json({ status: "success", operators, actions: ACTIONS });
  } catch (err) {
    console.error("Audit summary error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ------------------------------------------------------------------
// GET /api/audit/export  — admin: CSV of the filtered log (max 5000 rows)
// ------------------------------------------------------------------
router.get("/export", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const logs = await AuditLog.find(buildFilter(req.query)).sort({ createdAt: -1 }).limit(5000).lean();

    const csvCell = (v) => {
      let s = v == null ? "" : String(v);
      // Stop spreadsheet formula injection (=, +, -, @ at the start of a cell)
      if (/^[=+\-@]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = ["Timestamp", "Operator", "Email", "Role", "Action", "Camera", "Query", "Reason", "Result", "IP"];
    const lines = [header.map(csvCell).join(",")];
    for (const l of logs) {
      lines.push(
        [
          new Date(l.createdAt).toISOString(),
          l.userName, l.userEmail, l.role, l.action, l.cameraId, l.query, l.reason, l.summary, l.ip,
        ].map(csvCell).join(",")
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="audit-log-${stamp}.csv"`);
    res.send("﻿" + lines.join("\r\n")); // BOM so Excel reads UTF-8 correctly
  } catch (err) {
    console.error("Audit export error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;