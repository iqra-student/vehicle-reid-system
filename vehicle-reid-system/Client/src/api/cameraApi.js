import axiosInstance from "./axiosInstance";

export const submitCamera = (cameraData) =>
  axiosInstance.post("/cameras", cameraData);

export const getApprovedCameras = () =>
  axiosInstance.get("/cameras");

export const getPendingCameras = () =>
  axiosInstance.get("/cameras/pending");

export const getMyRequests = () =>
  axiosInstance.get("/cameras/my-requests");

export const approveCamera = (id) =>
  axiosInstance.put(`/cameras/${id}/approve`);

export const rejectCamera = (id, reason) =>
  axiosInstance.put(`/cameras/${id}/reject`, { reason });