// import React, { useState } from 'react';

// // --- Reusable SVG Icon Components ---
// const CarIcon = () => (
//   <svg className="w-5 h-5 text-[#0C1A2B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9l2-4h14l2 4M3 9v7a1 1 0 001 1h1m16-8v7a1 1 0 01-1 1h-1M3 9h18" />
//   </svg>
// );

// const FolderIcon = () => (
//   <svg className="w-5 h-5 text-[#7BA4D0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
//   </svg>
// );

// const CheckCircleIcon = () => (
//   <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
//   </svg>
// );

// const XCircleIcon = () => (
//   <svg className="w-5 h-5 text-rose-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
//   </svg>
// );

// // --- Reusable UI Helper Components ---
// const ImageUploadBox = ({ label, inputId, preview, onFileChange }) => (
//   <div className="border-2 border-dashed border-[#7BA4D0]/40 hover:border-[#7BA4D0] bg-[#E7F0FA]/30 rounded-xl p-4 text-center transition-all flex flex-col items-center justify-center min-h-[200px]">
//     <span className="text-[11px] font-bold uppercase tracking-wider text-[#7BA4D0] mb-2">
//       {label}
//     </span>
//     <input
//       type="file"
//       accept="image/*"
//       id={inputId}
//       className="hidden"
//       onChange={onFileChange}
//     />
//     {preview ? (
//       <div className="relative w-full">
//         <img
//           src={preview}
//           alt={label}
//           className="w-full h-36 object-cover rounded-lg border border-slate-200"
//         />
//         <label
//           htmlFor={inputId}
//           className="absolute bottom-2 right-2 bg-[#0C1A2B]/80 hover:bg-[#0C1A2B] text-xs text-white px-2.5 py-1 rounded-md cursor-pointer transition-colors"
//         >
//           Change
//         </label>
//       </div>
//     ) : (
//       <label
//         htmlFor={inputId}
//         className="cursor-pointer flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-[#0C1A2B] transition-colors"
//       >
//         <div className="w-10 h-10 bg-[#E7F0FA] rounded-lg flex items-center justify-center">
//           <FolderIcon />
//         </div>
//         <span className="text-xs font-semibold text-[#0C1A2B]">Upload {label}</span>
//         <span className="text-[10px] text-slate-400">JPG, PNG cropped bbox</span>
//       </label>
//     )}
//   </div>
// );

// const MetricCard = ({ title, value }) => (
//   <div className="bg-[#E7F0FA]/40 p-3 rounded-lg border border-slate-100">
//     <span className="text-[10px] text-slate-400 uppercase font-semibold block">{title}</span>
//     <span className="text-[#0C1A2B] font-bold text-xs mt-0.5 block">{value}</span>
//   </div>
// );

// const ResultCard = ({ title, value, subtext, valueColor = "text-[#0C1A2B]" }) => (
//   <div className="bg-[#E7F0FA]/30 p-4 rounded-xl border border-slate-100 text-center">
//     <span className="text-[10px] text-slate-400 uppercase font-bold block">{title}</span>
//     <div className={`text-2xl font-extrabold mt-1 ${valueColor}`}>{value}</div>
//     <span className="text-[10px] text-slate-400">{subtext}</span>
//   </div>
// );

// // --- Main Vehicle Compare Component ---
// const VehicleCompare = () => {
//   const [file1, setFile1] = useState(null);
//   const [file2, setFile2] = useState(null);
//   const [preview1, setPreview1] = useState(null);
//   const [preview2, setPreview2] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [result, setResult] = useState(null);

//   // Model & Evaluation Parameters
//   const [threshold, setThreshold] = useState(0.75);
//   const [modelType] = useState('OSNet_x1_0 (VeRi-776)');
//   const [metric] = useState('Cosine Similarity');
//   const [embeddingDim] = useState('512-d');

//   const handleFileChange = (e, fileNumber) => {
//     const selectedFile = e.target.files[0];
//     if (!selectedFile) return;

//     if (fileNumber === 1) {
//       setFile1(selectedFile);
//       setPreview1(URL.createObjectURL(selectedFile));
//     } else {
//       setFile2(selectedFile);
//       setPreview2(URL.createObjectURL(selectedFile));
//     }
//   };

