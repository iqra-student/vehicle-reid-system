import { useState } from "react";
import { submitCamera } from "../api/cameraApi";
import { useAuth } from "../context/AuthContext";

export default function RegisterCameraPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: "",
    location: "",
    latitude: "",
    longitude: "",
    angle: "",
    resolution: "",
    frameRate: "",
  });
  const [formError, setFormError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      setSuccessMsg(
        data.status === "approved"
          ? "Camera added and live immediately (admin submission)."
          : "Camera submitted for admin approval."
      );
      setForm({
        name: "",
        location: "",
        latitude: "",
        longitude: "",
        angle: "",
        resolution: "",
        frameRate: "",
      });
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to submit camera.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-xl font-semibold text-slate-900 mb-1">
        Register a camera
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {user?.role === "admin"
          ? "As an admin, cameras you add go live immediately."
          : "Submitted cameras require admin approval before going live."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Camera name
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Location description
          </label>
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Main Gate, Sector F-8"
            className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Latitude
            </label>
            <input
              name="latitude"
              type="number"
              step="any"
              value={form.latitude}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Longitude
            </label>
            <input
              name="longitude"
              type="number"
              step="any"
              value={form.longitude}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Angle (°)
            </label>
            <input
              name="angle"
              type="number"
              value={form.angle}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Resolution
            </label>
            <input
              name="resolution"
              value={form.resolution}
              onChange={handleChange}
              placeholder="1920x1080"
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Frame rate
            </label>
            <input
              name="frameRate"
              type="number"
              value={form.frameRate}
              onChange={handleChange}
              className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>
        </div>

        {formError && (
          <p className="text-sm text-red-600" role="alert">
            {formError}
          </p>
        )}
        {successMsg && (
          <p className="text-sm text-emerald-600" role="status">
            {successMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Submitting..." : "Submit camera"}
        </button>
      </form>
    </div>
  );
}