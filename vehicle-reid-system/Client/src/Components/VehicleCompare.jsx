import React, { useState } from 'react';

// --- SVG Icons ---
const UploadIcon = () => (
  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

const PulseIcon = () => (
  <svg className="w-4 h-4 text-[#4B617D]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const BugIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v2m0 12v2m8-8h-2M6 12H4m13.657-5.657l-1.414 1.414M7.757 16.243l-1.414 1.414m11.314 0l-1.414-1.414M7.757 7.757L6.343 6.343M12 8a4 4 0 100 8 4 4 0 000-8z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// --- Sub-components ---
const UploadTile = ({ label, inputId, preview, isVideo, onFileChange }) => (
  <div className="border-2 border-dashed border-[#2E5E99]/30 hover:border-[#2E5E99] bg-[#E7F0FA]/40 rounded-xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-[280px] group cursor-pointer">
    <input
      type="file"
      accept={isVideo ? "video/mp4,video/avi,video/quicktime" : "image/*"}
      id={inputId}
      className="hidden"
      onChange={onFileChange}
    />
    {preview ? (
      <div className="relative w-full">
        {isVideo ? (
          <video src={preview} controls className="w-full h-56 object-cover rounded-lg border border-[#2E5E99]/30" />
        ) : (
          <img src={preview} alt={label} className="w-full h-56 object-cover rounded-lg border border-[#2E5E99]/30" />
        )}
        <label
          htmlFor={inputId}
          className="absolute bottom-2 right-2 bg-[#0D2440] text-white text-xs font-bold px-3 py-1.5 rounded-md cursor-pointer hover:bg-[#2E5E99] transition-colors"
        >
          Change
        </label>
      </div>
    ) : (
      <label htmlFor={inputId} className="cursor-pointer flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-[#0D2440] rounded-full flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
          <UploadIcon />
        </div>
        <div>
          <span className="text-sm font-bold text-[#0D2440] block">{label}</span>
          <span className="text-xs text-[#4B617D] font-mono mt-0.5 block">
            {isVideo ? "MP4, AVI surveillance feeds" : "JPG, PNG cropped bbox"}
          </span>
          <span className="text-[11px] text-[#4B617D]/70 block mt-1">or drag & drop</span>
        </div>
      </label>
    )}
  </div>
);

const ResultTile = ({ title, value, subtext }) => (
  <div className="bg-[#E7F0FA] p-4 rounded-xl text-center border border-[#2E5E99]/10">
    <span className="text-[10px] text-[#4B617D] uppercase font-bold tracking-wider block">{title}</span>
    <div className="text-2xl font-black mt-1 font-mono text-[#0D2440]">{value}</div>
    <span className="text-[10px] text-[#4B617D] font-medium mt-0.5 block">{subtext}</span>
  </div>
);

const TierBadge = ({ tier }) => {
  const styles = {
    high: 'bg-emerald-100 text-emerald-700',
    possible: 'bg-amber-100 text-amber-700',
    unlikely: 'bg-[#E7F0FA] text-[#4B617D]',
  };
  const labels = {
    high: 'HIGH CONFIDENCE',
    possible: 'NEEDS REVIEW',
    unlikely: 'UNLIKELY',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${styles[tier] || styles.unlikely}`}>
      {labels[tier] || tier?.toUpperCase()}
    </span>
  );
};

const ColorConsistencyTag = ({ consistent }) => (
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
    consistent ? 'bg-emerald-100 text-emerald-700' : 'bg-[#E7F0FA] text-[#4B617D]'
  }`}>
    {consistent ? 'Color: Consistent' : 'Color: Inconsistent'}
  </span>
);

const PassFailBadge = ({ passed }) => (
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
    passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
  }`}>
    {passed ? 'PASS' : 'FAIL'}
  </span>
);

const TrackGrid = ({ title, tracks }) => (
  <div>
    <h4 className="text-xs font-bold text-[#0D2440] uppercase mb-2">
      {title} ({tracks?.length || 0})
    </h4>
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {tracks?.map((t) => (
        <div key={t.track_id} className="border border-[#2E5E99]/20 rounded-lg overflow-hidden">
          <img src={t.crop_url} alt={t.track_id} className="w-full h-16 object-cover" />
          <div className="p-1.5 text-[9px] font-mono text-[#4B617D]">
            <div className="font-bold text-[#0D2440] truncate">{t.track_id}</div>
            <div>{t.timestamp_sec}s</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// --- Main Engine Component ---
export default function VehicleReIDEngine() {
  const [mode, setMode] = useState('video');
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [preview1, setPreview1] = useState(null);
  const [preview2, setPreview2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [videoResult, setVideoResult] = useState(null);
  const [debugResult, setDebugResult] = useState(null);
  const [threshold, setThreshold] = useState(0.78);
  const [matchDecisions, setMatchDecisions] = useState({});

  const handleFileChange = (e, fileNumber) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (fileNumber === 1) {
      setFile1(selectedFile);
      setPreview1(URL.createObjectURL(selectedFile));
    } else {
      setFile2(selectedFile);
      setPreview2(URL.createObjectURL(selectedFile));
    }
  };

  const handleReset = () => {
    setFile1(null);
    setFile2(null);
    setPreview1(null);
    setPreview2(null);
    clearResults();
  };

  const clearResults = () => {
    setResult(null);
    setVideoResult(null);
    setDebugResult(null);
    setMatchDecisions({});
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    handleReset();
  };

  const executeApiCall = async (endpoint, payloadBuilder, onSuccess) => {
    const formData = new FormData();
    payloadBuilder(formData);

    try {
      const response = await fetch(`http://localhost:8000${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        onSuccess(data);
      } else {
        alert(data.detail || data.message || 'Operation failed.');
      }
    } catch (error) {
      console.error('API Error:', error);
      alert('Failed to connect to backend service.');
    }
  };

  const handleCompare = async () => {
    if (!file1 || !file2) {
      alert(`Please upload both vehicle ${mode === 'video' ? 'video feeds' : 'images'}.`);
      return;
    }

    setLoading(true);
    clearResults();

    if (mode === 'video') {
      await executeApiCall(
        '/compare-video-streams',
        (fd) => {
          fd.append('video1', file1);
          fd.append('video2', file2);
          fd.append('threshold', threshold);
        },
        (data) => setVideoResult(data)
      );
    } else {
      await executeApiCall(
        '/compare',
        (fd) => {
          fd.append('file1', file1);
          fd.append('file2', file2);
        },
        (data) => {
          const rawResult = data.result || data;
          const simScore = rawResult.similarity;
          setResult({
            similarity: simScore,
            similarityPercentage: `${(simScore * 100).toFixed(2)}%`,
            confidenceTier: rawResult.confidence_tier,
            sameVehicle: rawResult.confidence_tier === 'high',
            margin: `${((simScore - threshold) * 100).toFixed(2)}%`,
          });
        }
      );
    }
    setLoading(false);
  };

  const handleDebugCompare = async () => {
    if (mode !== 'video') {
      alert('Debug Inspect is only available in 2-Camera Video Mode.');
      return;
    }
    if (!file1 || !file2) {
      alert('Please upload both camera feeds first.');
      return;
    }

    setDebugLoading(true);
    clearResults();

    await executeApiCall(
      '/debug-compare-video-streams',
      (fd) => {
        fd.append('video1', file1);
        fd.append('video2', file2);
        fd.append('threshold', threshold);
      },
      (data) => setDebugResult(data)
    );
    setDebugLoading(false);
  };

  const handleConfirmMatch = (matchId) => {
    setMatchDecisions((prev) => ({ ...prev, [matchId]: 'confirmed' }));
  };

  const handleRejectMatch = (matchId) => {
    setMatchDecisions((prev) => ({ ...prev, [matchId]: 'rejected' }));
  };

  const isDisabled = loading || debugLoading || !file1 || !file2;

  return (
    <div className="space-y-6 text-[#0D2440] font-sans antialiased">
      {/* Main Grid */}
      <section className="bg-white border border-[#2E5E99]/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
        <div>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-5 border-b border-[#E7F0FA] pb-3 gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#0D2440] flex items-center gap-2">
                <PulseIcon />
                {mode === 'video' ? 'Dual Video Input' : 'Cropped Vehicles Pair'}
              </h2>
              <p className="text-xs text-[#4B617D] mt-0.5">
                {mode === 'video' ? 'Upload 2 surveillance feeds for automated cross-matching' : 'Upload 2 cropped vehicle images'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 bg-[#E7F0FA] p-1.5 rounded-xl border border-[#2E5E99]/20">
                {['video', 'image'].map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono transition-all whitespace-nowrap ${
                      mode === m ? 'bg-[#0D2440] text-white shadow-sm' : 'text-[#0D2440] hover:bg-white/50'
                    }`}
                  >
                    {m === 'video' ? '2-Cam Video' : 'Single Crop'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3 bg-[#E7F0FA] px-4 py-2 rounded-xl border border-[#2E5E99]/10">
                <span className="text-[10px] font-bold text-[#4B617D] uppercase tracking-wider whitespace-nowrap">
                  Match Threshold
                </span>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-28 accent-[#0D2440] cursor-pointer"
                />
                <span className="bg-[#0D2440] text-white font-mono font-bold text-xs px-2.5 py-1 rounded-md min-w-[44px] text-center">
                  {(threshold * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <UploadTile
              label={mode === 'video' ? "Upload Cam 1 Feed (.mp4)" : "Upload Vehicle Image A"}
              inputId="file1-input"
              preview={preview1}
              isVideo={mode === 'video'}
              onFileChange={(e) => handleFileChange(e, 1)}
            />
            <UploadTile
              label={mode === 'video' ? "Upload Cam 2 Feed (.mp4)" : "Upload Vehicle Image B"}
              inputId="file2-input"
              preview={preview2}
              isVideo={mode === 'video'}
              onFileChange={(e) => handleFileChange(e, 2)}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleCompare}
            disabled={isDisabled}
            className={`flex-1 py-3 px-5 rounded-xl font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
              isDisabled
                ? 'bg-[#E7F0FA] text-[#4B617D]/50 cursor-not-allowed border border-[#2E5E99]/10'
                : 'bg-[#E7F0FA] hover:bg-[#0D2440] text-[#0D2440] hover:text-white border border-[#2E5E99]/20 shadow-xs'
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-[#0D2440] border-t-transparent rounded-full animate-spin"></span>
                Scanning Frames & Extracting Features...
              </>
            ) : (
              'RUN RE-ID '
            )}
          </button>

          {mode === 'video' && (
            <button
              onClick={handleDebugCompare}
              disabled={isDisabled}
              title="Shows every extracted crop plus the full similarity/time/color breakdown for every pair."
              className={`py-3 px-5 rounded-xl font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 border ${
                isDisabled
                  ? 'bg-white text-[#4B617D]/50 cursor-not-allowed border-[#2E5E99]/10'
                  : 'bg-white hover:bg-amber-500 text-amber-600 hover:text-white border-amber-400/50'
              }`}
            >
              {debugLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                  Inspecting...
                </>
              ) : (
                <>
                  <BugIcon />
                  DEBUG INSPECT
                </>
              )}
            </button>
          )}

          <button
            onClick={handleReset}
            className="py-3 px-5 rounded-xl font-bold text-xs bg-[#E7F0FA] hover:bg-[#0D2440] text-[#0D2440] hover:text-white transition-colors border border-[#2E5E99]/20"
          >
            Reset
          </button>
        </div>
      </section>

      {/* Video Mode Results */}
      {videoResult && (
        <section className="bg-white border border-[#2E5E99]/10 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-[#E7F0FA] pb-3.5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0D2440]">
                Module 2 Cross-Camera Re-ID Results
              </h3>
              <p className="text-[11px] text-[#4B617D] mt-0.5">Visually inspect extracted crops below to verify correctness</p>
            </div>
            <span className="px-4 py-1.5 rounded-lg text-xs font-bold font-mono bg-[#0D2440] text-white">
              {videoResult.total_reid_matches} MATCHES FOUND
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ResultTile title="Cam 1 Detected Vehicles" value={videoResult.cam1_vehicles_found} subtext="Best crop frames selected" />
            <ResultTile title="Cam 2 Detected Vehicles" value={videoResult.cam2_vehicles_found} subtext="Best crop frames selected" />
            <ResultTile
              title="Cross-Camera Matches"
              value={videoResult.total_reid_matches}
              subtext={`${videoResult.high_confidence_matches} high · ${videoResult.possible_matches} possible`}
            />
          </div>

          {videoResult.matches?.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-[#0D2440] uppercase">Operator Visual Review (Module 2.6)</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono align-middle">
                  <thead>
                    <tr className="bg-[#E7F0FA] text-[#0D2440]">
                      <th className="p-3 rounded-l-lg">Cam 1 Crop & Metadata</th>
                      <th className="p-3">Cam 2 Crop & Metadata</th>
                      <th className="p-3">Similarity / Tier</th>
                      <th className="p-3">Color</th>
                      <th className="p-3 rounded-r-lg">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videoResult.matches.map((m) => {
                      const decision = matchDecisions[m.match_id];
                      return (
                        <tr key={m.match_id} className="border-b border-[#E7F0FA]">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <img src={m.cam1_details.crop_url} alt="Cam 1 Crop" className="w-16 h-12 object-cover rounded border border-[#2E5E99]/30 shadow-xs" />
                              <div>
                                <span className="font-bold text-[#0D2440] block">{m.cam1_details.timestamp}</span>
                                <span className="text-[10px] text-[#4B617D]">Conf: {m.cam1_details.confidence}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <img src={m.cam2_details.crop_url} alt="Cam 2 Crop" className="w-16 h-12 object-cover rounded border border-[#2E5E99]/30 shadow-xs" />
                              <div>
                                <span className="font-bold text-[#0D2440] block">{m.cam2_details.timestamp}</span>
                                <span className="text-[10px] text-[#4B617D]">Conf: {m.cam2_details.confidence}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="font-bold text-emerald-600 text-sm block">{m.similarity_percentage}</span>
                            <TierBadge tier={m.confidence_tier} />
                          </td>
                          <td className="p-3">
                            <ColorConsistencyTag consistent={m.color_consistent} />
                          </td>
                          <td className="p-3">
                            {decision === 'confirmed' ? (
                              <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-[10px] px-2.5 py-1 rounded-md font-bold">
                                <CheckIcon /> CONFIRMED
                              </span>
                            ) : decision === 'rejected' ? (
                              <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-600 text-[10px] px-2.5 py-1 rounded-md font-bold">
                                <XIcon /> REJECTED
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleConfirmMatch(m.match_id)}
                                  className="bg-[#0D2440] text-white text-[10px] px-2.5 py-1 rounded-md mr-2 hover:bg-[#2E5E99] transition-colors font-bold"
                                >
                                  Confirm True
                                </button>
                                <button
                                  onClick={() => handleRejectMatch(m.match_id)}
                                  className="bg-red-500 text-white text-[10px] px-2.5 py-1 rounded-md hover:bg-red-600 transition-colors font-bold"
                                >
                                  Reject False
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Image Crop Mode Results */}
      {result && (
        <section className="bg-white border border-[#2E5E99]/10 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-[#E7F0FA] pb-3.5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0D2440]">
                Identity Verification Assessment
              </h3>
              <p className="text-[11px] text-[#4B617D] mt-0.5">Feature vector similarity evaluated across visual embeddings</p>
            </div>
            <TierBadge tier={result.confidenceTier} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <ResultTile title="Similarity Score" value={result.similarity.toFixed(4)} subtext="Range [0.0 - 1.0]" />
            <ResultTile title="Match Confidence" value={result.similarityPercentage} subtext="Feature Vector Overlap" />
            <ResultTile title="Applied Threshold" value={`${(threshold * 100).toFixed(0)}%`} subtext="Decision Cut-off" />
            <ResultTile title="Decision Margin" value={result.margin} subtext="Delta to Threshold" />
          </div>
        </section>
      )}

      
      {/* Debug Results Panel */}
      {debugResult && (
        <section className="bg-white border border-amber-400/40 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-[#E7F0FA] pb-3.5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-600 flex items-center gap-2">
                <BugIcon />
                Debug Inspection (all tracks, no filtering)
              </h3>
              <p className="text-[11px] text-[#4B617D] mt-0.5">{debugResult.note}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-[11px] font-mono">
            <div className="bg-[#E7F0FA] p-3 rounded-xl">
              <span className="text-[#4B617D] block mb-1">Similarity (high / possible)</span>
              <span className="font-bold text-[#0D2440]">
                {debugResult.current_thresholds.similarity_high_confidence} / {debugResult.current_thresholds.similarity_low_confidence}
              </span>
            </div>
            <div className="bg-[#E7F0FA] p-3 rounded-xl">
              <span className="text-[#4B617D] block mb-1">Time window (sec)</span>
              <span className="font-bold text-[#0D2440]">
                {debugResult.current_thresholds.min_time_gap_sec} – {debugResult.current_thresholds.max_time_gap_sec}
              </span>
            </div>
            <div className="bg-[#E7F0FA] p-3 rounded-xl col-span-2">
              <span className="text-[#4B617D] block mb-1">Color advisory ceiling (not a hard filter)</span>
              <span className="font-bold text-[#0D2440]">{debugResult.current_thresholds.color_advisory_max}</span>
            </div>
          </div>

          <TrackGrid title="Cam 1 Tracks" tracks={debugResult.cam1_tracks} />
          <TrackGrid title="Cam 2 Tracks" tracks={debugResult.cam2_tracks} />

          <div>
            <h4 className="text-xs font-bold text-[#0D2440] uppercase mb-2">
              Pairwise Breakdown (sorted by similarity, highest first)
            </h4>
            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-[#E7F0FA] rounded-xl">
              <table className="w-full text-left text-[10px] font-mono">
                <thead className="sticky top-0 bg-[#E7F0FA] text-[#0D2440]">
                  <tr>
                    <th className="p-2">Cam1 Track</th>
                    <th className="p-2">Cam2 Track</th>
                    <th className="p-2">Similarity / Tier</th>
                    <th className="p-2">Time Gap (s)</th>
                    <th className="p-2">Color</th>
                    <th className="p-2">Surfaced to Operator?</th>
                  </tr>
                </thead>
                <tbody>
                  {debugResult.pairwise_breakdown.map((p, idx) => (
                    <tr key={idx} className="border-b border-[#E7F0FA]">
                      <td className="p-2">{p.cam1_track}</td>
                      <td className="p-2">{p.cam2_track}</td>
                      <td className="p-2">
                        <span className={p.confidence_tier === 'high' ? 'text-emerald-600 font-bold' : p.confidence_tier === 'possible' ? 'text-amber-600 font-bold' : ''}>
                          {(p.similarity * 100).toFixed(2)}%
                        </span>{' '}
                        <TierBadge tier={p.confidence_tier} />
                      </td>
                      <td className="p-2">
                        {p.time_gap_sec}s <PassFailBadge passed={p.time_gap_passed} />
                      </td>
                      <td className="p-2">
                        {p.color_distance} <ColorConsistencyTag consistent={p.color_consistent} />
                      </td>
                      <td className="p-2">
                        {p.surfaced_to_operator ? (
                          <span className="text-emerald-600 font-bold">YES</span>
                        ) : (
                          <span className="text-[#4B617D]">no</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}