//   const handleCompare = async () => {
//     if (!file1 || !file2) {
//       alert('Please upload both vehicle images to perform comparison.');
//       return;
//     }

//     setLoading(true);
//     setResult(null);

//     const formData = new FormData();
//     formData.append('file1', file1);
//     formData.append('file2', file2);

//     try {
//       const response = await fetch('http://localhost:5000/api/compare', {
//         method: 'POST',
//         body: formData,
//       });

//       const data = await response.json();

//       if (response.ok) {
//         const rawResult = data.result || data;
//         const simScore = rawResult.similarity;
//         const isMatched = simScore >= threshold;

//         setResult({
//           similarity: simScore,
//           similarityPercentage: `${(simScore * 100).toFixed(2)}%`,
//           sameVehicle: isMatched,
//           margin: `${((simScore - threshold) * 100).toFixed(2)}%`,
//         });
//       } else {
//         alert(data.message || 'Comparison request failed.');
//       }
//     } catch (error) {
//       console.error('Error during vehicle comparison:', error);
//       alert('Failed to connect to backend service.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleReset = () => {
//     setFile1(null);
//     setFile2(null);
//     setPreview1(null);
//     setPreview2(null);
//     setResult(null);
//   };

//   return (
//     <div className="p-6 bg-[#F8FAFC] min-h-screen text-[#0C1A2B] font-sans space-y-6">
      
//       {/* Header Section */}
//       <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex justify-between items-center">
//         <div>
//           <h1 className="text-xl font-bold text-[#0C1A2B] flex items-center gap-2">
//             <CarIcon />
//             <span>Vehicle Re-Identification</span>
//           </h1>
//           <p className="text-xs text-slate-500 mt-1">
//             Deep Feature Extraction & Cross-Camera Identity Verification (OSNet)
//           </p>
//         </div>
//         <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full text-xs text-emerald-700 font-semibold">
//           <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
//           ENGINE ONLINE
//         </div>
//       </div>

//       {/* Main Content Grid */}
//       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
//         {/* Left Card: Upload Vehicle Pair */}
//         <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm flex flex-col justify-between">
//           <h2 className="text-xs font-bold uppercase tracking-wider text-[#7BA4D0] mb-4">
//             Query Vehicle Pair
//           </h2>

//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <ImageUploadBox
//               label="Vehicle Image A"
//               inputId="file1-input"
//               preview={preview1}
//               onFileChange={(e) => handleFileChange(e, 1)}
//             />
//             <ImageUploadBox
//               label="Vehicle Image B"
//               inputId="file2-input"
//               preview={preview2}
//               onFileChange={(e) => handleFileChange(e, 2)}
//             />
//           </div>

//           {/* Action Buttons */}
//           <div className="flex gap-3 mt-6">
//             <button
//               onClick={handleCompare}
//               disabled={loading || !file1 || !file2}
//               className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2 ${
//                 loading || !file1 || !file2
//                   ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
//                   : 'bg-[#0C1A2B] hover:bg-[#0C1A2B]/90 text-white shadow-sm'
//               }`}
//             >
//               {loading ? (
//                 <>
//                   <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
//                   Processing...
//                 </>
//               ) : (
//                 <>RUN RE-ID COMPARISON</>
//               )}
//             </button>
//             <button
//               onClick={handleReset}
//               className="py-2.5 px-4 rounded-lg font-semibold text-xs bg-white hover:bg-[#E7F0FA]/50 text-[#0C1A2B] border border-slate-200 transition-colors"
//             >
//               Reset
//             </button>
//           </div>
//         </div>

//         {/* Right Card: Model & Search Parameters */}
//         <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm flex flex-col justify-between">
//           <div>
//             <h2 className="text-xs font-bold uppercase tracking-wider text-[#7BA4D0] mb-4">
//               Model & Search Parameters
//             </h2>

//             <div className="space-y-4 text-xs">
              
