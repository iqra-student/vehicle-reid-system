// Small "Reason / case no." field used before vehicle lookups.
// The value is saved with the audit log entry, so admins can see why a search was run.
// Uses inline styles so it fits both the Tailwind pages and the inline-styled ones.

export default function AuditReasonInput({ value, onChange, id = "audit-reason" }) {
  return (
    <div style={{ width: "100%" }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 700,
          color: "#4A6382",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "6px",
        }}
      >
        Reason / case no.{" "}
        <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "#8CA3BF" }}>
          (recorded in the audit log)
        </span>
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={500}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Case #2231, stolen vehicle report"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 14px",
          background: "#F3F6FB",
          border: "1px solid #DCE6F2",
          borderRadius: "10px",
          fontSize: "13px",
          color: "#0D2440",
          outline: "none",
        }}
        onFocus={(e) => {
          e.target.style.background = "#FFFFFF";
          e.target.style.borderColor = "#2E5E99";
        }}
        onBlur={(e) => {
          e.target.style.background = "#F3F6FB";
          e.target.style.borderColor = "#DCE6F2";
        }}
      />
    </div>
  );
}