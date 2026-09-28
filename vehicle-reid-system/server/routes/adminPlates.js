const express = require("express");
const router = express.Router();
const PlateVehicle = require("../models/PlateVehicle"); // adjust path if your model lives elsewhere

// GET /api/admin/recent-plates
// Returns the 5 most recently updated plate vehicles + total count
router.get("/recent-plates", async (req, res) => {
  try {
    const plates = await PlateVehicle.find({})
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    const totalCount = await PlateVehicle.countDocuments();

    return res.json({
      status: "success",
      totalCount,
      plates,
    });
  } catch (err) {
    console.error("Recent plates error:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to fetch recent plate reads",
    });
  }
});

module.exports = router;