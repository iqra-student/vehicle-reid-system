import { createContext, useContext, useState, useCallback } from "react";
import { jwtDecode } from "jwt-decode";
import axiosInstance from "../api/axiosInstance";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const persistSession = useCallback((responseData) => {
    const { token: newToken, user: userFromApi } = responseData;

    // Prefer the user object the backend returns; fall back to decoding the JWT
    // in case the backend only returns a token.
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
        // NOTE: role is intentionally never sent from the frontend.
        // The backend always forces role: "operator" on signup.
        const { data } = await axiosInstance.post("/auth/signup", {
          name,
          email,
          password,
        });
        const resolvedUser = persistSession(data);
        return resolvedUser;
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

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axiosInstance.post("/auth/login", {
          email,
          password,
        });
        const resolvedUser = persistSession(data);
        return resolvedUser;
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
