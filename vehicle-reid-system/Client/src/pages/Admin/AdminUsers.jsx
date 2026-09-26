import { useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, X, Users } from "lucide-react";
import axiosInstance from "../../api/axiosInstance";
import { useAuth } from "../../context/AuthContext";

const INK = "#0D2440";
const SAPPHIRE = "#2E5E99";
const STEEL = "#7BA4D0";
const CORAL = "#B25C50";

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

      setError(
        err.response?.data?.message ||
          "Unable to load users."
      );
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

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
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
        const response = await axiosInstance.put(
          `/admin/users/${editingUser.id}`,
          {
            name: form.name,
            email: form.email,
            role: form.role,
            ...(form.password
              ? { password: form.password }
              : {}),
          }
        );

        setUsers((previous) =>
          previous.map((item) =>
            item.id === editingUser.id
              ? response.data.user
              : item
          )
        );

        setSuccess("User updated successfully.");
      } else {
        const response = await axiosInstance.post(
          "/admin/users",
          {
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
          }
        );

        setUsers((previous) => [
          response.data.user,
          ...previous,
        ]);

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

      setError(
        err.response?.data?.message ||
          "Unable to save user."
      );
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

      await axiosInstance.delete(
        `/admin/users/${selectedUser.id}`
      );

      setUsers((previous) =>
        previous.filter(
          (item) => item.id !== selectedUser.id
        )
      );

      setSuccess("User deleted successfully.");

      setTimeout(() => {
        setSuccess("");
      }, 2500);
    } catch (err) {
      console.error("Delete user error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to delete user."
      );
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

    const matchesRole =
      roleFilter === "all" ||
      item.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="space-y-6">

      {/* PAGE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: SAPPHIRE }}
            />

            <span
              className="text-xs font-bold tracking-[0.12em]"
              style={{ color: SAPPHIRE }}
            >
              ADMINISTRATION
            </span>
          </div>

          <h1
            className="text-3xl font-bold"
            style={{ color: INK }}
          >
            User Management
          </h1>

          <p
            className="text-sm mt-2"
            style={{ color: "#5B7390" }}
          >
            Manage operator and administrator accounts across
            the surveillance system.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: INK }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = SAPPHIRE;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = INK;
          }}
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* FEEDBACK */}
      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: "#FBEDEC",
            color: CORAL,
            border: "1px solid #F0D4D0",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="rounded-lg px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: "#EDF5F0",
            color: "#3F7654",
            border: "1px solid #D6E8DC",
          }}
        >
          {success}
        </div>
      )}

      {/* USER TABLE CARD */}
      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{
          borderColor: "#E4EAF2",
          boxShadow: "0 8px 24px rgba(13,36,64,0.05)",
        }}
      >
        {/* FILTER BAR */}
        <div
          className="p-4 border-b flex flex-col md:flex-row gap-3 md:items-center md:justify-between"
          style={{ borderColor: "#E4EAF2" }}
        >
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "#93A2B8" }}
            />

            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none"
              style={{
                border: "1px solid #E4EAF2",
                backgroundColor: "#FAFCFE",
                color: INK,
              }}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{
              border: "1px solid #E4EAF2",
              backgroundColor: "#FAFCFE",
              color: INK,
            }}
          >
            <option value="all">All roles</option>
            <option value="operator">Operators</option>
            <option value="admin">Administrators</option>
          </select>
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="p-12 text-center">
            <p
              className="text-sm"
              style={{ color: "#5B7390" }}
            >
              Loading users...
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center">
            <Users
              className="w-8 h-8 mx-auto mb-3"
              style={{ color: STEEL }}
            />

            <p
              className="text-sm font-semibold"
              style={{ color: INK }}
            >
              No users found
            </p>

            <p
              className="text-xs mt-1"
              style={{ color: "#7C91A9" }}
            >
              Try changing your search or filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="text-left text-[11px] uppercase tracking-wider"
                  style={{
                    color: "#71859D",
                    backgroundColor: "#F8FAFD",
                  }}
                >
                  <th className="px-5 py-3 font-bold">
                    User
                  </th>

                  <th className="px-5 py-3 font-bold">
                    E-mail
                  </th>

                  <th className="px-5 py-3 font-bold">
                    Role
                  </th>

                  <th className="px-5 py-3 font-bold">
                    Created
                  </th>

                  <th className="px-5 py-3 font-bold text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((item) => {
                  const isCurrentUser =
                    item.id === currentUser?.id;

                  return (
                    <tr
                      key={item.id}
                      className="border-t hover:bg-[#FAFCFE] transition-colors"
                      style={{
                        borderColor: "#EAF0F6",
                      }}
                    >
                      <td className="px-5 py-4">
                        <div>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: INK }}
                          >
                            {item.name}
                            {isCurrentUser && (
                              <span
                                className="ml-2 text-[10px] font-bold"
                                style={{ color: SAPPHIRE }}
                              >
                                YOU
                              </span>
                            )}
                          </p>
                        </div>
                      </td>

                      <td
                        className="px-5 py-4 text-sm"
                        style={{ color: "#5B7390" }}
                      >
                        {item.email}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase"
                          style={{
                            backgroundColor:
                              item.role === "admin"
                                ? "#EAF1F8"
                                : "#F1F5F9",
                            color:
                              item.role === "admin"
                                ? SAPPHIRE
                                : "#61758D",
                          }}
                        >
                          {item.role}
                        </span>
                      </td>

                      <td
                        className="px-5 py-4 text-sm"
                        style={{ color: "#7C91A9" }}
                      >
                        {item.createdAt
                          ? new Date(
                              item.createdAt
                            ).toLocaleDateString()
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              openEditModal(item)
                            }
                            className="p-2 rounded-lg transition-colors"
                            style={{
                              color: SAPPHIRE,
                              backgroundColor: "#F0F5FA",
                            }}
                            title="Edit user"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(item)
                            }
                            disabled={isCurrentUser}
                            className="p-2 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                              color: CORAL,
                              backgroundColor: "#FBEDEC",
                            }}
                            title={
                              isCurrentUser
                                ? "You cannot delete yourself"
                                : "Delete user"
                            }
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
        <div
          className="px-5 py-3 border-t text-xs"
          style={{
            borderColor: "#E4EAF2",
            color: "#7C91A9",
          }}
        >
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D2440]/30 backdrop-blur-sm">
          <div
            className="w-full max-w-md bg-white rounded-xl border"
            style={{
              borderColor: "#E4EAF2",
              boxShadow:
                "0 20px 60px rgba(13,36,64,0.18)",
            }}
          >
            {/* MODAL HEADER */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: "#E4EAF2" }}
            >
              <div>
                <h2
                  className="text-lg font-bold"
                  style={{ color: INK }}
                >
                  {editingUser
                    ? "Edit User"
                    : "Add User"}
                </h2>

                <p
                  className="text-xs mt-1"
                  style={{ color: "#71859D" }}
                >
                  {editingUser
                    ? "Update account details and access level."
                    : "Create a new system account."}
                </p>
              </div>

              <button
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-[#F4F7FB]"
                disabled={saving}
              >
                <X
                  className="w-4 h-4"
                  style={{ color: "#71859D" }}
                />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-[#4B617D]">
                  Full name
                </label>

                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="John Smith"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
                  style={{
                    border: "1px solid #E4EAF2",
                    backgroundColor: "#FAFCFE",
                    color: INK,
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-[#4B617D]">
                  E-mail
                </label>

                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="operator@city.gov"
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
                  style={{
                    border: "1px solid #E4EAF2",
                    backgroundColor: "#FAFCFE",
                    color: INK,
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-[#4B617D]">
                  Password
                  {editingUser && (
                    <span className="font-normal text-[#93A2B8]">
                      {" "}
                      — leave blank to keep current
                    </span>
                  )}
                </label>

                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder={
                    editingUser
                      ? "••••••••"
                      : "••••••••"
                  }
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
                  style={{
                    border: "1px solid #E4EAF2",
                    backgroundColor: "#FAFCFE",
                    color: INK,
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 text-[#4B617D]">
                  Role
                </label>

                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm outline-none"
                  style={{
                    border: "1px solid #E4EAF2",
                    backgroundColor: "#FAFCFE",
                    color: INK,
                  }}
                >
                  <option value="operator">
                    Operator
                  </option>

                  <option value="admin">
                    Administrator
                  </option>
                </select>
              </div>

              {/* MODAL ERROR */}
              {error && (
                <div
                  className="rounded-lg px-3 py-2.5 text-xs font-medium"
                  style={{
                    backgroundColor: "#FBEDEC",
                    color: CORAL,
                  }}
                >
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                  style={{
                    color: "#5B7390",
                    backgroundColor: "#F3F6FA",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                  style={{
                    backgroundColor: INK,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingUser
                    ? "Save Changes"
                    : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}