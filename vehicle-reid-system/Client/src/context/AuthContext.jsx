import { createContext, useContext, useState, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import axiosInstance from "../api/axiosInstance";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Read the saved session synchronously on the first render, so route guards
  // never see an empty "logged out" state while a valid session is stored.
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const persistSession = useCallback((responseData) => {
    const { token: newToken, user: userFromApi } = responseData;

    let resolvedUser = userFromApi;
    if (!resolvedUser && newToken) {
      try {
        const decoded = jwtDecode(newToken);
        resolvedUser = {
          id: decoded.id || decoded._id,
          name: decoded.name,
          email: decoded.email,
          role: decoded.role,
        };
      } catch (e) {
        resolvedUser = null;
      }
    }

    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(resolvedUser));
    setToken(newToken);
    setUser(resolvedUser);

    return resolvedUser;
  }, []);

  const signup = useCallback(
    async (name, email, password) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axiosInstance.post("/auth/signup", {
          name,
          email,
          password,
        });
        return persistSession(data);
      } catch (err) {
        const message =
          err.response?.data?.message || "Signup failed. Please try again.";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [persistSession]
  );

  // Admin signup — separate backend route, creates a user with role "admin".
  const adminSignup = useCallback(
    async (name, email, password) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axiosInstance.post("/auth/admin-signup", {
          name,
          email,
          password,
        });
        return persistSession(data);
      } catch (err) {
        const message =
          err.response?.data?.message ||
          "Admin signup failed. Please try again.";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [persistSession]
  );

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axiosInstance.post("/auth/login", {
          email,
          password,
        });
        return persistSession(data);
      } catch (err) {
        const message =
          err.response?.data?.message || "Invalid email or password.";
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [persistSession]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    loading,
    error,
    login,
    signup,
    adminSignup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export default AuthContext;