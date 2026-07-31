import React, { useState } from "react";
import { submitCamera } from "../api/cameraApi";
import { useAuth } from "../context/AuthContext";
import { X, Video, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RegisterCameraPage({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    location: "",
    streamUrl: "",
    latitude: "",
    longitude: "",
    angle: "120",
    resolution: "1080p",
    frameRate: "30",
  });
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

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
      const payload = {
        ...form,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        angle: form.angle ? parseFloat(form.angle) : undefined,
        frameRate: form.frameRate ? parseFloat(form.frameRate) : undefined,
      };

      const { data } = await submitCamera(payload);
      
      const msg =
        data.status === "approved"
          ? "Camera added and live immediately."
          : "Camera submitted for admin approval.";

      setSuccessMsg(msg);

      // Reset Form
      setForm({
        name: "",
        location: "",
        streamUrl: "",
        latitude: "",
        longitude: "",
        angle: "120",
        resolution: "1080p",
        frameRate: "30",
      });

      // Call parent refresh callback if passed
      if (onSuccess) onSuccess();

      // Close modal after brief delay
      setTimeout(() => {
        setSuccessMsg("");
        onClose();
      }, 1000);
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to submit camera.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#16202E] w-full max-w-xl rounded-2xl shadow-2xl border border-slate-700/80 overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-[#3AB0FF]" />
            Add New Camera
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Inputs Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <p className="text-[11px] text-slate-400">
            {user?.role === "admin"
              ? "⚡ As an Administrator, cameras you add will go live immediately."
              : "📋 As an Operator, submitted cameras will require admin authorization."}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Camera Name *
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Shahrah-e-Faisal Gate"
                className="w-full bg-[#0D131D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-[#3AB0FF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Location *
              </label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g. Karachi South"
                className="w-full bg-[#0D131D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:border-[#3AB0FF] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">
              IP Address / Stream URL
            </label>
            <input
              type="text"
              name="streamUrl"
              value={form.streamUrl}
              onChange={handleChange}
              placeholder="rtsp://192.168.1.10:554/stream"
              className="w-full bg-[#0D131D] border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-white placeholder-slate-500 focus:border-[#3AB0FF] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                GPS Latitude *
              </label>
              <input
                type="number"
                step="any"
                name="latitude"
                value={form.latitude}
                onChange={handleChange}
                placeholder="24.8607"
                className="w-full bg-[#0D131D] border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-white placeholder-slate-500 focus:border-[#3AB0FF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                GPS Longitude *
              </label>
              <input
                type="number"
                step="any"
                name="longitude"
                value={form.longitude}
                onChange={handleChange}
                placeholder="67.0011"
                className="w-full bg-[#0D131D] border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-white placeholder-slate-500 focus:border-[#3AB0FF] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Camera Angle (°)
              </label>
              <input
                type="number"
                name="angle"
                value={form.angle}
                onChange={handleChange}
                placeholder="120"
                className="w-full bg-[#0D131D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-[#3AB0FF] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Resolution
              </label>
              <input
                type="text"
                name="resolution"
                value={form.resolution}
                onChange={handleChange}
                placeholder="1080p"
                className="w-full bg-[#0D131D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-[#3AB0FF] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Frame Rate
              </label>
              <select
                name="frameRate"
                value={form.frameRate}
                onChange={handleChange}
                className="w-full bg-[#0D131D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-[#3AB0FF] focus:outline-none"
              >
                <option value="15">15 fps</option>
                <option value="25">25 fps</option>
                <option value="30">30 fps</option>
                <option value="60">60 fps</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1.5 uppercase tracking-wider text-[10px]">
                Initial Status
              </label>
              <select className="w-full bg-[#0D131D] border border-slate-700 rounded-xl px-3.5 py-2.5 text-white focus:border-[#3AB0FF] focus:outline-none">
                <option>Online</option>
                <option>Offline</option>
              </select>
            </div>
          </div>

          {/* Feedback Messages */}
          {formError && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl font-bold bg-[#3AB0FF] hover:bg-[#289BEB] text-slate-950 shadow-lg transition-colors flex items-center gap-2"
            >
              {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              Add Camera
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}