//               {/* Threshold Slider */}
//               <div className="bg-[#E7F0FA]/40 p-4 rounded-xl border border-slate-100">
//                 <div className="flex justify-between items-center mb-2">
//                   <span className="text-[#0C1A2B] font-bold text-[11px]">MIN. SIMILARITY THRESHOLD</span>
//                   <span className="text-[#0C1A2B] font-extrabold text-sm">{(threshold * 100).toFixed(0)}%</span>
//                 </div>
//                 <input
//                   type="range"
//                   min="0.50"
//                   max="0.95"
//                   step="0.01"
//                   value={threshold}
//                   onChange={(e) => setThreshold(parseFloat(e.target.value))}
//                   className="w-full accent-[#7BA4D0] bg-slate-200 rounded-lg h-2 cursor-pointer"
//                 />
//                 <div className="flex justify-between text-[10px] text-slate-400 mt-1">
//                   <span>50% (Loose)</span>
//                   <span>75% (Recommended)</span>
//                   <span>95% (Strict)</span>
//                 </div>
//               </div>

//               {/* Param Details Grid */}
//               <div className="grid grid-cols-2 gap-3">
//                 <MetricCard title="Model Architecture" value={modelType} />
//                 <MetricCard title="Distance Metric" value={metric} />
//                 <MetricCard title="Vector Dimension" value={embeddingDim} />
//                 <MetricCard title="Target Device" value="CPU / PyTorch" />
//               </div>

//             </div>
//           </div>

//           <div className="text-[11px] text-slate-400 mt-4 border-t border-slate-100 pt-3 flex justify-between font-medium">
//             <span>Evaluation: PyTorch `F.cosine_similarity`</span>
//             <span>OSNet-x1-0</span>
//           </div>
//         </div>

//       </div>

//       {/* Results Section */}
//       {result && (
//         <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm space-y-4">
//           <div className="flex justify-between items-center border-b border-slate-100 pb-3">
//             <h3 className="text-xs font-bold uppercase tracking-wider text-[#0C1A2B]">
//               Identity Verification Assessment
//             </h3>
//             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
//               result.sameVehicle 
//                 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
//                 : 'bg-rose-50 text-rose-600 border border-rose-200'
//             }`}>
//               {result.sameVehicle ? 'MATCH CONFIRMED' : 'IDENTITY REJECTED'}
//             </span>
//           </div>

//           {/* Results Grid */}
//           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
//             <ResultCard 
//               title="Similarity Score" 
//               value={result.similarity.toFixed(4)} 
//               subtext="Range [0.0 - 1.0]" 
//             />
//             <ResultCard 
//               title="Match Confidence" 
//               value={result.similarityPercentage} 
//               subtext="Feature Vector Overlap" 
//               valueColor={result.sameVehicle ? 'text-emerald-600' : 'text-rose-600'}
//             />
//             <ResultCard 
//               title="Applied Threshold" 
//               value={`${(threshold * 100).toFixed(0)}%`} 
//               subtext="Decision Cut-off" 
//               valueColor="text-[#7BA4D0]"
//             />
//             <ResultCard 
//               title="Decision Margin" 
//               value={result.margin} 
//               subtext="Delta to Threshold" 
//               valueColor={result.sameVehicle ? 'text-emerald-600' : 'text-slate-500'}
//             />
//           </div>

//           {/* Banner Explanation */}
//           <div className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
//             result.sameVehicle
//               ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
//               : 'bg-rose-50/60 border-rose-200 text-rose-800'
//           }`}>
//             <div className="flex items-center gap-3">
//               {result.sameVehicle ? <CheckCircleIcon /> : <XCircleIcon />}
//               <div>
//                 <p className="font-bold">
//                   {result.sameVehicle 
//                     ? 'High Feature Correlation Detected' 
//                     : 'Low Feature Correlation (Different Identities)'}
//                 </p>
//                 <p className="text-[11px] opacity-80 mt-0.5">
//                   {result.sameVehicle
//                     ? `The extracted 512-D embeddings exceed the ${(threshold * 100).toFixed(0)}% threshold. Deep visual traits indicate these crops belong to the same vehicle.`
//                     : `The feature similarity level (${result.similarityPercentage}) is lower than the ${(threshold * 100).toFixed(0)}% decision boundary. ReID classifies these as distinct vehicles.`}
//                 </p>
//               </div>
//             </div>
//           </div>

//         </div>
//       )}

//     </div>
//   );
// };

// export default VehicleCompare;

import React, { useState } from 'react';

