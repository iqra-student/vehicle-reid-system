import React, { useState, useEffect } from "react";/* =========================
   Icons
========================= */

const UploadIcon = () => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M5 20h14" />
  </svg>
);

const PulseIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 12 7 12 10 4 14 20 17 12 21 12" />
  </svg>
);

/* =========================
   Helper Components
========================= */

const UploadTile = ({ file, preview, onChange, label }) => {
  return (
    <label
      style={{
        display: "block",
        cursor: "pointer",
        border: preview ? "1px solid #0b152d" : "1px dashed #cbd5e1",
        borderRadius: "12px",
        minHeight: "220px",
        overflow: "hidden",
        background: "#f8fafc",
        transition: "border-color 0.2s ease",
      }}
    >
      <input
        type="file"
        accept="image/*"
        onChange={onChange}
        style={{ display: "none" }}
      />

      {preview ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "220px",
          }}
        >
          <img
            src={preview}
            alt={file?.name || label}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              background: "#f1f5f9",
            }}
          />

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "10px 12px",
              background: "rgba(255, 255, 255, 0.92)",
              borderTop: "1px solid #e2e8f0",
              color: "#1e293b",
              fontSize: "12px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {file?.name}
          </div>
        </div>
      ) : (
        <div
          style={{
            height: "220px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            color: "#94a3b8",
          }}
        >
          <UploadIcon />

          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#334155",
            }}
          >
            {label}
          </span>

          <span
            style={{
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            Click to upload image
          </span>
        </div>
      )}
    </label>
  );
};

const TierBadge = ({ confidence, threshold }) => {
  const value = Number(confidence) || 0;
  const thresholdFraction = (Number(threshold) || 0) / 100;

  let label = "Unlikely";
  let background = "#fee2e2";
  let color = "#dc2626";

  if (value >= 0.9) {
    label = "HIGH";
    background = "rgba(34, 197, 94, 0.12)";
    color = "#16a34a";
  } else if (value >= 0.7) {
    label = "LIKELY";
    background = "rgba(59, 130, 246, 0.12)";
    color = "#2563eb";
  } else if (value >= thresholdFraction) {
    label = "POSSIBLE";
    background = "rgba(234, 179, 8, 0.15)";
    color = "#b45309";
  }
  // anything below thresholdFraction stays "Unlikely"

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 8px",
        borderRadius: "999px",
        background,
        color,
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.05em",
      }}
    >
      {label}
    </span>
  );
};

const SectionTitle = ({ icon, children }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "10px",
      marginBottom: "16px",
    }}
  >
    {icon && <span style={{ color: "#030f29", display: "flex" }}>{icon}</span>}
    {!icon && (
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "999px",
          background: "#101a2f",
        }}
      />
    )}
    <h2
      style={{
        margin: 0,
        fontSize: "15px",
        fontWeight: 700,
        color: "#0f172a",
      }}
    >
      {children}
    </h2>
  </div>
);

/* =========================
   Filename Parser
========================= */
const API_BASE = "https://womanly-catrigged-ola.ngrok-free.dev"; // replace with your actual ngrok URL
const parseVehicleFilename = (filename = "") => {
  const match = filename.match(/^(\d+)_c(\d+)_(\d+)_\d+\.jpg$/i);

  if (!match) {
    return {
      vehicleId: null,
      camera: null,
      frame: null,
    };
  }

  return {
    vehicleId: match[1],
    camera: Number(match[2]),
    frame: match[3],
  };
};

/* =========================
   Main Component
========================= */

