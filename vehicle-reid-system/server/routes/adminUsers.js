const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

// --------------------------------------------------
// ADMIN-ONLY MIDDLEWARE
// --------------------------------------------------

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
};

// All routes below require:
// 1. Valid JWT
// 2. Admin role
router.use(authMiddleware);
router.use(adminOnly);

// --------------------------------------------------
// GET ALL USERS
// GET /api/admin/users
// --------------------------------------------------

router.get("/", async (req, res) => {
  try {
    const users = await User.find({})
      .select("-password")
      .sort({ createdAt: -1 });

    const formattedUsers = users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));

    res.json({
      status: "success",
      users: formattedUsers,
    });
  } catch (err) {
    console.error("Get users error:", err);

    res.status(500).json({
      message: "Failed to load users",
    });
  }
});

// --------------------------------------------------
// CREATE USER
// POST /api/admin/users
// --------------------------------------------------

router.post("/", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    if (!["operator", "admin"].includes(role)) {
      return res.status(400).json({
        message: "Invalid user role",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        message: "A user already exists with this email",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
    });

    res.status(201).json({
      status: "success",
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("Create user error:", err);

    res.status(500).json({
      message: "Failed to create user",
    });
  }
});

// --------------------------------------------------
// UPDATE USER
// PUT /api/admin/users/:id
// --------------------------------------------------

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!name || !email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    if (!["operator", "admin"].includes(role)) {
      return res.status(400).json({
        message: "Invalid user role",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if another user already owns this email
    const emailOwner = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: id },
    });

    if (emailOwner) {
      return res.status(400).json({
        message: "Another user already uses this email",
      });
    }

    user.name = name.trim();
    user.email = normalizedEmail;
    user.role = role;

    // Password is optional during edit.
    // If empty, existing password remains unchanged.
    if (password && password.trim()) {
      if (password.length < 8) {
        return res.status(400).json({
          message: "Password must be at least 8 characters",
        });
      }

      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    res.json({
      status: "success",
      message: "User updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (err) {
    console.error("Update user error:", err);

    res.status(500).json({
      message: "Failed to update user",
    });
  }
});

// --------------------------------------------------
// DELETE USER
// DELETE /api/admin/users/:id
// --------------------------------------------------

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    // Prevent admin from deleting their own account
    if (req.user.id === id) {
      return res.status(400).json({
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    await User.findByIdAndDelete(id);

    res.json({
      status: "success",
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error("Delete user error:", err);

    res.status(500).json({
      message: "Failed to delete user",
    });
  }
});

module.exports = router;