import React, { useState, useRef, useEffect } from "react";
import axiosInstance from "../../api/axiosInstance";

// Sapphire Veil palette
// #E7F0FA (mist)  #7BA4D0 (steel)  #2E5E99 (primary)  #0D2440 (ink)

const STATUS = {
  NEW: {
    label: "New Vehicle",
    mark: "N",
    badgeClass: "bg-[#0D2440] border-[#0D2440] text-white",
    markClass: "bg-[#7BA4D0] text-[#0D2440]",
  },
  SAME_CAMERA: {
    label: "Same Camera",
    mark: "=",
    badgeClass: "bg-[#EEF3FA] border-[#7BA4D0] text-[#0D2440]",
    markClass: "bg-[#2E5E99] text-white",
  },
  RETURN_SAME_CAMERA: {
    label: "Vehicle Returned",
    mark: "R",
    badgeClass: "bg-[#7BA4D0] border-[#7BA4D0] text-[#0D2440]",
    markClass: "bg-[#0D2440] text-white",
  },
  NEW_CAMERA_SIGHTING: {
    label: "Movement Updated",
    mark: "M",
    badgeClass: "bg-[#2E5E99] border-[#2E5E99] text-white",
    markClass: "bg-white text-[#2E5E99]",
  },
};

const NODE_BASE = "http://localhost:5000";

function apiError(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (detail?.message) return detail.message;
  return err.response?.data?.error || fallback;
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="p-3 rounded-xl bg-[#FBEAEA] border border-[#F0C6C4] text-[#B3261E] text-xs font-medium">
      {message}
    </div>
  );
}

function CameraSelect({ cameras, value, onChange, includeAll }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3.5 py-2.5 bg-[#F3F6FB] border border-[#DCE6F2] rounded-xl text-sm font-semibold text-[#0D2440] outline-none focus:bg-white focus:border-[#2E5E99] transition"
    >
      {includeAll && <option value="">All Cameras</option>}
      {cameras.map((cam) => (
        <option key={cam._id} value={cam.name}>
          {cam.name} — {cam.location}
        </option>
      ))}
    </select>
  );
}