// --- Icons ---
const CameraIcon = () => (
  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

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

// --- Sub-components ---
const UploadTile = ({ label, inputId, preview, onFileChange }) => (
  <div className="border-2 border-dashed border-[#2E5E99]/30 hover:border-[#2E5E99] bg-[#E7F0FA]/40 rounded-xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-[210px] group cursor-pointer">
    <input
      type="file"
      accept="image/*"
      id={inputId}
      className="hidden"
      onChange={onFileChange}
    />
    {preview ? (
      <div className="relative w-full">
        <img
          src={preview}
          alt={label}
          className="w-full h-36 object-cover rounded-lg border border-[#2E5E99]/30"
        />
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
          <span className="text-xs text-[#4B617D] font-mono mt-0.5 block">JPG, PNG cropped bbox</span>
          <span className="text-[11px] text-[#4B617D]/70 block mt-1">or drag & drop</span>
        </div>
      </label>
    )}
  </div>
);

const SpecBox = ({ label, value }) => (
  <div className="bg-[#E7F0FA] p-3.5 rounded-xl border border-[#2E5E99]/10">
    <span className="text-[10px] text-[#4B617D] uppercase font-bold tracking-wider block">{label}</span>
    <span className="text-[#0D2440] font-black text-xs mt-1 block font-mono">{value}</span>
  </div>
);

const ResultTile = ({ title, value, subtext }) => (
  <div className="bg-[#E7F0FA] p-4 rounded-xl text-center border border-[#2E5E99]/10">
    <span className="text-[10px] text-[#4B617D] uppercase font-bold tracking-wider block">{title}</span>
    <div className="text-2xl font-black mt-1 font-mono text-[#0D2440]">{value}</div>
    <span className="text-[10px] text-[#4B617D] font-medium mt-0.5 block">{subtext}</span>
  </div>
);

// --- Main Engine Component ---
export default function VehicleReIDEngine() {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [preview1, setPreview1] = useState(null);
  const [preview2, setPreview2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [threshold, setThreshold] = useState(0.75);

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
      alert('Please upload both vehicle images.');
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
        const isMatched = simScore >= threshold;

        setResult({
          similarity: simScore,
          similarityPercentage: `${(simScore * 100).toFixed(2)}%`,
          sameVehicle: isMatched,
          margin: `${((simScore - threshold) * 100).toFixed(2)}%`,
        });
      } else {
        alert(data.message || 'Comparison request failed.');
      }
    } catch (error) {
      console.error('API Error:', error);
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
    <div className="min-h-screen bg-[#E7F0FA] p-8 space-y-6 text-[#0D2440] font-sans antialiased">
      
      {/* Header Card (White Card with Dark Icon) */}
      <header className="bg-white rounded-2xl p-5 border border-[#2E5E99]/10 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#0D2440] rounded-xl shadow-sm">
            <CameraIcon />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-[#0D2440]">
              Vehicle Re-Identification Engine
            </h1>
            <p className="text-xs text-[#4B617D] mt-0.5 font-medium">
              Deep Feature Extraction & Cross-Camera Identity Verification
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-[#E7F0FA] text-[#0D2440] px-3.5 py-1.5 rounded-full text-xs font-bold font-mono border border-[#2E5E99]/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            ENGINE ONLINE
          </div>
          <span className="bg-[#E7F0FA] text-[#4B617D] text-[11px] font-mono font-medium px-3 py-1.5 rounded-lg border border-[#2E5E99]/10">
            PyTorch backend
          </span>
        </div>
      </header>

      {/* Main Grid: White Cards over Light Background */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Upload Section */}
        <section className="lg:col-span-7 bg-white border border-[#2E5E99]/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between mb-5 border-b border-[#E7F0FA] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#0D2440] flex items-center gap-2">
                  <PulseIcon />
                  Query Vehicle Pair
                </h2>
                <p className="text-xs text-[#4B617D] mt-0.5">Upload two vehicle images for comparison</p>
              </div>
              <span className="text-[11px] font-mono bg-[#E7F0FA] text-[#4B617D] px-2.5 py-1 rounded-md">
                Step 1 of 2
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UploadTile
                label="Upload Vehicle Image A"
                inputId="file1-input"
                preview={preview1}
                onFileChange={(e) => handleFileChange(e, 1)}
              />
              <UploadTile
                label="Upload Vehicle Image B"
                inputId="file2-input"
                preview={preview2}
                onFileChange={(e) => handleFileChange(e, 2)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCompare}
              disabled={loading || !file1 || !file2}
              className={`flex-1 py-3 px-5 rounded-xl font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
                loading || !file1 || !file2
                  ? 'bg-[#E7F0FA] text-[#4B617D]/50 cursor-not-allowed border border-[#2E5E99]/10'
                  : 'bg-[#E7F0FA] hover:bg-[#0D2440] text-[#0D2440] hover:text-white border border-[#2E5E99]/20 shadow-xs'
              }`}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#0D2440] border-t-transparent rounded-full animate-spin"></span>
                  Processing Embeddings...
                </>
              ) : (
                'RUN RE-ID COMPARISON'
              )}
            </button>
            <button
              onClick={handleReset}
              className="py-3 px-5 rounded-xl font-bold text-xs bg-[#E7F0FA] hover:bg-[#0D2440] text-[#0D2440] hover:text-white transition-colors border border-[#2E5E99]/20"
            >
              Reset
            </button>
          </div>
        </section>

        {/* Right Side: Parameters & Technical Details */}
        <section className="lg:col-span-5 bg-white border border-[#2E5E99]/10 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between mb-5 border-b border-[#E7F0FA] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#0D2440]">Model & Search Parameters</h2>
                <p className="text-xs text-[#4B617D] mt-0.5">Configure similarity matching settings</p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              
              {/* Threshold Slider Card */}
              <div className="bg-[#E7F0FA] p-4 rounded-xl border border-[#2E5E99]/10 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[#0D2440] font-bold text-[11px] tracking-wider uppercase">MIN. SIMILARITY THRESHOLD</span>
                  <span className="bg-[#0D2440] text-white font-mono font-bold text-xs px-2.5 py-1 rounded-md">
                    {(threshold * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="w-full accent-[#0D2440] bg-[#2E5E99]/20 rounded h-1.5 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#4B617D] font-mono font-medium">
                  <span>50% (Loose)</span>
                  <span className="text-[#0D2440] underline font-bold">75% (Recommended)</span>
                  <span>95% (Strict)</span>
                </div>
              </div>

              {/* Technical Spec Boxes */}
              <div className="grid grid-cols-2 gap-3">
                <SpecBox label="Model Architecture" value="OSNet_x1_0 (VeRi-776)" />
                <SpecBox label="Vector Dimension" value="512-d" />
                <SpecBox label="Distance Metric" value="Cosine Similarity" />
                <SpecBox label="Target Device" value="CPU / PyTorch" />
              </div>

            </div>
          </div>

          <div className="text-[11px] text-[#4B617D] font-mono border-t border-[#E7F0FA] pt-3 flex justify-between">
            <span>Evaluation: `F.cosine_similarity`</span>
            <span className="text-[#0D2440] font-bold">OSNet-x1-0</span>
          </div>
        </section>

      </div>

      {/* Verification Assessment Section */}
      {result && (
        <section className="bg-white border border-[#2E5E99]/10 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex justify-between items-center border-b border-[#E7F0FA] pb-3.5">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0D2440]">
                Identity Verification Assessment
              </h3>
              <p className="text-[11px] text-[#4B617D] mt-0.5">Feature vector similarity evaluated across visual embeddings</p>
            </div>
            
            <span className="px-4 py-1.5 rounded-lg text-xs font-bold uppercase font-mono tracking-wider bg-[#0D2440] text-white">
              {result.sameVehicle ? 'MATCH CONFIRMED' : 'IDENTITY REJECTED'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <ResultTile 
              title="Similarity Score" 
              value={result.similarity.toFixed(4)} 
              subtext="Range [0.0 - 1.0]" 
            />
            <ResultTile 
              title="Match Confidence" 
              value={result.similarityPercentage} 
              subtext="Feature Vector Overlap" 
            />
            <ResultTile 
              title="Applied Threshold" 
              value={`${(threshold * 100).toFixed(0)}%`} 
              subtext="Decision Cut-off" 
            />
            <ResultTile 
              title="Decision Margin" 
              value={result.margin} 
              subtext="Delta to Threshold" 
            />
          </div>
        </section>
      )}

    </div>
  );
}