/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User, Achievement, Template } from "./types";

const BASE_URL = "";

// Helper to manage auth token in local/session storage
export function getToken(): string | null {
  return localStorage.getItem("c_memo_token") || sessionStorage.getItem("c_memo_token");
}

export function setToken(token: string, remember: boolean = false): void {
  if (remember) {
    localStorage.setItem("c_memo_token", token);
    sessionStorage.removeItem("c_memo_token");
  } else {
    sessionStorage.setItem("c_memo_token", token);
    localStorage.removeItem("c_memo_token");
  }
}

export function removeToken(): void {
  localStorage.removeItem("c_memo_token");
  sessionStorage.removeItem("c_memo_token");
}

export function getSavedUser(): User | null {
  const userStr = localStorage.getItem("c_memo_user") || sessionStorage.getItem("c_memo_user");
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

export function setSavedUser(user: User, remember: boolean = false): void {
  if (remember) {
    localStorage.setItem("c_memo_user", JSON.stringify(user));
    sessionStorage.removeItem("c_memo_user");
  } else {
    sessionStorage.setItem("c_memo_user", JSON.stringify(user));
    localStorage.removeItem("c_memo_user");
  }
}

export function removeSavedUser(): void {
  localStorage.removeItem("c_memo_user");
  sessionStorage.removeItem("c_memo_user");
}

// Global headers injection helper
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// API request wrapper
async function apiRequest<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: any
): Promise<T> {
  const config: RequestInit = {
    method,
    headers: getHeaders(),
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (err: any) {
    console.error("Network Fetch Error:", err);
    throw new Error("サーバーとの通信に失敗しました。インターネット接続環境か、開発サーバーの起動状態を確認してください。");
  }

  let data: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch (parseErr) {
      console.error("JSON Parse Error:", parseErr);
    }
  } else {
    try {
      const text = await response.text();
      console.warn("Non-JSON Server Response Received:", text);
    } catch {
      // Ignore text fetch faults
    }
  }

  if (!response.ok) {
    const errorMsg = data?.error || `通信エラーが発生しました（ステータスコード: ${response.status}）`;
    throw new Error(errorMsg);
  }

  if (data === null) {
    throw new Error("サーバーから応答データを取得できませんでした。");
  }

  return data as T;
}

// Export specific operations
export const authApi = {
  async register(username: string, password: string, secretPhrase?: string, remember: boolean = false) {
    const data = await apiRequest<{ token: string; user: User }>(
      "/api/auth/register",
      "POST",
      { username, password, secretPhrase }
    );
    setToken(data.token, remember);
    setSavedUser(data.user, remember);
    return data;
  },

  async login(username: string, password: string, remember: boolean = false) {
    const data = await apiRequest<{ token: string; user: User }>(
      "/api/auth/login",
      "POST",
      { username, password }
    );
    setToken(data.token, remember);
    setSavedUser(data.user, remember);
    return data;
  },

  async logout() {
    try {
      await apiRequest<{ success: boolean }>("/api/auth/logout", "POST");
    } catch {
      // Ignore network errors on logout to allow clean local clear
    }
    removeToken();
    removeSavedUser();
  },

  async changePassword(oldPassword: string, newPassword: string) {
    return apiRequest<{ success: boolean; message: string }>(
      "/api/auth/change-password",
      "POST",
      { oldPassword, newPassword }
    );
  },

  async resetPassword(username: string, secretPhrase: string, newPassword: string) {
    return apiRequest<{ success: boolean; message: string }>(
      "/api/auth/reset-password",
      "POST",
      { username, secretPhrase, newPassword }
    );
  }
};

export const achievementApi = {
  async list(search?: string): Promise<Achievement[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return apiRequest<Achievement[]>(`/api/achievements${query}`, "GET");
  },

  async create(text: string, date: string): Promise<Achievement> {
    return apiRequest<Achievement>("/api/achievements", "POST", { text, date });
  },

  async update(id: string, text: string): Promise<Achievement> {
    return apiRequest<Achievement>(`/api/achievements/${id}`, "PUT", { text });
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(
      `/api/achievements/${id}`,
      "DELETE"
    );
  }
};

export const templateApi = {
  async list(): Promise<Template[]> {
    return apiRequest<Template[]>("/api/templates", "GET");
  },

  async create(text: string): Promise<Template> {
    return apiRequest<Template>("/api/templates", "POST", { text });
  },

  async update(id: string, text: string): Promise<Template> {
    return apiRequest<Template>(`/api/templates/${id}`, "PUT", { text });
  },

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(
      `/api/templates/${id}`,
      "DELETE"
    );
  }
};