function TrailView({ trail }) {
  if (!trail || trail.length === 0) return null;
  return (
    <div className="flex flex-wrap items-start gap-3">
      {trail.map((s, idx) => {
        const raw = s.imageUrl || s.image || s.car_image_b64 || s.imageFilename;
        const imgSrc = raw
          ? (raw.startsWith("http") ? raw : NODE_BASE + (raw.startsWith("/") ? raw : "/" + raw))
          : null;

        return (
          <React.Fragment key={idx}>
            <div className="flex flex-col items-center w-32">
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={s.cameraId || "car"}
                  className="w-32 h-20 object-cover rounded-lg border border-[#DCE6F2] bg-[#0D2440]"
                />
              ) : (
                <div className="w-32 h-20 bg-[#0D2440] rounded-lg flex items-center justify-center text-[10px] text-[#5B7699]">
                  No image
                </div>
              )}
              <span className="mt-1 text-[10px] font-semibold text-[#0D2440]">
                {s.cameraId}
              </span>
              <span className="text-[10px] text-[#5B7699]">
                {s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : ""}
              </span>
            </div>
            {idx < trail.length - 1 && (
              <span className="text-[#7BA4D0] self-center text-lg">→</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// The backend embeds each car's snapshot as a base64 data URI in
// item.car_image_b64 for video tracking results. If it's a web path,
// prepend NODE_BASE so the browser fetches it from the Node server.
function CarSnapshot({ src, alt, className }) {
  if (!src) {
    return (
      <div className={`${className} bg-[#0D2440] flex items-center justify-center`}>
        <span className="text-[10px] font-semibold text-[#5B7699]">No image</span>
      </div>
    );
  }
  const resolved = src.startsWith("http") || src.startsWith("data:")
    ? src
    : NODE_BASE + (src.startsWith("/") ? src : "/" + src);
  return <img src={resolved} alt={alt} className={className} />;
}

function uniqueTrackPlates(items) {
  const seen = new Set();
  const dummy = new Set(["", "READING...", "UNKNOWN"]);
  const out = [];
  for (const item of items || []) {
    const plate = String(item.plate || "").trim().toUpperCase();
    if (dummy.has(plate) || seen.has(plate)) continue;
    seen.add(plate);
    out.push(item);
  }
  return out;
}

export default function PlateSearchPage() {
  // Page 1 = "detect" (image scan + video tracking together)
  // Page 2 = "search"
  const [activeTab, setActiveTab] = useState("detect");
  // Inside page 1, choose input type
  const [detectMode, setDetectMode] = useState("image"); // "image" | "video"

  // Video tracking
  const [trackFile, setTrackFile] = useState(null);
  const [trackBusy, setTrackBusy] = useState(false);
  const [trackStatus, setTrackStatus] = useState("Upload a camera video, or use sample.mp4.");
  const [trackProgress, setTrackProgress] = useState(0);
  const [trackError, setTrackError] = useState(null);
  const [trackPlates, setTrackPlates] = useState([]);
  const [trackVideoUrl, setTrackVideoUrl] = useState(null);
  const [trackRegion, setTrackRegion] = useState("US");

  // Image scan
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cameraId, setCameraId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Registered cameras
  const [cameras, setCameras] = useState([]);
  const [camerasLoading, setCamerasLoading] = useState(true);
  const [camerasError, setCamerasError] = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCameraId, setSearchCameraId] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [matchCount, setMatchCount] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const imgRef = useRef(null);

  useEffect(() => {
    const fetchCameras = async () => {
      setCamerasLoading(true);
      setCamerasError(null);
      try {
        const res = await axiosInstance.get(`/cameras`);
        const list = Array.isArray(res.data) ? res.data : res.data.cameras || [];
        const approved = list.filter((c) => c.status === "approved");
        setCameras(approved);
        if (approved.length > 0) {
          setCameraId((prev) => prev || approved[0].name);
        }
      } catch (err) {
        console.error("Failed to load cameras:", err);
        setCamerasError("Could not load registered cameras.");
      } finally {
        setCamerasLoading(false);
      }
    };
    fetchCameras();
  }, []);

  useEffect(() => {
    return () => {
      if (trackVideoUrl) URL.revokeObjectURL(trackVideoUrl);
    };
  }, [trackVideoUrl]);

  const resetTrackOutput = () => {
    setTrackError(null);
    setTrackPlates([]);
    setTrackProgress(0);
    setTrackVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const pollTrackJob = async (jobId) => {
    while (true) {
      const statusRes = await axiosInstance.get(`/plate-track-status/${jobId}`);
      const job = statusRes.data;
      setTrackStatus(job.message || "Working...");
      if (job.total) {
        setTrackProgress(Math.min(100, Math.round((job.frame / job.total) * 100)));
      }
      if (job.status === "done") {
        const videoRes = await axiosInstance.get(`/plate-track-result/${jobId}`, {
          responseType: "blob",
        });
        console.log("Video response:", videoRes);
console.log("Content-Type:", videoRes.headers["content-type"]);
console.log("Blob type:", videoRes.data.type);
console.log("Blob size:", videoRes.data.size);
const videoBlob = new Blob([videoRes.data], {
  type: "video/mp4",
});

        const url = URL.createObjectURL(videoRes.data);
        setTrackVideoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setTrackPlates(uniqueTrackPlates(job.plates || []));
        setTrackProgress(100);
        setTrackStatus("Output is on this screen. Press play if needed.");
        return;
      }
      if (job.status === "error") {
        throw new Error(job.error || "Tracking failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  };

  const runTrackJob = async (startRequest, waitingMessage) => {
    setTrackBusy(true);
    resetTrackOutput();
    setTrackStatus(waitingMessage);
    try {
      const startRes = await startRequest();
      const jobId = startRes.data?.job_id;
      if (!jobId) throw new Error("Upload failed");
      setTrackStatus("Tracking plates. Keep this tab open.");
      await pollTrackJob(jobId);
    } catch (err) {
      const message = err.message && !err.response ? err.message : apiError(err, "Tracking failed.");
      setTrackError(message);
      setTrackStatus(message);
    } finally {
      setTrackBusy(false);
    }
  };

  const handleTrackFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setTrackFile(file);
    setTrackError(null);
  };

  const handleTrackUpload = async (e) => {
    e.preventDefault();
    if (!trackFile) {
      setTrackStatus("Choose a file, or click Use sample.mp4.");
      return;
    }
    if (!cameraId) {
      setTrackStatus("Please select a registered camera first.");
      return;
    }
    const formData = new FormData();
    formData.append("video", trackFile);
    formData.append("camera_id", cameraId);
    formData.append("region", trackRegion);
    await runTrackJob(
      () => axiosInstance.post(`/plate-track`, formData),
      "Uploading your video...",
    );
  };

  const handleTrackSample = async () => {
    if (!cameraId) {
      setTrackStatus("Please select a registered camera first.");
      return;
    }
    const formData = new FormData();
    formData.append("camera_id", cameraId);
    formData.append("region", trackRegion);
    await runTrackJob(
      () => axiosInstance.post(`/plate-track-sample`, formData),
      "Using sample.mp4...",
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select a vehicle image first.");
      return;
    }
    if (!cameraId) {
      setError("Please select a registered camera first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("camera_id", cameraId);

    try {
      const res = await axiosInstance.post(`/plate-detect`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (err) {
      console.error("Plate detection error:", err);
      setError(apiError(err, "Plate detection failed. Please check backend connection."));
    } finally {
      setLoading(false);
    }
  };

  const getPlateBoxStyle = () => {
    if (!result?.bbox || !imgRef.current) return null;
    const [x1, y1, x2, y2] = result.bbox;
    const img = imgRef.current;
    if (!img.naturalWidth || !img.naturalHeight) return null;

    return {
      left: `${(x1 / img.naturalWidth) * 100}%`,
      top: `${(y1 / img.naturalHeight) * 100}%`,
      width: `${((x2 - x1) / img.naturalWidth) * 100}%`,
      height: `${((y2 - y1) / img.naturalHeight) * 100}%`,
    };
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchError("Please enter a license plate number to search.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await axiosInstance.get(`/search`, {
        params: {
          plate: searchQuery.trim(),
          cameraId: searchCameraId.trim() ? searchCameraId.trim() : undefined,
        },
      });

      if (response.data.status === "success") {
        setSearchResults(response.data.results || []);
        setMatchCount(response.data.matchCount || 0);
        setHasSearched(true);
      }
    } catch (err) {
      console.error("Search API Error:", err);
      setSearchError(apiError(err, "Failed to fetch plate records. Please try again."));
    } finally {
      setIsSearching(false);
    }
  };

  const status = result?.matchStatus ? STATUS[result.matchStatus] : null;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6 bg-[#EEF3FA] min-h-screen font-sans">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0D2440] p-5 rounded-2xl shadow-lg shadow-[#0D2440]/20 gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            License Plate Control Center
          </h1>
          <p className="text-xs text-[#9FBBDA] mt-0.5">
            Vehicle license plate detection &amp; recognition, and vehicle search
          </p>
        </div>

        <div className="flex bg-[#173A63] p-1 rounded-xl w-full sm:w-auto">
          {[
            ["detect", "Detection & Recognition"],
            ["search", "Vehicle Search"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition ${
                activeTab === key ? "bg-[#7BA4D0] text-[#0D2440] shadow-sm" : "text-[#9FBBDA] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* PAGE 1: DETECTION & RECOGNITION */}
      {activeTab === "detect" && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#DCE6F2] shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-[#0D2440]">Vehicle License Plate Detection and Recognition</h2>
              <p className="text-xs text-[#5B7699] mt-0.5">
                Detects the plate region, crops it, and reads the plate number. Same plate number keeps tracking the same vehicle within the camera feed.
              </p>
            </div>

            <div className="flex bg-[#F3F6FB] p-1 rounded-xl border border-[#DCE6F2] w-full sm:w-auto">
              {[
                ["image", "Image"],
                ["video", "Video"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setDetectMode(key)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition ${
                    detectMode === key ? "bg-[#2E5E99] text-white shadow-sm" : "text-[#5B7699] hover:text-[#173A63]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* IMAGE MODE */}
          {detectMode === "image" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-[#DCE6F2] shadow-sm p-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#4A6382] uppercase tracking-wider mb-1.5">
                      Camera Location ID
                    </label>

                    {camerasLoading ? (
                      <div className="w-full px-3.5 py-2.5 bg-[#F3F6FB] border border-[#DCE6F2] rounded-xl text-sm text-[#8CA3BF]">
                        Loading registered cameras...
                      </div>
                    ) : cameras.length === 0 ? (
                      <div className="w-full px-3.5 py-2.5 bg-[#EAF1FB] border border-[#BFD6EE] rounded-xl text-xs text-[#173A63] font-medium">
                        No approved cameras found. Register one in Module 1 first.
                      </div>
                    ) : (
                      <CameraSelect cameras={cameras} value={cameraId} onChange={setCameraId} />
                    )}

                    {camerasError && (
                      <p className="text-[11px] text-[#B3261E] mt-1 font-medium">{camerasError}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#4A6382] uppercase tracking-wider mb-1.5">
                      Vehicle Image Upload
                    </label>
                    <input
                      id="plate-file-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="plate-file-input"
                      className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-[#C9D9EC] rounded-xl bg-[#F7FAFD] hover:bg-[#EEF3FA] cursor-pointer transition text-center"
                    >
                      <span className="text-xs font-semibold text-[#173A63]">
                        {selectedFile ? selectedFile.name : "Choose or drop vehicle image"}
                      </span>
                      <span className="text-[10px] text-[#8CA3BF] mt-0.5">JPG, JPEG, or PNG</span>
                    </label>
                  </div>

                  {previewUrl && (
                    <div className="relative w-full rounded-xl overflow-hidden border border-[#DCE6F2] bg-[#0D2440]">
                      <img
                        ref={imgRef}
                        src={previewUrl}
                        alt="Vehicle preview"
                        className="w-full h-auto block"
                        onLoad={() => setResult((r) => (r ? { ...r } : r))}
                      />
                      {result?.bbox && (
                        <div
                          className="absolute border-2 border-[#7BA4D0] bg-[#7BA4D0]/25 rounded pointer-events-none box-border shadow-[0_0_12px_rgba(123,164,208,0.6)]"
                          style={getPlateBoxStyle()}
                        />
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!selectedFile || loading || cameras.length === 0}
                    className={`w-full py-3 rounded-xl font-bold text-sm transition ${
                      !selectedFile || loading || cameras.length === 0
                        ? "bg-[#DCE6F2] text-[#9FB4CC] cursor-not-allowed"
                        : "bg-[#2E5E99] text-white shadow-md shadow-[#2E5E99]/30 hover:bg-[#173A63] active:scale-[0.99]"
                    }`}
                  >
                    {loading ? "Analyzing Image..." : "Run Detection"}
                  </button>
                  <div className="mt-3">
                    <ErrorBanner message={error} />
                  </div>
                </div>
              </div>

              {/* RESULT PANEL */}
              <div className="bg-white rounded-2xl border border-[#DCE6F2] shadow-sm p-6">
                <h2 className="text-xs font-bold text-[#8CA3BF] uppercase tracking-wider mb-4">
                  Detection &amp; Recognition Result
                </h2>

                {!result && !loading && (
                  <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-[#E3EBF4] rounded-xl bg-[#F7FAFD] p-6 text-center">
                    <p className="text-xs font-semibold text-[#5B7699]">Ready for scanning</p>
                    <p className="text-[11px] text-[#8CA3BF] mt-1">
                      Upload an image to view detected license plate details.
                    </p>
                  </div>
                )}

                {loading && (
                  <div className="h-64 flex flex-col items-center justify-center border border-[#E3EBF4] rounded-xl bg-[#F7FAFD]">
                    <div className="w-8 h-8 border-3 border-[#DCE6F2] border-t-[#2E5E99] rounded-full animate-spin mb-3" />
                    <p className="text-xs font-bold text-[#173A63]">Extracting License Plate...</p>
                  </div>
                )}

                {result && !loading && (
                  <div className="space-y-4">
                    {!result.plate_text ? (
                      <div className="p-4 rounded-xl bg-[#FBEAEA] border border-[#F0C6C4] text-center text-[#B3261E] text-xs font-bold">
                        No license plate was detected in this image.
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl bg-[#0D2440] p-5 text-center shadow-md shadow-[#0D2440]/20">
                          <span className="text-[10px] font-bold text-[#7BA4D0] uppercase tracking-widest">
                            Detected Plate Number
                          </span>
                          <div className="text-4xl font-black text-white mt-1 font-mono tracking-wider">
                            {result.plate_text}
                          </div>
                          <div className="text-xs font-medium text-[#9FBBDA] mt-1">
                            Confidence: {(result.confidence * 100).toFixed(1)}%
                          </div>
                        </div>

                        {status && (
                          <div className={`rounded-xl border p-4 space-y-3 ${status.badgeClass}`}>
                            <div className="flex items-center gap-2 font-bold text-xs">
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${status.markClass}`}>
                                {status.mark}
                              </span>
                              {status.label}
                            </div>

                            {result.matchStatus === "NEW" && (
                              <p className="text-xs">
                                No previous sighting found. Recorded at camera <strong>{cameraId}</strong>.
                              </p>
                            )}

                            {result.matchStatus === "SAME_CAMERA" && result.previousSighting && (
                              <p className="text-xs">
                                Still within the same observation window at{" "}
                                <strong>{result.previousSighting.cameraId}</strong> — last seen{" "}
                                {new Date(result.previousSighting.timestamp).toLocaleTimeString()}. Trail not updated.
                              </p>
                            )}

                            {(result.matchStatus === "NEW_CAMERA_SIGHTING" ||
                              result.matchStatus === "RETURN_SAME_CAMERA") &&
                              result.previousSighting && (
                                <p className="text-xs">
                                  Previously at <strong>{result.previousSighting.cameraId}</strong> —{" "}
                                  {new Date(result.previousSighting.timestamp).toLocaleString()}
                                </p>
                              )}

                            {result.trail?.length > 1 && (
                              <div className="pt-2 border-t border-current/10">
                                <TrailView trail={result.trail} />
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIDEO MODE */}
          {detectMode === "video" && (
            <div className="bg-white rounded-2xl border border-[#DCE6F2] shadow-sm p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#4A6382] uppercase tracking-wider mb-1.5">
                  Camera Location ID
                </label>

                {camerasLoading ? (
                  <div className="w-full px-3.5 py-2.5 bg-[#F3F6FB] border border-[#DCE6F2] rounded-xl text-sm text-[#8CA3BF]">
                    Loading registered cameras...
                  </div>
                ) : cameras.length === 0 ? (
                  <div className="w-full px-3.5 py-2.5 bg-[#EAF1FB] border border-[#BFD6EE] rounded-xl text-xs text-[#173A63] font-medium">
                    No approved cameras found. Register one in Module 1 first.
                  </div>
                ) : (
                  <CameraSelect cameras={cameras} value={cameraId} onChange={setCameraId} />
                )}

                {camerasError && (
                  <p className="text-[11px] text-[#B3261E] mt-1 font-medium">{camerasError}</p>
                )}
              </div>

              {/* --- Plate region selector --- */}
              <div>
                <label className="block text-xs font-bold text-[#4A6382] uppercase tracking-wider mb-1.5">
                  Choose
                </label>
                <select
                  value={trackRegion}
                  onChange={(e) => setTrackRegion(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F3F6FB] border border-[#DCE6F2] rounded-xl text-sm font-semibold text-[#0D2440] outline-none focus:bg-white focus:border-[#2E5E99] transition"
                >
                  <option value="US">1</option>
                  <option value="NL">2</option>
                </select>
                <p className="text-[11px] text-[#8CA3BF] mt-1">
                  Matches the camera's region.
                </p>
              </div>

              <form onSubmit={handleTrackUpload} className="flex flex-wrap items-center gap-3">
                <input
                  id="track-video-input"
                  type="file"
                  accept="video/*"
                  onChange={handleTrackFileChange}
                  className="hidden"
                />
                <label
                  htmlFor="track-video-input"
                  className="flex-1 min-w-[220px] px-4 py-2.5 border-2 border-dashed border-[#C9D9EC] rounded-xl bg-[#F7FAFD] hover:bg-[#EEF3FA] cursor-pointer text-xs font-semibold text-[#173A63]"
                >
                  {trackFile ? trackFile.name : "Choose camera video"}
                </label>
                <button
                  type="submit"
                  disabled={trackBusy || !cameraId}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#2E5E99] text-white shadow-md shadow-[#2E5E99]/30 hover:bg-[#173A63] disabled:bg-[#DCE6F2] disabled:text-[#9FB4CC] disabled:shadow-none disabled:cursor-wait"
                >
                  {trackBusy ? "Tracking..." : "Upload and track"}
                </button>
                <button
                  type="button"
                  onClick={handleTrackSample}
                  disabled={trackBusy || !cameraId}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#0D2440] text-white hover:bg-[#173A63] disabled:opacity-50 disabled:cursor-wait"
                >
                  Use sample.mp4
                </button>
              </form>

              <p className="text-xs text-[#5B7699] min-h-5">{trackStatus}</p>
              <div className="h-2.5 rounded-full bg-[#E7F0FA] border border-[#DCE6F2] overflow-hidden">
                <span
                  className="block h-full bg-[#2E5E99] transition-[width] duration-200"
                  style={{ width: `${trackProgress}%` }}
                />
              </div>

              <ErrorBanner message={trackError} />

              <div className="rounded-xl overflow-hidden border border-[#DCE6F2] bg-[#0D2440] min-h-[280px] flex items-center justify-center">
                {trackVideoUrl ? (
                  <video src={trackVideoUrl} controls playsInline autoPlay className="w-full bg-black" />
                ) : (
                  <p className="text-sm text-[#9FBBDA] px-6 py-16 text-center">
                    {trackBusy ? trackStatus : "Output video will appear here"}
                  </p>
                )}
              </div>

              {trackVideoUrl && (
                <a
                  href={trackVideoUrl}
                  download="plate_tracking.mp4"
                  className="inline-block text-sm font-semibold text-[#2E5E99] hover:text-[#0D2440]"
                >
                  Download output video
                </a>
              )}

              {trackPlates.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-[#8CA3BF] uppercase tracking-wider">
                    Detected vehicles ({trackPlates.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {trackPlates.map((item) => (
                      <div
                        key={`${item.id}-${item.plate}`}
                        className="rounded-xl border border-[#DCE6F2] overflow-hidden bg-[#F7FAFD]"
                      >
                        <CarSnapshot
                          src={item.car_image_b64}
                          alt={`Vehicle ${item.id}`}
                          className="w-full h-36 object-cover bg-[#0D2440]"
                        />
                        <div className="p-3 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-[#5B7699]">
                            <span>ID {item.id}</span>
                          </div>
                          <div className="font-mono font-black text-[#2E5E99] tracking-wide">
                            {item.plate}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PAGE 2: VEHICLE SEARCH */}
      {activeTab === "search" && (
        <div className="bg-white rounded-2xl border border-[#DCE6F2] shadow-sm p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#0D2440]">Vehicle Search by License Plate</h2>
            <p className="text-xs text-[#5B7699] mt-0.5">
              Query historical vehicle sightings and tracking trail by plate number and camera feed.
            </p>
          </div>

          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-[#4A6382] uppercase tracking-wider mb-1">
                License Plate Number
              </label>
              <input
                type="text"
                placeholder="Enter plate (e.g. MN1367)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#F3F6FB] border border-[#DCE6F2] rounded-xl text-sm font-semibold text-[#0D2440] outline-none focus:bg-white focus:border-[#2E5E99] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#4A6382] uppercase tracking-wider mb-1">
                Filter by Camera (Optional)
              </label>
              <CameraSelect cameras={cameras} value={searchCameraId} onChange={setSearchCameraId} includeAll />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={isSearching}
                className="w-full md:w-auto px-6 py-2.5 bg-[#2E5E99] hover:bg-[#173A63] text-white font-bold text-sm rounded-xl shadow-md shadow-[#2E5E99]/30 transition disabled:opacity-50"
              >
                {isSearching ? "Searching Database..." : "Search Vehicle History"}
              </button>
            </div>
          </form>

          <ErrorBanner message={searchError} />

          {hasSearched && (
            <div className="space-y-3 pt-4 border-t border-[#E3EBF4]">
              <h3 className="text-xs font-bold text-[#8CA3BF] uppercase tracking-wider">
                Matching Vehicles ({matchCount})
              </h3>

              {searchResults.length === 0 ? (
                <div className="p-8 text-center bg-[#F7FAFD] rounded-xl border border-[#E3EBF4] text-xs text-[#5B7699]">
                  No records found matching plate <strong>"{searchQuery}"</strong>.
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((v) => (
                    <div key={v.plateNumber} className="rounded-xl border border-[#DCE6F2] p-4 space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-mono font-black text-lg text-[#2E5E99]">{v.plateNumber}</span>
                        <div className="flex gap-4 text-[11px] text-[#5B7699] font-semibold">
                          <span>{v.totalSightings} sightings</span>
                          <span>{v.totalCameras} cameras</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-[#5B7699]">
                        First seen: {v.firstSeen ? new Date(v.firstSeen).toLocaleString() : "N/A"} · Last seen:{" "}
                        {v.lastSeen ? new Date(v.lastSeen).toLocaleString() : "N/A"}
                      </div>
                      <TrailView trail={v.trail} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}