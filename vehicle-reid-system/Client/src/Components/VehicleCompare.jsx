import React, { useState } from "react";

/* =========================
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
        border: "1px dashed #475569",
        borderRadius: "12px",
        minHeight: "220px",
        overflow: "hidden",
        background: "#0f172a",
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
              background: "#020617",
            }}
          />

          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "10px 12px",
              background: "rgba(2, 6, 23, 0.9)",
              color: "#e2e8f0",
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
              color: "#cbd5e1",
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

const TierBadge = ({ confidence }) => {
  const value = Number(confidence) || 0;

  let label = "LOW";
  let background = "#334155";
  let color = "#cbd5e1";

  if (value >= 0.85) {
    label = "HIGH";
    background = "rgba(34, 197, 94, 0.15)";
    color = "#4ade80";
  } else if (value >= 0.5) {
    label = "POSSIBLE";
    background = "rgba(234, 179, 8, 0.15)";
    color = "#facc15";
  }

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

/* =========================
   Filename Parser
========================= */

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

  const [camSort, setCamSort] = useState("score");

  /* =========================
     Query Image Handler
  ========================= */

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

  /* =========================
     Find Match
  ========================= */

  const handleFindMatch = async () => {
    if (!queryFile) {
      alert("Please upload a query image first.");
      return;
    }

    setMatchLoading(true);
    setMatchResult(null);

    try {
      const formData = new FormData();
      formData.append("file", queryFile);

      const response = await fetch(
        "http://127.0.0.1:8000/find-match",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          typeof data.detail === "string"
            ? data.detail
            : data.message || "Find Match request failed.";

        throw new Error(errorMessage);
      }

      const matches = Array.isArray(data.matches)
        ? data.matches
        : [];

      setMatchResult({
        queryFilename: queryFile.name,
        queryCamera: data.query_camera,
        matches: matches.map((match) => ({
          camera: match.camera,
          matchedFilename: match.matched_filename,
          confidence: Number(match.confidence) || 0,
          confidencePercentage:
            match.confidencePercentage ??
            `${((Number(match.confidence) || 0) * 100).toFixed(1)}%`,
          matchedImageUrl: `http://127.0.0.1:8000/gallery/${encodeURIComponent(
            match.matched_filename
          )}`,
        })),
      });
    } catch (error) {
      console.error("Find Match error:", error);
      alert(error.message || "Unable to find a matching vehicle.");
    } finally {
      setMatchLoading(false);
    }
  };

  /* =========================
     Reset
  ========================= */

  const clearResults = () => {
    setQueryFile(null);
    setQueryPreview(null);
    setMatchResult(null);
    setCamSort("score");
  };

  /* =========================
     Sorted Matches
  ========================= */

  const sortedMatches = matchResult?.matches
    ? [...matchResult.matches].sort((a, b) => {
        if (camSort === "camera") {
          return Number(a.camera) - Number(b.camera);
        }

        return Number(b.confidence) - Number(a.confidence);
      })
    : [];

  /* =========================
     UI
  ========================= */

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100%",
        background: "#020617",
        color: "#e2e8f0",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 700,
              color: "#f8fafc",
            }}
          >
            Vehicle Re-ID
          </h1>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            Find matching vehicles across the gallery using CLIP-ReID.
          </p>
        </div>

        {matchResult && (
          <button
            type="button"
            onClick={clearResults}
            style={{
              border: "1px solid #334155",
              background: "#0f172a",
              color: "#cbd5e1",
              borderRadius: "8px",
              padding: "9px 14px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            Reset
          </button>
        )}
      </div>

      {/* Upload Section */}

      <div
        style={{
          background: "#0b1120",
          border: "1px solid #1e293b",
          borderRadius: "14px",
          padding: "20px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "16px",
          }}
        >
          <PulseIcon />

          <h2
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              color: "#f1f5f9",
            }}
          >
            Query Vehicle
          </h2>
        </div>

        <UploadTile
          file={queryFile}
          preview={queryPreview}
          onChange={handleQueryFileChange}
          label="Upload vehicle image"
        />

        {queryFile && (
          <div
            style={{
              marginTop: "12px",
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            {queryFile.name}
          </div>
        )}

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
            background:
              !queryFile || matchLoading
                ? "#1e293b"
                : "#2563eb",
            color:
              !queryFile || matchLoading
                ? "#64748b"
                : "#ffffff",
            cursor:
              !queryFile || matchLoading
                ? "not-allowed"
                : "pointer",
            fontSize: "13px",
            fontWeight: 700,
          }}
        >
          {matchLoading ? "FINDING MATCH..." : "FIND MATCH"}
        </button>
      </div>

      {/* Results */}

      {matchResult && (
        <div
          style={{
            background: "#0b1120",
            border: "1px solid #1e293b",
            borderRadius: "14px",
            padding: "20px",
          }}
        >
          {/* Results Header */}

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
              <h2
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#f1f5f9",
                }}
              >
                Matching Results
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: "12px",
                  color: "#64748b",
                }}
              >
                Best gallery match from each available camera.
              </p>
            </div>

            <select
              value={camSort}
              onChange={(event) => setCamSort(event.target.value)}
              style={{
                background: "#0f172a",
                color: "#cbd5e1",
                border: "1px solid #334155",
                borderRadius: "7px",
                padding: "8px 10px",
                fontSize: "12px",
                outline: "none",
              }}
            >
              <option value="score">Sort by confidence</option>
              <option value="camera">Sort by camera</option>
            </select>
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
                border: "1px solid #1e293b",
                borderRadius: "10px",
                overflow: "hidden",
                background: "#020617",
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
                    color: "#475569",
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
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Query
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#e2e8f0",
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
                      color: "#94a3b8",
                    }}
                  >
                    Camera {matchResult.queryCamera}
                  </div>
                )}
            </div>
          </div>

          {/* Match Cards */}

          {sortedMatches.length === 0 ? (
            <div
              style={{
                padding: "30px",
                textAlign: "center",
                border: "1px dashed #334155",
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
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "16px",
              }}
            >
              {sortedMatches.map((match, index) => {
                const confidence = Number(match.confidence) || 0;

                return (
                  <div
                    key={`${match.camera}-${match.matchedFilename}-${index}`}
                    style={{
                      border: "1px solid #1e293b",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "#020617",
                    }}
                  >
                    {/* Image */}

                    <div
                      style={{
                        height: "190px",
                        background: "#020617",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={match.matchedImageUrl}
                        alt={
                          match.matchedFilename ||
                          `Camera ${match.camera} match`
                        }
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

                    {/* Details */}

                    <div
                      style={{
                        padding: "14px",
                      }}
                    >
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
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#f1f5f9",
                          }}
                        >
                          Camera {match.camera}
                        </span>

                        <TierBadge confidence={confidence} />
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: "#94a3b8",
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
                          borderTop: "1px solid #1e293b",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "11px",
                            color: "#64748b",
                          }}
                        >
                          Confidence
                        </span>

                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: 700,
                            color: "#e2e8f0",
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