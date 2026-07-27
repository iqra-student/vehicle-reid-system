import React, { useState } from 'react';
import axios from 'axios';

const DetectionTest = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await axios.post('http://localhost:5000/api/detection/detect', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data.savedRecord);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Pipeline processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header Banner */}
      <div style={styles.header}>
        <h2 style={styles.title}>🔍 Pipeline Verification Endpoint</h2>
        <p style={styles.pipelineBadge}>
          React <span style={styles.arrow}>→</span> Express <span style={styles.arrow}>→</span> FastAPI YOLOv8 <span style={styles.arrow}>→</span> MongoDB
        </p>
      </div>

      {/* Main Content Grid */}
      <div style={styles.grid}>
        {/* Upload Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>1. Upload Image Frame</h3>
          <form onSubmit={handleUpload}>
            <div style={styles.uploadBox}>
              <input type="file" accept="image/*" onChange={handleFileChange} id="file-input" style={{ display: 'none' }} />
              <label htmlFor="file-input" style={styles.fileLabel}>
                {selectedFile ? selectedFile.name : '📁 Choose Vehicle Image'}
              </label>
            </div>

            {previewUrl && (
              <div style={styles.previewContainer}>
                <img src={previewUrl} alt="Preview" style={styles.previewImage} />
              </div>
            )}

            <button type="submit" disabled={!selectedFile || loading} style={loading ? styles.btnDisabled : styles.btnActive}>
              {loading ? '⚡ Running Detection...' : '🚀 Run Detection Pipeline'}
            </button>
          </form>

          {error && <div style={styles.errorBox}>❌ {error}</div>}
        </div>

        {/* Results Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>2. Detection Results</h3>
          {!result ? (
            <div style={styles.emptyState}>
              <p>Upload an image frame on the left and run detection to see pipeline results stored in MongoDB.</p>
            </div>
          ) : (
            <div>
              <div style={styles.successBanner}>
                <span>✅ Saved to Database</span>
              </div>

              <div style={styles.metaGrid}>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Document ID</span>
                  <span style={styles.metaValue}>{result._id}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Vehicles Found</span>
                  <span style={styles.metaValueHighlight}>{result.vehicleCount}</span>
                </div>
                <div style={styles.metaItem}>
                  <span style={styles.metaLabel}>Timestamp</span>
                  <span style={styles.metaValue}>{new Date(result.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              <h4 style={{ marginTop: '20px', marginBottom: '10px' }}>Detections Breakdown</h4>
              <div style={styles.detectionsList}>
                {result.detections.map((item, index) => (
                  <div key={index} style={styles.detectionCard}>
                    <div style={styles.detectionHeader}>
                      <span style={styles.classBadge}>{item.className.toUpperCase()}</span>
                      <span style={styles.confidenceBadge}>{(item.confidence * 100).toFixed(1)}% confidence</span>
                    </div>
                    <div style={styles.bboxText}>
                      Bounding Box: [{item.bbox.join(', ')}]
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Inline CSS Styles object for clean presentation
const styles = {
  container: {
    maxWidth: '1100px',
    margin: '30px auto',
    padding: '0 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    color: '#333'
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px'
  },
  title: {
    margin: '0 0 10px 0',
    fontSize: '28px',
    color: '#1a1a1a'
  },
  pipelineBadge: {
    display: 'inline-block',
    background: '#f0f4f8',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    color: '#4a5568',
    fontWeight: '500'
  },
  arrow: {
    color: '#3182ce',
    fontWeight: 'bold',
    margin: '0 4px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.2fr',
    gap: '24px'
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0'
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: '20px',
    fontSize: '18px',
    color: '#2d3748',
    borderBottom: '2px solid #edf2f7',
    paddingBottom: '10px'
  },
  uploadBox: {
    marginBottom: '15px'
  },
  fileLabel: {
    display: 'block',
    padding: '12px 20px',
    background: '#f7fafc',
    border: '2px dashed #cbd5e0',
    borderRadius: '8px',
    textAlign: 'center',
    cursor: 'pointer',
    color: '#4a5568',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  previewContainer: {
    marginBottom: '15px',
    textAlign: 'center'
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: '260px',
    borderRadius: '8px',
    objectFit: 'contain',
    border: '1px solid #e2e8f0'
  },
  btnActive: {
    width: '100%',
    padding: '12px',
    background: '#3182ce',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '15px',
    cursor: 'pointer'
  },
  btnDisabled: {
    width: '100%',
    padding: '12px',
    background: '#a0aec0',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    fontSize: '15px',
    cursor: 'not-allowed'
  },
  errorBox: {
    marginTop: '15px',
    padding: '12px',
    background: '#fff5f5',
    color: '#c53030',
    borderRadius: '8px',
    fontSize: '14px'
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    color: '#a0aec0',
    fontSize: '15px'
  },
  successBanner: {
    background: '#c6f6d5',
    color: '#22543d',
    padding: '10px 14px',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '14px',
    marginBottom: '16px'
  },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginBottom: '20px'
  },
  metaItem: {
    background: '#f7fafc',
    padding: '10px',
    borderRadius: '8px',
    textAlign: 'center'
  },
  metaLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  metaValue: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#2d3748'
  },
  metaValueHighlight: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#2b6cb0'
  },
  detectionsList: {
    maxHeight: '300px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  detectionCard: {
    background: '#f7fafc',
    padding: '10px 14px',
    borderRadius: '8px',
    borderLeft: '4px solid #3182ce'
  },
  detectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  classBadge: {
    background: '#e2e8f0',
    color: '#2d3748',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  confidenceBadge: {
    color: '#38a169',
    fontWeight: '600',
    fontSize: '13px'
  },
  bboxText: {
    fontSize: '12px',
    color: '#718096',
    fontFamily: 'monospace'
  }
};

export default DetectionTest;