import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Users, Shield, User, Mail, Lock, ChevronDown } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/AuthContext";

// Sapphire Veil palette
const MIST = "#E7F0FA";
const STEEL = "#7BA4D0";
const SAPPHIRE = "#2E5E99";
const INK = "#0D2440";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "operator",
};

export default function AdminUsers() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState(emptyForm);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --------------------------------------------------
  // LOAD USERS
  // --------------------------------------------------
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await axiosInstance.get("/admin/users");
      setUsers(response.data.users || []);
    } catch (err) {
      console.error("Load users error:", err);
      setError(err.response?.data?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // --------------------------------------------------
  // FORM HELPERS
  // --------------------------------------------------
  const openCreateModal = () => {
    setEditingUser(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEditModal = (selectedUser) => {
    setEditingUser(selectedUser);
    setForm({
      name: selectedUser.name || "",
      email: selectedUser.email || "",
      password: "",
      role: selectedUser.role || "operator",
    });
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  // --------------------------------------------------
  // CREATE / UPDATE
  // --------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }

    if (!editingUser && !form.password) {
      setError("Password is required for a new user.");
      return;
    }

    if (form.password && form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    try {
      setSaving(true);

      if (editingUser) {
        const response = await axiosInstance.put(`/admin/users/${editingUser.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        });

        setUsers((previous) =>
          previous.map((item) => (item.id === editingUser.id ? response.data.user : item))
        );
        setSuccess("User updated successfully.");
      } else {
        const response = await axiosInstance.post("/admin/users", {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        });

        setUsers((previous) => [response.data.user, ...previous]);
        setSuccess("User created successfully.");
      }

      setTimeout(() => {
        setModalOpen(false);
        setEditingUser(null);
        setForm(emptyForm);
        setSuccess("");
      }, 700);
    } catch (err) {
      console.error("Save user error:", err);
      setError(err.response?.data?.message || "Unable to save user.");
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // DELETE
  // --------------------------------------------------
  const handleDelete = async (selectedUser) => {
    if (selectedUser.id === currentUser?.id) {
      setError("You cannot delete your own account.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedUser.name}'s account?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setError("");
      setSuccess("");
      await axiosInstance.delete(`/admin/users/${selectedUser.id}`);
      setUsers((previous) => previous.filter((item) => item.id !== selectedUser.id));
      setSuccess("User deleted successfully.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      console.error("Delete user error:", err);
      setError(err.response?.data?.message || "Unable to delete user.");
    }
  };

  // --------------------------------------------------
  // FILTER
  // --------------------------------------------------
  const filteredUsers = users.filter((item) => {
    const searchValue = search.toLowerCase().trim();
    const matchesSearch =
      !searchValue ||
      item.name?.toLowerCase().includes(searchValue) ||
      item.email?.toLowerCase().includes(searchValue);
    const matchesRole = roleFilter === "all" || item.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------
  return (
    <div className="min-h-screen p-6 lg:p-8" style={{ backgroundColor: MIST }}>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* PAGE HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SAPPHIRE }} />
              <span className="text-xs font-bold tracking-[0.12em]" style={{ color: SAPPHIRE }}>
                ADMINISTRATION
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight" style={{ color: INK }}>
              User Management
            </h1>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: SAPPHIRE }}>
              Manage operator and administrator accounts across the surveillance system.
            </p>
          </div>

          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            style={{ backgroundColor: INK }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = SAPPHIRE)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = INK)}
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* FEEDBACK */}
        {error && (
          <div
            className="rounded-xl px-5 py-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300"
            style={{ backgroundColor: "#FDF2F2", color: "#B25C50", border: "1px solid #F5D9D6" }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="rounded-xl px-5 py-4 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300"
            style={{ backgroundColor: "#F0FDF4", color: "#3F7654", border: "1px solid #D6E8DC" }}
          >
            {success}
          </div>
        )}

        {/* USER TABLE CARD */}
        <div
          className="bg-white rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg"
          style={{ borderColor: "#D4E2F0", boxShadow: "0 4px 20px rgba(13,36,64,0.04)" }}
        >
          {/* FILTER BAR */}
          <div
            className="p-5 border-b flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
            style={{ borderColor: "#E7F0FA" }}
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: STEEL }} />
              <input
                type="text"
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2"
                style={{
                  border: `1px solid ${MIST}`,
                  backgroundColor: "#FAFCFE",
                  color: INK,
                  focusRingColor: SAPPHIRE,
                }}
              />
            </div>

            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="appearance-none rounded-xl px-4 py-3 pr-10 text-sm outline-none transition-all duration-200 focus:ring-2 cursor-pointer"
                style={{
                  border: `1px solid ${MIST}`,
                  backgroundColor: "#FAFCFE",
                  color: INK,
                }}
              >
                <option value="all">All roles</option>
                <option value="operator">Operators</option>
                <option value="admin">Administrators</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: STEEL }} />
            </div>
          </div>

          {/* TABLE */}
          {loading ? (
            <div className="p-16 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full mx-auto mb-4" style={{ borderColor: SAPPHIRE, borderTopColor: "transparent" }} />
              <p className="text-sm font-medium" style={{ color: SAPPHIRE }}>Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-16 text-center">
              <Users className="w-12 h-12 mx-auto mb-4" style={{ color: STEEL }} />
              <p className="text-base font-semibold" style={{ color: INK }}>No users found</p>
              <p className="text-sm mt-1" style={{ color: STEEL }}>Try changing your search or filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: SAPPHIRE, backgroundColor: MIST }}>
                    <th className="px-6 py-4 font-bold">User</th>
                    <th className="px-6 py-4 font-bold">E-mail</th>
                    <th className="px-6 py-4 font-bold">Role</th>
                    <th className="px-6 py-4 font-bold">Created</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => {
                    const isCurrentUser = item.id === currentUser?.id;
                    return (
                      <tr
                        key={item.id}
                        className="border-t transition-colors duration-150 hover:bg-[#F8FAFD]"
                        style={{ borderColor: "#E7F0FA" }}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: SAPPHIRE }}>
                              {item.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold flex items-center gap-2" style={{ color: INK }}>
                                {item.name}
                                {isCurrentUser && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: MIST, color: SAPPHIRE }}>
                                    YOU
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm" style={{ color: SAPPHIRE }}>
                          {item.email}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              backgroundColor: item.role === "admin" ? MIST : "#F1F5F9",
                              color: item.role === "admin" ? SAPPHIRE : "#61758D",
                            }}
                          >
                            {item.role === "admin" ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                            {item.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm" style={{ color: STEEL }}>
                          {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-2.5 rounded-xl transition-all duration-200 hover:scale-105"
                              style={{ color: SAPPHIRE, backgroundColor: MIST }}
                              title="Edit user"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              disabled={isCurrentUser}
                              className="p-2.5 rounded-xl transition-all duration-200 hover:scale-105 disabled:opacity-30 disabled:cursor-not-allowed"
                              style={{ color: "#B25C50", backgroundColor: "#FDF2F2" }}
                              title={isCurrentUser ? "You cannot delete yourself" : "Delete user"}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* FOOTER */}
          <div className="px-6 py-4 border-t text-xs font-medium" style={{ borderColor: "#E7F0FA", color: STEEL }}>
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D2440]/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-white rounded-2xl border overflow-hidden animate-in zoom-in-95 duration-200"
            style={{ borderColor: "#D4E2F0", boxShadow: "0 24px 80px rgba(13,36,64,0.2)" }}
          >
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#E7F0FA", backgroundColor: MIST }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: INK }}>
                  {editingUser ? "Edit User" : "Add User"}
                </h2>
                <p className="text-xs mt-1" style={{ color: SAPPHIRE }}>
                  {editingUser ? "Update account details and access level." : "Create a new system account."}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 rounded-xl transition-colors hover:bg-white/50"
                disabled={saving}
              >
                <X className="w-5 h-5" style={{ color: SAPPHIRE }} />
              </button>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: INK }}>
                  Full name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: STEEL }} />
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="John Smith"
                    className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2"
                    style={{ border: `1px solid ${MIST}`, backgroundColor: "#FAFCFE", color: INK }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: INK }}>
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: STEEL }} />
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="operator@city.gov"
                    className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2"
                    style={{ border: `1px solid ${MIST}`, backgroundColor: "#FAFCFE", color: INK }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: INK }}>
                  Password
                  {editingUser && <span className="font-normal" style={{ color: STEEL }}> — leave blank to keep current</span>}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: STEEL }} />
                  <input
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2"
                    style={{ border: `1px solid ${MIST}`, backgroundColor: "#FAFCFE", color: INK }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: INK }}>
                  Role
                </label>
                <div className="relative">
                  <Shield className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: STEEL }} />
                  <select
                    name="role"
                    value={form.role}
                    onChange={handleChange}
                    className="w-full appearance-none rounded-xl pl-10 pr-10 py-3 text-sm outline-none transition-all duration-200 focus:ring-2 cursor-pointer"
                    style={{ border: `1px solid ${MIST}`, backgroundColor: "#FAFCFE", color: INK }}
                  >
                    <option value="operator">Operator</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: STEEL }} />
                </div>
              </div>

              {/* MODAL ERROR */}
              {error && (
                <div className="rounded-xl px-4 py-3 text-xs font-medium" style={{ backgroundColor: "#FDF2F2", color: "#B25C50", border: "1px solid #F5D9D6" }}>
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-5 py-3 rounded-xl text-sm font-semibold transition-colors"
                  style={{ color: SAPPHIRE, backgroundColor: MIST }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 disabled:opacity-60 hover:shadow-lg"
                  style={{ backgroundColor: INK }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = SAPPHIRE)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = INK)}
                >
                  {saving ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}