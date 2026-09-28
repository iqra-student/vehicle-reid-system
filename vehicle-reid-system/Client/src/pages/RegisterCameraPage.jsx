import React, { useState } from "react";
import { submitCamera } from "../api/cameraApi";
import { useAuth } from "../context/AuthContext";
import { X, Video, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

const INITIAL = {
  name: "",
  location: "",
  streamUrl: "",
  latitude: "",
  longitude: "",
  angle: "120",
  resolution: "1080p",
  frameRate: "30",
};

const inputCls =
  "w-full bg-white border border-[#D4E2F0] rounded-xl px-3.5 py-2.5 text-sm text-[#0D2440] placeholder-[#93A2B8] focus:border-[#2E5E99] focus:outline-none";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#4B617D] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function RegisterCameraPage({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [form, setForm] = useState(INITIAL);
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccessMsg("");

    if (!form.name || !form.location || !form.latitude || !form.longitude) {
      setFormError("Name, location, latitude, and longitude are required.");
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await submitCamera({
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        angle: form.angle ? parseFloat(form.angle) : undefined,
        frameRate: form.frameRate ? parseFloat(form.frameRate) : undefined,
      });

      setSuccessMsg(
        data.status === "approved"
          ? "Camera added and live immediately."
          : "Camera submitted for admin approval."
      );
      setForm(INITIAL);

      setTimeout(() => {
        setSuccessMsg("");
        if (onSuccess) onSuccess();
      }, 900);
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to submit camera.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0D2440]/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#D4E2F0] shadow-2xl">
        <div className="p-5 border-b border-[#E7F0FA] flex items-center justify-between">
          <h3 className="font-bold text-base text-[#0D2440] flex items-center gap-2">
            <Video className="w-5 h-5 text-[#2E5E99]" />
            Register Camera
          </h3>
          <button onClick={onClose} className="text-[#93A2B8] hover:text-[#0D2440] p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-[#4B617D]">
            {user?.role === "admin"
              ? "As an administrator, cameras you add go live immediately."
              : "Submitted cameras need admin approval before they go live."}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Camera Name *">
              <input name="name" value={form.name} onChange={handleChange} placeholder="e.g. Shahrah-e-Faisal Gate" className={inputCls} />
            </Field>
            <Field label="Location *">
              <input name="location" value={form.location} onChange={handleChange} placeholder="e.g. Karachi South" className={inputCls} />
            </Field>
          </div>

          <Field label="IP Address / Stream URL">
            <input name="streamUrl" value={form.streamUrl} onChange={handleChange} placeholder="rtsp://192.168.1.10:554/stream" className={`${inputCls} font-mono`} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="GPS Latitude *">
              <input type="number" step="any" name="latitude" value={form.latitude} onChange={handleChange} placeholder="24.8607" className={`${inputCls} font-mono`} />
            </Field>
            <Field label="GPS Longitude *">
              <input type="number" step="any" name="longitude" value={form.longitude} onChange={handleChange} placeholder="67.0011" className={`${inputCls} font-mono`} />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Angle (°)">
              <input type="number" name="angle" value={form.angle} onChange={handleChange} className={inputCls} />
            </Field>
            <Field label="Resolution">
              <input name="resolution" value={form.resolution} onChange={handleChange} className={inputCls} />
            </Field>
            <Field label="Frame Rate">
              <select name="frameRate" value={form.frameRate} onChange={handleChange} className={inputCls}>
                <option value="15">15 fps</option>
                <option value="25">25 fps</option>
                <option value="30">30 fps</option>
                <option value="60">60 fps</option>
              </select>
            </Field>
          </div>

          {formError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E7F0FA]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-[#D4E2F0] text-[#4B617D] hover:bg-[#F8FAFD]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#2E5E99] hover:bg-[#0D2440] text-white flex items-center gap-2 disabled:opacity-60"
            >
              {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Submit Camera
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}