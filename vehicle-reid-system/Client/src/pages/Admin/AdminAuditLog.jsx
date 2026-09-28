import { Fragment, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ShieldCheck, Download, RotateCcw, Search, ChevronDown, ChevronRight,
  Users, Clock, AlertTriangle, FileText, X,
} from "lucide-react";
import { authHeaders, ACTION_LABELS, REASON_EXPECTED } from "../../api/audit";

const BACKEND_URL = "http://localhost:5000";

// ─── Sapphire Veil palette (same as AdminDashboard) ───────────
const MIST = "#E7F0FA";
const STEEL = "#7BA4D0";
const SAPPHIRE = "#2E5E99";
const INK = "#0D2440";
const CORAL = "#B25C50";
const AMBER = "#B27528";

const CARD = {
  backgroundColor: "#FFFFFF",
  border: "1px solid rgba(13,36,64,0.06)",
  boxShadow: "0 10px 28px rgba(13,36,64,0.06)",
};

const ACTION_STYLES = {
  REID_SEARCH: { bg: MIST, fg: SAPPHIRE },
  CONGESTION_ANALYSIS: { bg: "#FDF2F2", fg: CORAL },
  PLATE_DETECT: { bg: "#EDF5F0", fg: "#3F7654" },
  PLATE_TRACK: { bg: "#EDF5F0", fg: "#3F7654" },
  PLATE_SEARCH: { bg: INK, fg: MIST },
  ALERT_RESOLVE: { bg: "#FDF2F2", fg: CORAL },
  CAMERA_REGISTER: { bg: "#FEF6EC", fg: AMBER },
  LIVE_FEED_VIEW: { bg: "#F1F4F8", fg: "#4B617D" },
  OTHER: { bg: "#F1F4F8", fg: "#4B617D" },
};

const EMPTY_FILTERS = { user: "", action: "", camera: "", from: "", to: "", q: "" };