const VehicleReIDEngine = () => {
  const [queryFile, setQueryFile] = useState(null);
  const [queryPreview, setQueryPreview] = useState(null);

  const [matchLoading, setMatchLoading] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [matchElapsed, setMatchElapsed] = useState(null);

   const [camSort, setCamSort] = useState("score");
  const [threshold, setThreshold] = useState(40); // percentage, 0-100, user-controlled
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/model-info`, {
      headers: { "ngrok-skip-browser-warning": "true" },
    })
      .then((res) => res.json())
      .then((info) => setModelInfo(info))
      .catch((err) => console.error("Could not fetch model info:", err));
  }, []);

  const handleQueryFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    setQueryFile(file);
    setMatchResult(null);

    const previewUrl = URL.createObjectURL(file);
    setQueryPreview(previewUrl);
  };

  const handleFindMatch = async () => {
    if (!queryFile) {
      alert("Please upload a query image first.");
      return;
    }

    setMatchLoading(true);
    setMatchResult(null);
    setMatchElapsed(null);

    const startTime = performance.now();

    try {
      const formData = new FormData();
      formData.append("file", queryFile);

      const response = await fetch(`${API_BASE}/find-match`, {
        method: "POST",
        headers: { "ngrok-skip-browser-warning": "true" },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          typeof data.detail === "string"
            ? data.detail
            : data.message || "Find Match request failed.";

        throw new Error(errorMessage);
      }
      // ----------------------------------------------------
      // SEND SUCCESSFUL KAGGLE RESULT TO LOCAL DASHBOARD
      // ----------------------------------------------------

      try {
        const dashboardResponse = await fetch(
          "http://127.0.0.1:8000/dashboard-log",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              query_filename: queryFile.name,
              query_camera: data.query_camera,
              matches: data.matches || [],
            }),
          }
        );

        if (!dashboardResponse.ok) {
          console.error(
            "Dashboard logging failed:",
            await dashboardResponse.text()
          );
        } else {
          console.log("Dashboard log updated successfully.");
        }
      } catch (dashboardError) {
        console.error("Could not update local dashboard:", dashboardError);
      }

      const elapsed =
        data.elapsed_seconds ?? (performance.now() - startTime) / 1000;
      setMatchElapsed(elapsed);

      const matches = Array.isArray(data.matches) ? data.matches : [];

      const matchesWithImages = await Promise.all(
        matches.map(async (match) => {
          const imageUrl = `${API_BASE}/gallery/${encodeURIComponent(match.matched_filename)}`;
          let blobUrl = null;

          try {
            const imgRes = await fetch(imageUrl, {
              headers: { "ngrok-skip-browser-warning": "true" },
            });
            const blob = await imgRes.blob();
            blobUrl = URL.createObjectURL(blob);
          } catch (err) {
            console.error("Image fetch failed:", err);
          }

          return {
            camera: match.camera,
            matchedFilename: match.matched_filename,
            confidence: Number(match.confidence) || 0,
            confidencePercentage:
              match.confidencePercentage ??
              `${((Number(match.confidence) || 0) * 100).toFixed(1)}%`,
            matchedImageUrl: blobUrl,
          };
        })
      );

      setMatchResult({
        queryFilename: queryFile.name,
        queryCamera: data.query_camera,
        matches: matchesWithImages,
      });
    } catch (error) {
      console.error("Find Match error:", error);
      alert(error.message || "Unable to find a matching vehicle.");
    } finally {
      setMatchLoading(false);
    }
  };

  const clearResults = () => {
    setQueryFile(null);
    setQueryPreview(null);
    setMatchResult(null);
    setCamSort("score");
  };

  const sortedMatches = matchResult?.matches
    ? [...matchResult.matches].sort((a, b) => {
        if (camSort === "camera") {
          return Number(a.camera) - Number(b.camera);
        }

        return Number(b.confidence) - Number(a.confidence);
      })
    : [];

  // Vehicle path: query + every match at/above the confidence threshold,
  // ordered by frame number (VeRi-776 cameras are synchronized, so frame
  // number alone gives correct cross-camera chronological order).
  const thresholdFraction = (Number(threshold) || 0) / 100;

  const vehiclePath = matchResult
    ? [
        matchResult.queryFilename
          ? { ...parseVehicleFilename(matchResult.queryFilename), isQuery: true }
          : null,
        ...matchResult.matches
          .filter((match) => (Number(match.confidence) || 0) >= thresholdFraction)
          .map((match) => ({
            ...parseVehicleFilename(match.matchedFilename),
            isQuery: false,
          })),
      ]
        .filter((point) => point && point.camera !== null && point.frame !== null)
        .map((point) => ({ ...point, frame: Number(point.frame) }))
        .sort((a, b) => a.frame - b.frame)
    : [];

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        background: "#ffffff",
        color: "#1e293b",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* Upload Section */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderTop: "3px solid #0b152d",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "24px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
        }}
      >
        <SectionTitle icon={<PulseIcon />}>Query Vehicle</SectionTitle>

        {modelInfo && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "3px 10px",
              marginBottom: "14px",
              borderRadius: "999px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              color: "#1d4ed8",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            Classifier: {modelInfo.pair_classifier_file}
          </div>
        )}

        <UploadTile
          file={queryFile}
          preview={queryPreview}
          onChange={handleQueryFileChange}
          label="Upload vehicle image"
        />

        <button
          type="button"
          onClick={handleFindMatch}
          disabled={!queryFile || matchLoading}
          style={{
            width: "100%",
            marginTop: "18px",
            padding: "12px 16px",
            border: "none",
            borderRadius: "9px",
            background: !queryFile || matchLoading ? "#e2e8f0" : "#0b152d",
            color: !queryFile || matchLoading ? "#94a3b8" : "#ffffff",
            cursor: !queryFile || matchLoading ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          {matchLoading ? "FINDING MATCH..." : "FIND MATCH"}
        </button>
        {matchElapsed !== null && (
          <div
            style={{
              marginTop: "6px",
              fontSize: "11px",
              color: "#94a3b8",
              textAlign: "right",
            }}
          >
            Matched in {matchElapsed.toFixed(2)}s
          </div>
        )}
      </div>

      {/* Results */}
      {matchResult && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderTop: "3px solid #0b152d",
            borderRadius: "14px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              marginBottom: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <SectionTitle>Matching Results</SectionTitle>
              <p
                style={{
                  margin: "-10px 0 0 18px",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                Best gallery match from each available camera.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <select
                value={camSort}
                onChange={(event) => setCamSort(event.target.value)}
                style={{
                  background: "#ffffff",
                  color: "#0d193a",
                  border: "1px solid #bfdbfe",
                  borderRadius: "7px",
                  padding: "8px 10px",
                  fontSize: "12px",
                  fontWeight: 600,
                  outline: "none",
                }}
              >
                <option value="score">Sort by confidence</option>
                <option value="camera">Sort by camera</option>
              </select>

              <button
                type="button"
                onClick={clearResults}
                style={{
                  border: "1px solid #bfdbfe",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  borderRadius: "8px",
                  padding: "9px 14px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                Reset
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Min confidence:
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                />
                <span
                  style={{ fontSize: "12px", fontWeight: 700, color: "#0b152d" }}
                >
                  {threshold}%
                </span>
              </div>
            </div>
          </div>

          {/* Query Information */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 260px) 1fr",
              gap: "20px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                border: "1px solid #bfdbfe",
                borderRadius: "10px",
                overflow: "hidden",
                background: "#f8fafc",
              }}
            >
              {queryPreview ? (
                <img
                  src={queryPreview}
                  alt="Query vehicle"
                  style={{
                    width: "100%",
                    height: "180px",
                    objectFit: "contain",
                  }}
                />
              ) : (
                <div
                  style={{
                    height: "180px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#94a3b8",
                    fontSize: "12px",
                  }}
                >
                  No query image
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  color: "#0b152d",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Query
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#1e293b",
                  fontWeight: 600,
                  wordBreak: "break-word",
                }}
              >
                {matchResult.queryFilename}
              </div>

              {matchResult.queryCamera !== undefined &&
                matchResult.queryCamera !== null && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                    }}
                  >
                    Camera {matchResult.queryCamera}
                  </div>
                )}
            </div>
          </div>

          {/* Vehicle Path */}
          {vehiclePath.length > 1 && (
            <div style={{ marginBottom: "24px" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "#0b152d",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: "10px",
                }}
              >
                Vehicle Path
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "6px",
                  padding: "14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  background: "#f8fafc",
                }}
              >
                {vehiclePath.map((point, index) => (
                  <React.Fragment key={`${point.camera}-${point.frame}-${index}`}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "12px",
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: "999px",
                          color: point.isQuery ? "#ffffff" : "#1d4ed8",
                          background: point.isQuery ? "#0b152d" : "#eff6ff",
                          border: point.isQuery
                            ? "1px solid #0b152d"
                            : "1px solid #bfdbfe",
                        }}
                      >
                        Camera {point.camera}
                      </span>
                      <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                        {point.isQuery ? "Query" : `Frame ${point.frame}`}
                      </span>
                    </div>

                    {index < vehiclePath.length - 1 && (
                      <span
                        style={{ color: "#cbd5e1", fontSize: "16px", padding: "0 2px" }}
                      >
                        →
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Match Cards */}
          {sortedMatches.length === 0 ? (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                border: "1px dashed #cbd5e1",
                borderRadius: "10px",
                color: "#64748b",
                fontSize: "13px",
              }}
            >
              No matching vehicles were found.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              {sortedMatches.map((match, index) => {
                const confidence = Number(match.confidence) || 0;

                return (
                  <div
                    key={`${match.camera}-${match.matchedFilename}-${index}`}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        height: "190px",
                        background: "#f8fafc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={match.matchedImageUrl}
                        alt={match.matchedFilename || `Camera ${match.camera} match`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    </div>

                    <div style={{ padding: "14px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "8px",
                          marginBottom: "10px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: 700,
                            color: "#1d4ed8",
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            padding: "3px 8px",
                            borderRadius: "999px",
                          }}
                        >
                          Camera {match.camera}
                        </span>

                        <TierBadge confidence={confidence} threshold={threshold} />
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: "#64748b",
                          marginBottom: "10px",
                          wordBreak: "break-word",
                          lineHeight: 1.5,
                        }}
                      >
                        {match.matchedFilename}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          paddingTop: "10px",
                          borderTop: "1px solid #e2e8f0",
                        }}
                      >
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          Confidence
                        </span>

                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "#0b152d",
                          }}
                        >
                          {match.confidencePercentage}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VehicleReIDEngine;