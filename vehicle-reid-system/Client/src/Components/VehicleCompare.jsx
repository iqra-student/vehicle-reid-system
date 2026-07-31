import React, { useState } from 'react';

const VehicleCompare = () => {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [preview1, setPreview1] = useState(null);
  const [preview2, setPreview2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Model & Evaluation Parameters
  const [threshold, setThreshold] = useState(0.75); // Default 75%
  const [modelType] = useState('OSNet_x1_0 (VeRi-776)');
  const [metric] = useState('Cosine Similarity');
  const [embeddingDim] = useState('512-d');

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

  const handleCompare = async () => {
    if (!file1 || !file2) {
      alert('Please upload both vehicle images to perform comparison.');
      return;
    }

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file1', file1);
    formData.append('file2', file2);

    try {
      const response = await fetch('http://localhost:5000/api/compare', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        const rawResult = data.result || data;
        const simScore = rawResult.similarity;
        
        // Dynamic re-evaluation based on user parameter threshold slider
        const isMatched = simScore >= threshold;

        setResult({
          similarity: simScore,
          similarityPercentage: `${(simScore * 100).toFixed(2)}%`,
          sameVehicle: isMatched,
          margin: `${((simScore - threshold) * 100).toFixed(2)}%`
        });
      } else {
        alert(data.message || 'Comparison request failed.');
      }
    } catch (error) {
      console.error('Error during vehicle comparison:', error);
      alert('Failed to connect to backend service.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile1(null);
    setFile2(null);
    setPreview1(null);
    setPreview2(null);
    setResult(null);
  };

  return (
    <div className="p-6 text-slate-100 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Header Banner */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>🚗</span> Vehicle Re-Identification
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deep Feature Extraction & Cross-Camera Identity Verification (OSNet)
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          AI ENGINE ONLINE
        </div>
      </div>

      {/* Main Grid: Upload & Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Image Upload Cards */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Query Vehicle Pair
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Vehicle A */}
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 bg-slate-950/50 rounded-xl p-4 text-center transition-all flex flex-col items-center justify-center min-h-[220px]">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                Vehicle Image A
              </span>
              <input
                type="file"
                accept="image/*"
                id="file1-input"
                className="hidden"
                onChange={(e) => handleFileChange(e, 1)}
              />
              {preview1 ? (
                <div className="relative w-full">
                  <img
                    src={preview1}
                    alt="Vehicle A"
                    className="w-full h-40 object-cover rounded-lg border border-slate-700"
                  />
                  <label
                    htmlFor="file1-input"
                    className="absolute bottom-2 right-2 bg-slate-900/90 text-xs text-slate-300 px-2 py-1 rounded cursor-pointer hover:bg-black"
                  >
                    Change
                  </label>
                </div>
              ) : (
                <label
                  htmlFor="file1-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white"
                >
                  <div className="p-3 bg-slate-800/80 rounded-full text-cyan-400">📁</div>
                  <span className="text-xs font-medium">Upload Vehicle A</span>
                  <span className="text-[10px] text-slate-500">JPG, PNG cropped bbox</span>
                </label>
              )}
            </div>

            {/* Vehicle B */}
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 bg-slate-950/50 rounded-xl p-4 text-center transition-all flex flex-col items-center justify-center min-h-[220px]">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
                Vehicle Image B
              </span>
              <input
                type="file"
                accept="image/*"
                id="file2-input"
                className="hidden"
                onChange={(e) => handleFileChange(e, 2)}
              />
              {preview2 ? (
                <div className="relative w-full">
                  <img
                    src={preview2}
                    alt="Vehicle B"
                    className="w-full h-40 object-cover rounded-lg border border-slate-700"
                  />
                  <label
                    htmlFor="file2-input"
                    className="absolute bottom-2 right-2 bg-slate-900/90 text-xs text-slate-300 px-2 py-1 rounded cursor-pointer hover:bg-black"
                  >
                    Change
                  </label>
                </div>
              ) : (
                <label
                  htmlFor="file2-input"
                  className="cursor-pointer flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-white"
                >
                  <div className="p-3 bg-slate-800/80 rounded-full text-cyan-400">📁</div>
                  <span className="text-xs font-medium">Upload Vehicle B</span>
                  <span className="text-[10px] text-slate-500">JPG, PNG cropped bbox</span>
                </label>
              )}
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleCompare}
              disabled={loading || !file1 || !file2}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                loading || !file1 || !file2
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30'
              }`}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Processing Embeddings...
                </>
              ) : (
                <>▶ RUN RE-ID COMPARISON</>
              )}
            </button>
            <button
              onClick={handleReset}
              className="py-3 px-4 rounded-xl font-medium text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Right Column: Model & Evaluation Parameters */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Model & Search Parameters
            </h2>

            <div className="space-y-4 text-xs">
              
              {/* Threshold Slider */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-300 font-medium">MIN. SIMILARITY THRESHOLD</span>
                  <span className="text-cyan-400 font-bold text-sm">{(threshold * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>50% (Loose Match)</span>
                  <span>75% (Recommended)</span>
                  <span>95% (Strict Match)</span>
                </div>
              </div>

              {/* Parameter Metrics Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Model Architecture</span>
                  <span className="text-slate-200 font-medium text-xs mt-0.5 block">{modelType}</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Distance Metric</span>
                  <span className="text-slate-200 font-medium text-xs mt-0.5 block">{metric}</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Vector Dimension</span>
                  <span className="text-slate-200 font-medium text-xs mt-0.5 block">{embeddingDim}</span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Target Device</span>
                  <span className="text-slate-200 font-medium text-xs mt-0.5 block">CPU / PyTorch</span>
                </div>
              </div>

            </div>
          </div>

          <div className="text-[11px] text-slate-500 mt-4 border-t border-slate-800/80 pt-3 flex justify-between">
            <span>Evaluation Logic: PyTorch `F.cosine_similarity`</span>
            <span>OSNet-x1-0</span>
          </div>
        </div>

      </div>

      {/* Results Dashboard Block */}
      {result && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Identity Verification Assessment
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
              result.sameVehicle 
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' 
                : 'bg-rose-950 text-rose-400 border border-rose-500/40'
            }`}>
              {result.sameVehicle ? 'MATCH CONFIRMED' : 'IDENTITY REJECTED'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Metric 1: Cosine Score */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Similarity Score</span>
              <div className="text-2xl font-extrabold text-white mt-1">
                {result.similarity.toFixed(4)}
              </div>
              <span className="text-[10px] text-slate-500">Range [0.0 - 1.0]</span>
            </div>

            {/* Metric 2: Confidence Percentage */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Match Confidence</span>
              <div className={`text-2xl font-extrabold mt-1 ${result.sameVehicle ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.similarityPercentage}
              </div>
              <span className="text-[10px] text-slate-500">Feature Vector Overlap</span>
            </div>

            {/* Metric 3: Configured Threshold */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Applied Threshold</span>
              <div className="text-2xl font-extrabold text-cyan-400 mt-1">
                {(threshold * 100).toFixed(0)}%
              </div>
              <span className="text-[10px] text-slate-500">Decision Cut-off</span>
            </div>

            {/* Metric 4: Threshold Margin */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-center">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Decision Margin</span>
              <div className={`text-2xl font-extrabold mt-1 ${result.sameVehicle ? 'text-emerald-400' : 'text-slate-400'}`}>
                {result.margin}
              </div>
              <span className="text-[10px] text-slate-500">Delta to Threshold</span>
            </div>

          </div>

          {/* Detailed Explanation Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            result.sameVehicle
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-lg">{result.sameVehicle ? '✅' : '❌'}</span>
              <div>
                <p className="font-bold">
                  {result.sameVehicle 
                    ? 'High Feature Correlation Detected' 
                    : 'Low Feature Correlation (Different Identities)'}
                </p>
                <p className="text-[11px] opacity-80 font-normal">
                  {result.sameVehicle
                    ? `The extracted 512-D embeddings exceed the ${(threshold * 100).toFixed(0)}% threshold. The deep visual traits strongly indicate these crops belong to the same vehicle.`
                    : `The feature similarity level (${result.similarityPercentage}) is lower than the ${(threshold * 100).toFixed(0)}% decision boundary. ReID classifies these as distinct vehicles.`}
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default VehicleCompare;