function timeAgo(date) {
  if (!date) return "Never";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const fmtDateTime = (d) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

function ActionBadge({ action }) {
  const st = ACTION_STYLES[action] || ACTION_STYLES.OTHER;
  return (
    <span
      className="inline-block whitespace-nowrap text-[10.5px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-md"
      style={{ backgroundColor: st.bg, color: st.fg }}
    >
      {ACTION_LABELS[action] || action}
    </span>
  );
}

export default function AdminAuditLog() {
  const [operators, setOperators] = useState([]);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS); // text inputs apply after a short pause
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  // Debounce filter changes so typing doesn't fire a request per key
  useEffect(() => {
    if (JSON.stringify(applied) === JSON.stringify(filters)) return;
    const id = setTimeout(() => {
      setApplied(filters);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [filters, applied]);

  const params = useMemo(() => {
    const p = {};
    Object.entries(applied).forEach(([k, v]) => v && (p[k] = v));
    return p;
  }, [applied]);

  const handleError = (err) => {
    const status = err?.response?.status;
    if (status === 401) setError("Your session has expired. Please sign in again.");
    else if (status === 403) setError("This page is only available to admin accounts.");
    else setError(err?.response?.data?.message || "Could not load the audit log. Is the server running?");
  };

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/audit/summary`, { headers: authHeaders() });
      setOperators(res.data.operators || []);
    } catch (err) {
      handleError(err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/audit`, {
        headers: authHeaders(),
        params: { ...params, page, limit: 25 },
      });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
      setError("");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, page]);

  const refresh = () => {
    fetchSummary();
    fetchLogs();
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await axios.get(`${BACKEND_URL}/api/audit/export`, {
        headers: authHeaders(),
        params,
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      handleError(err);
    } finally {
      setExporting(false);
    }
  };

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const hasFilters = Object.values(filters).some(Boolean);
  const selectedOperator = operators.find((o) => String(o.userId) === filters.user);

  const inputStyle = { border: "1px solid #E4EAF2", backgroundColor: "#FAFCFE", color: INK };

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: MIST }}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ─── HEADER ─── */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: SAPPHIRE }}>
                Administration
              </span>
              <span
                className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: INK, color: MIST }}
              >
                <ShieldCheck className="w-3 h-3" />
                Append-only
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ color: INK }}>
              Audit Log
            </h1>
            <p className="text-sm mt-1.5 max-w-2xl" style={{ color: SAPPHIRE }}>
              Every search and analysis run by operators, with who ran it, when, why, and what it returned.
              Entries cannot be edited or deleted.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-60"
              style={{ backgroundColor: "#FFFFFF", color: INK, border: "1px solid #D4E2F0" }}
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-xl text-white transition-all hover:shadow-lg"
              style={{ backgroundColor: INK }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
            style={{ backgroundColor: "#FDF2F2", color: CORAL, border: "1px solid #F5D9D6" }}
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ─── OPERATOR SUMMARY ─── */}
        <section className="rounded-2xl overflow-hidden" style={CARD}>
          <div className="px-6 py-5 border-b flex items-center gap-3" style={{ borderColor: "rgba(13,36,64,0.06)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: MIST, color: SAPPHIRE }}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: INK }}>Operator Overview</div>
              <div className="text-xs mt-0.5" style={{ color: STEEL }}>
                Click an operator to see only their activity. Flags point to entries worth reviewing.
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ backgroundColor: "#F8FAFD", borderBottom: "1px solid rgba(13,36,64,0.06)" }}>
                  {["Operator", "Re-ID", "Plate searches", "Plate reads", "Congestion", "Cameras", "Total", "Flags", "Last active"].map((h, i) => (
                    <th
                      key={h}
                      className={`font-mono text-[10px] tracking-wider uppercase font-bold px-5 py-3.5 ${i >= 1 && i <= 6 ? "text-center" : ""}`}
                      style={{ color: STEEL }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs">
                {operators.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10" style={{ color: STEEL }}>
                      No operators registered yet.
                    </td>
                  </tr>
                ) : (
                  operators.map((o) => {
                    const a = o.actions || {};
                    const selected = filters.user === String(o.userId);
                    return (
                      <tr
                        key={o.userId}
                        onClick={() => setFilter("user", selected ? "" : String(o.userId))}
                        className="cursor-pointer transition-colors hover:bg-[#F8FAFD]"
                        style={{
                          borderBottom: "1px solid #EEF2F8",
                          backgroundColor: selected ? "#EEF4FB" : undefined,
                          boxShadow: selected ? `inset 3px 0 0 ${SAPPHIRE}` : undefined,
                        }}
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-[12.5px]" style={{ color: INK }}>
                            {o.name}
                            {o.role === "admin" && (
                              <span className="ml-1.5 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: INK, color: MIST }}>
                                admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px]" style={{ color: STEEL }}>{o.email}</div>
                        </td>
                        {[
                          a.REID_SEARCH || 0,
                          a.PLATE_SEARCH || 0,
                          (a.PLATE_DETECT || 0) + (a.PLATE_TRACK || 0),
                          (a.CONGESTION_ANALYSIS || 0) + (a.ALERT_RESOLVE || 0),
                          a.CAMERA_REGISTER || 0,
                        ].map((n, i) => (
                          <td key={i} className="px-5 py-3.5 text-center font-semibold" style={{ color: n ? INK : "#C3CFDE" }}>
                            {n}
                          </td>
                        ))}
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center min-w-8 h-7 px-2 rounded-lg font-bold" style={{ backgroundColor: MIST, color: INK }}>
                            {o.total}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {o.afterHours > 0 && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#FEF6EC", color: AMBER }}>
                                {o.afterHours} after hours
                              </span>
                            )}
                            {o.noReason > 0 && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#FDF2F2", color: CORAL }}>
                                {o.noReason} without reason
                              </span>
                            )}
                            {!o.afterHours && !o.noReason && <span style={{ color: "#C3CFDE" }}>—</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap" style={{ color: SAPPHIRE }}>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {timeAgo(o.lastActive)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── FILTERS ─── */}
        <section className="rounded-2xl p-5" style={CARD}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: STEEL }} />
              <input
                value={filters.q}
                onChange={(e) => setFilter("q", e.target.value)}
                placeholder="Search plate, reason, result, operator…"
                className="w-full rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>
            <select
              value={filters.user}
              onChange={(e) => setFilter("user", e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={inputStyle}
            >
              <option value="">All operators</option>
              {operators.map((o) => (
                <option key={o.userId} value={String(o.userId)}>{o.name}</option>
              ))}
            </select>
            <select
              value={filters.action}
              onChange={(e) => setFilter("action", e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={inputStyle}
            >
              <option value="">All actions</option>
              {Object.entries(ACTION_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilter("from", e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={inputStyle}
              title="From date"
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilter("to", e.target.value)}
              className="rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={inputStyle}
              title="To date"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
            <input
              value={filters.camera}
              onChange={(e) => setFilter("camera", e.target.value)}
              placeholder="Camera ID"
              className="rounded-lg px-3 py-2 text-sm focus:outline-none w-44"
              style={inputStyle}
            />
            <div className="flex items-center gap-3 text-xs" style={{ color: STEEL }}>
              {selectedOperator && (
                <span>
                  Showing <b style={{ color: INK }}>{selectedOperator.name}</b>
                </span>
              )}
              <span>{total} entr{total === 1 ? "y" : "ies"}</span>
              {hasFilters && (
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="inline-flex items-center gap-1 font-semibold"
                  style={{ color: SAPPHIRE }}
                >
                  <X className="w-3.5 h-3.5" /> Clear filters
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ─── LOG TABLE ─── */}
        <section className="rounded-2xl overflow-hidden" style={CARD}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ backgroundColor: "#F8FAFD", borderBottom: "1px solid rgba(13,36,64,0.06)" }}>
                  {["", "Time", "Operator", "Action", "Camera", "Query", "Reason", "Result"].map((h, i) => (
                    <th key={i} className="font-mono text-[10px] tracking-wider uppercase font-bold px-4 py-3.5" style={{ color: STEEL }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-xs" style={{ color: SAPPHIRE }}>
                {loading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12" style={{ color: STEEL }}>Loading…</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12" style={{ color: STEEL }}>
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-7 h-7 opacity-40" />
                        {hasFilters ? "No entries match these filters." : "No operator activity recorded yet."}
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((l) => {
                    const open = expanded === l._id;
                    const isSearch = REASON_EXPECTED.includes(l.action);
                    return (
                      <Fragment key={l._id}>
                        <tr
                          onClick={() => setExpanded(open ? null : l._id)}
                          className="cursor-pointer transition-colors hover:bg-[#F8FAFD]"
                          style={{ borderBottom: open ? "none" : "1px solid #EEF2F8" }}
                        >
                          <td className="pl-4 py-3.5" style={{ color: STEEL }}>
                            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </td>
                          <td className="px-4 py-3.5 font-mono whitespace-nowrap" style={{ color: INK }}>{fmtDateTime(l.createdAt)}</td>
                          <td className="px-4 py-3.5">
                            <div className="font-semibold" style={{ color: INK }}>{l.userName}</div>
                            <div className="text-[10.5px]" style={{ color: STEEL }}>{l.userEmail}</div>
                          </td>
                          <td className="px-4 py-3.5"><ActionBadge action={l.action} /></td>
                          <td className="px-4 py-3.5 font-mono">{l.cameraId || "—"}</td>
                          <td className="px-4 py-3.5 font-mono max-w-[160px] truncate" style={{ color: INK }} title={l.query}>
                            {l.query || "—"}
                          </td>
                          <td className="px-4 py-3.5 max-w-[180px] truncate" title={l.reason}>
                            {l.reason ? (
                              <span style={{ color: INK }}>{l.reason}</span>
                            ) : isSearch ? (
                              <span className="font-semibold" style={{ color: CORAL }}>Not given</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3.5 max-w-[260px] truncate font-medium" style={{ color: INK }} title={l.summary}>
                            {l.summary || "—"}
                          </td>
                        </tr>
                        {open && (
                          <tr style={{ borderBottom: "1px solid #EEF2F8", backgroundColor: "#F8FAFD" }}>
                            <td />
                            <td colSpan={7} className="px-4 pb-5 pt-1">
                              <div className="grid md:grid-cols-[260px_1fr] gap-4">
                                <dl className="space-y-2 text-[11.5px]">
                                  {[
                                    ["Timestamp", new Date(l.createdAt).toLocaleString()],
                                    ["Role", l.role],
                                    ["Query", l.query || "—"],
                                    ["Reason", l.reason || "—"],
                                    ["IP address", l.ip || "—"],
                                  ].map(([k, v]) => (
                                    <div key={k}>
                                      <dt className="text-[10px] uppercase font-bold tracking-wider" style={{ color: STEEL }}>{k}</dt>
                                      <dd className="break-words" style={{ color: INK }}>{v}</dd>
                                    </div>
                                  ))}
                                </dl>
                                <div>
                                  <div className="text-[10px] uppercase font-bold tracking-wider mb-1" style={{ color: STEEL }}>Result</div>
                                  <div className="text-[12px] mb-2" style={{ color: INK }}>{l.summary || "—"}</div>
                                  {l.details && Object.keys(l.details).length > 0 && (
                                    <pre
                                      className="text-[11px] font-mono rounded-lg p-3 overflow-auto max-h-64"
                                      style={{ backgroundColor: "#FFFFFF", border: "1px solid #E4EAF2", color: INK }}
                                    >
                                      {JSON.stringify(l.details, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t text-xs" style={{ borderColor: "#EEF2F8", color: STEEL }}>
              <span>Page {page} of {pages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40"
                  style={{ border: "1px solid #D4E2F0", color: INK }}
                >
                  Previous
                </button>
                <button
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40"
                  style={{ border: "1px solid #D4E2F0", color: INK }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}