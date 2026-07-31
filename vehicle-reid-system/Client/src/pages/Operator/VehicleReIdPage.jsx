import React, { useState } from "react";
import {
  Search,
  Upload,
  Sliders,
  Camera,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Layers,
} from "lucide-react";

export default function VehicleReIdPage() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [colorFilter, setColorFilter] = useState("Any Color");
  const [typeFilter, setTypeFilter] = useState("Any Type");
  const [threshold, setThreshold] = useState(75);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Mock Camera Selection States
  const [selectedCams, setSelectedCams] = useState([
    "CAM-001",
    "CAM-002",
    "CAM-003",
  ]);

  const toggleCam = (camId) => {
    if (selectedCams.includes(camId)) {
      setSelectedCams(selectedCams.filter((c) => c !== camId));
    } else {
      setSelectedCams([...selectedCams, camId]);
    }
  };

  const handleRunSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setHasSearched(true);
    }, 1200);
  };

  // Mock Re-ID Search Results from Backend
  const results = [
    {
      id: "MATCH-8821",
      camId: "CAM-001",
      location: "Shahrah-e-Faisal Gate",
      timestamp: "14:32:18",
      confidence: 97.2,
      plate: "KHI-2847",
      type: "Sedan",
      color: "White",
      imageUrl:
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: "MATCH-8822",
      camId: "CAM-003",
      location: "Burns Road Chawk",
      timestamp: "14:35:44",
      confidence: 94.6,
      plate: "KHI-2847",
      type: "Sedan",
      color: "White",
      imageUrl:
        "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=600&q=80",
    },
    {
      id: "MATCH-8823",
      camId: "CAM-005",
      location: "Tariq Road Market",
      timestamp: "14:41:02",
      confidence: 91.3,
      plate: "KHI-2847",
      type: "Sedan",
      color: "White",
      imageUrl:
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="bg-[#16202E] p-5 rounded-2xl border border-slate-700/60 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-white shadow-xl">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#3AB0FF]" />
            Vehicle Re-Identification (Re-ID)
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Query target vehicle feature vectors across multi-camera streams
          </p>
        </div>
        <div className="flex items-center gap-2 bg-[#0D131D] px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-[#3AB0FF]">
          <Layers className="w-4 h-4" />
          <span>Vector Similarity Engine v2.4</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT PANEL: QUERY CONFIGURATION (White Card with Dark Cyan Accents) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-lg space-y-6 text-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#3AB0FF] rounded-full" />
              1. Configure Query
            </h2>
            <span className="text-xs font-medium text-slate-400">Step 1 of 2</span>
          </div>

          {/* Image Upload Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Upload Target Snapshot
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-[#3AB0FF] rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                Click to browse or drag & drop snapshot
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                PNG, JPG, or crop box frame (Max 10MB)
              </p>
            </div>
          </div>

          {/* Filters: Color & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Vehicle Color
              </label>
              <select
                value={colorFilter}
                onChange={(e) => setColorFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-[#3AB0FF] focus:outline-none"
              >
                <option>Any Color</option>
                <option>White</option>
                <option>Black</option>
                <option>Silver</option>
                <option>Red</option>
                <option>Blue</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Vehicle Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-[#3AB0FF] focus:outline-none"
              >
                <option>Any Type</option>
                <option>Sedan</option>
                <option>SUV</option>
                <option>Hatchback</option>
                <option>Pickup</option>
                <option>Bus</option>
              </select>
            </div>
          </div>

          {/* Target Source Cameras Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Target Camera Nodes
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["CAM-001", "CAM-002", "CAM-003", "CAM-004", "CAM-005", "CAM-006"].map(
                (cam) => {
                  const isChecked = selectedCams.includes(cam);
                  return (
                    <button
                      key={cam}
                      type="button"
                      onClick={() => toggleCam(cam)}
                      className={`px-3 py-2 rounded-xl text-xs font-mono font-semibold transition-all border ${
                        isChecked
                          ? "bg-[#16202E] text-[#3AB0FF] border-[#16202E]"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {cam}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Min Similarity Threshold Slider */}
          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
              <span>Min. Similarity Threshold</span>
              <span className="font-mono text-[#3AB0FF] font-bold">{threshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full accent-[#3AB0FF] cursor-pointer"
            />
          </div>

          {/* Run Re-ID Button */}
          <button
            onClick={handleRunSearch}
            disabled={isSearching}
            className="w-full bg-[#16202E] hover:bg-[#0D131D] text-[#3AB0FF] font-bold text-sm py-3 px-4 rounded-xl shadow-lg border border-slate-700 flex items-center justify-center gap-2 transition-all"
          >
            {isSearching ? (
              <>
                <span className="w-4 h-4 border-2 border-[#3AB0FF] border-t-transparent rounded-full animate-spin" />
                Scanning Feature Embeddings...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                RUN RE-ID SEARCH
              </>
            )}
          </button>
        </div>

        {/* RIGHT PANEL: RE-ID MATCH RESULTS (Dark Cyan Panel Container with White Result Cards) */}
        <div className="lg:col-span-7 bg-[#16202E] rounded-2xl p-6 border border-slate-700/60 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3 mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                2. Re-ID Matches Across Cameras
              </h2>
              {hasSearched && (
                <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  3 Matches Found
                </span>
              )}
            </div>

            {!hasSearched && !isSearching ? (
              <div className="flex flex-col items-center justify-center h-80 text-center p-8 text-slate-400">
                <Camera className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-sm font-semibold text-slate-200">No Re-ID Search Executed</p>
                <p className="text-xs text-slate-400 max-w-xs mt-1">
                  Configure target image or filters on the left panel and click "Run Re-ID Search" to identify matched sightings.
                </p>
              </div>
            ) : isSearching ? (
              <div className="flex flex-col items-center justify-center h-80 text-center p-8 text-slate-300">
                <div className="w-10 h-10 border-4 border-[#3AB0FF] border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm font-bold text-white">Extracting Deep Visual Features...</p>
                <p className="text-xs text-slate-400 mt-1">Comparing embeddings against camera index</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((res) => (
                  <div
                    key={res.id}
                    className="bg-white rounded-xl p-4 border border-slate-200 shadow-md flex flex-col sm:flex-row items-center gap-4 hover:shadow-lg transition-all text-slate-800"
                  >
                    {/* Snapshot Image */}
                    <img
                      src={res.imageUrl}
                      alt={res.id}
                      className="w-full sm:w-32 h-24 object-cover rounded-lg border border-slate-200 shrink-0"
                    />

                    {/* Metadata */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-[#16202E]">
                          {res.camId} — {res.location}
                        </span>
                        <span className="text-xs font-bold font-mono bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full">
                          {res.confidence}% Match
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span>
                          Plate: <strong className="font-mono text-slate-900">{res.plate}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Type: <strong>{res.type}</strong> ({res.color})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono pt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Sighting Time: {res.timestamp}</span>
                      </div>
                    </div>

                    {/* Action */}
                    <button className="sm:self-center bg-[#16202E] hover:bg-[#0D131D] text-[#3AB0FF] text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 flex items-center gap-1.5 shrink-0">
                      View Path
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}