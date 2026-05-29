/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Sparkles, 
  Download, 
  LogOut, 
  Key, 
  Settings, 
  Check, 
  AlertCircle,
  Clock,
  BookOpen,
  ArrowRight,
  ChevronRight,
  Info
} from "lucide-react";
import { User, Achievement, Template, ActiveTab } from "./types";
import { authApi, achievementApi, templateApi, getSavedUser, getToken } from "./api";
import ThemeToggle, { ThemeMode } from "./components/ThemeToggle";

export default function App() {
  // Authentication states
  const [user, setUser] = useState<User | null>(getSavedUser());
  const [token, setToken] = useState<string | null>(getToken());
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("register");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Form states for login/register
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [secretPhrase, setSecretPhrase] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Main UI states
  const [activeTab, setActiveTab] = useState<ActiveTab>("add");
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // App-wide Notification/Feedback states
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");
  const [srAnnouncement, setSrAnnouncement] = useState("");

  // Input states for main actions
  const [newAchievementText, setNewAchievementText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals / Specific action editors
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [editAchievementText, setEditAchievementText] = useState("");

  const [deletingAchievement, setDeletingAchievement] = useState<Achievement | null>(null);

  // Templates Management states
  const [newTemplateText, setNewTemplateText] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editTemplateText, setEditTemplateText] = useState("");
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);

  // Forgot password flow
  const [resetUsername, setResetUsername] = useState("");
  const [resetSecretPhrase, setResetSecretPhrase] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  // Password change in setting
  const [oldPassword, setOldPassword] = useState("");
  const [changeNewPassword, setChangeNewPassword] = useState("");

  // Themes
  const [theme, setTheme] = useState<ThemeMode>(
    (localStorage.getItem("c_memo_theme") as ThemeMode) || "light"
  );

  // Review (Random Quote) state
  const [randomAchievement, setRandomAchievement] = useState<Achievement | null>(null);

  // DOM Refs for focus management
  const mainHeadingRef = useRef<HTMLHeadingElement>(null);
  const dialogConfirmButtonRef = useRef<HTMLButtonElement>(null);
  const announcerLockRef = useRef<HTMLDivElement>(null);

  // Screen Reader polite announcement helper
  const announce = (message: string) => {
    setSrAnnouncement("");
    setTimeout(() => {
      setSrAnnouncement(message);
    }, 120);
  };

  // Toast notifier
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(message);
    setToastType(type);
    announce(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  // Update theme on standard document configuration
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "high-contrast-mode");
    
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "high-contrast") {
      root.classList.add("dark", "high-contrast-mode");
      root.style.setProperty("--theme-bg", "#000000");
    }
    
    localStorage.setItem("c_memo_theme", theme);
  }, [theme]);

  // Load backend records once logged in
  useEffect(() => {
    if (user && token) {
      loadData();
    } else {
      setAchievements([]);
      setTemplates([]);
    }
  }, [user, token]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const achs = await achievementApi.list();
      setAchievements(achs);
      const tpls = await templateApi.list();
      setTemplates(tpls);
    } catch (e: any) {
      showToast(e.message || "データの読み込みに失敗しました。", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Run a search query when typing search
  useEffect(() => {
    if (!user) return;
    const delayDebounce = setTimeout(async () => {
      try {
        const achs = await achievementApi.list(searchQuery);
        setAchievements(achs);
      } catch (e: any) {
        showToast("検索中にエラーが発生しました。", "error");
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, user]);

  // Handle Authentication submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (authMode === "register") {
        if (!username || !password) {
          throw new Error("IDとパスワードは必ず入力してください。");
        }
        const data = await authApi.register(username, password, secretPhrase);
        setUser(data.user);
        setToken(data.token);
        showToast("今日できたことメモへようこそ！登録完了しました。");
      } else if (authMode === "login") {
        if (!username || !password) {
          throw new Error("IDとパスワードを入力してください。");
        }
        const data = await authApi.login(username, password);
        setUser(data.user);
        setToken(data.token);
        showToast("ログインしました。おかえりなさい！");
      }
    } catch (err: any) {
      setAuthError(err.message || "エラーが発生しました。");
      announce(err.message || "エラーが発生しました。");
    } finally {
      setAuthLoading(false);
    }
  };

  // Reset password flow
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await authApi.resetPassword(resetUsername, resetSecretPhrase, resetNewPassword);
      showToast(res.message || "パスワードをリセットしました。ログインしてください。");
      setAuthMode("login");
      setUsername(resetUsername);
      setPassword("");
    } catch (err: any) {
      setAuthError(err.message || "再設定に失敗しました。合言葉が間違っている可能性があります。");
      announce(err.message || "再設定に失敗しました。");
    } finally {
      setAuthLoading(false);
    }
  };

  // Password update within settings
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !changeNewPassword) {
      showToast("パスワードを入力してください。", "error");
      return;
    }
    try {
      const res = await authApi.changePassword(oldPassword, changeNewPassword);
      showToast(res.message || "パスワードを変更しました。");
      setOldPassword("");
      setChangeNewPassword("");
    } catch (err: any) {
      showToast(err.message || "パスワードの変更に失敗しました。", "error");
    }
  };

  // Logout operations
  const handleLogout = async () => {
    await authApi.logout();
    setUser(null);
    setToken(null);
    showToast("ログアウトしました。");
  };

  // Add achievement action
  const handleAddAchievement = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newAchievementText.trim();
    if (!text) {
      showToast("なにかできたことを入力してください。", "error");
      return;
    }

    setIsRefreshing(true);
    try {
      const todayString = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local format safely
      const added = await achievementApi.create(text, todayString);
      setAchievements((prev) => [added, ...prev]);
      setNewAchievementText("");
      showToast(`「${text}」を追加しました。`, "success");
    } catch (err: any) {
      showToast(err.message || "保存できませんでした。", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Preset Template quick touch adder
  const handleQuickAdd = async (text: string) => {
    setIsRefreshing(true);
    try {
      const todayString = new Date().toLocaleDateString("sv-SE");
      const added = await achievementApi.create(text, todayString);
      setAchievements((prev) => [added, ...prev]);
      showToast(`「${text}」を記録に保存しました。`, "success");
    } catch (err: any) {
      showToast(err.message || "保存できませんでした。", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  // Update Achievement editing
  const handleUpdateAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAchievement) return;
    const text = editAchievementText.trim();
    if (!text) {
      showToast("内容を入力してください。", "error");
      return;
    }

    try {
      const updated = await achievementApi.update(editingAchievement.id, text);
      setAchievements(prev => prev.map(a => a.id === updated.id ? updated : a));
      setEditingAchievement(null);
      setEditAchievementText("");
      showToast("記録の内容を編集し、保存しました。");
    } catch (err: any) {
      showToast(err.message || "更新に失敗しました。", "error");
    }
  };

  // Delete Achievement
  const handleDeleteAchievement = async () => {
    if (!deletingAchievement) return;
    try {
      await achievementApi.delete(deletingAchievement.id);
      setAchievements(prev => prev.filter(a => a.id !== deletingAchievement.id));
      showToast("できたことの記録を1件削除しました。");
      setDeletingAchievement(null);
    } catch (err: any) {
      showToast(err.message || "削除に失敗しました。", "error");
    }
  };

  // Add Custom preset template configuration
  const handleAddTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTemplateText.trim();
    if (!text) return;

    try {
      const added = await templateApi.create(text);
      setTemplates(prev => [...prev, added]);
      setNewTemplateText("");
      showToast(`よくある候補に「${text}」を追加しました。`);
    } catch (err: any) {
      showToast(err.message || "テンプレート追加に失敗しました。", "error");
    }
  };

  // Edit custom template
  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    const text = editTemplateText.trim();
    if (!text) return;

    try {
      const updated = await templateApi.update(editingTemplate.id, text);
      setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
      setEditingTemplate(null);
      setEditTemplateText("");
      showToast("候補の文章を変更しました。");
    } catch (err: any) {
      showToast(err.message || "テンプレート更新に失敗しました。", "error");
    }
  };

  // Delete Template configuration
  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    try {
      await templateApi.delete(deletingTemplate.id);
      setTemplates(prev => prev.filter(t => t.id !== deletingTemplate.id));
      showToast("候補を削除しました。");
      setDeletingTemplate(null);
    } catch (err: any) {
      showToast(err.message || "削除に失敗しました。", "error");
    }
  };

  // Review draw random selector
  const drawRandomAchievement = () => {
    if (achievements.length === 0) {
      setRandomAchievement(null);
      return;
    }
    const idx = Math.floor(Math.random() * achievements.length);
    const drawn = achievements[idx];
    setRandomAchievement(drawn);
    
    // Provide user feedback & voice out the announcement
    announce(`前のあなたが残してくれたできたことです： ${drawn.text} （記録日: ${drawn.date}）`);
  };

  // Execute review trigger whenever shifting to tab
  useEffect(() => {
    if (activeTab === "review" && achievements.length > 0) {
      drawRandomAchievement();
    }
  }, [activeTab]);

  // Export functions (txt, csv)
  const handleExport = (format: "txt" | "csv") => {
    if (achievements.length === 0) {
      showToast("エクスポートする記録がありません。", "error");
      return;
    }

    let fileContent = "";
    let mimeType = "text/plain";
    let extension = "txt";

    if (format === "csv") {
      mimeType = "text/csv";
      extension = "csv";
      // BOM to ensure Japanese characters render perfectly in Excel
      fileContent = "\uFEFF";
      fileContent += "日付,できたこと\n";
      achievements.forEach((a) => {
        // Clean double quotes
        const safeText = a.text.replace(/"/g, '""');
        fileContent += `${a.date},"${safeText}"\n`;
      });
    } else {
      fileContent = "【今日できたことメモ 記録一覧】\n\n";
      let currentDate = "";
      achievements.forEach((a) => {
        if (a.date !== currentDate) {
          currentDate = a.date;
          fileContent += `\n■ ${currentDate}\n`;
        }
        fileContent += `・ ${a.text}\n`;
      });
    }

    const blob = new Blob([fileContent], { type: `${mimeType};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `今日できたことメモ_${new Date().toISOString().split("T")[0]}.${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`${format.toUpperCase()}形式でエクスポートファイルを書き出しました。`);
  };

  // Group achievements by date helper
  const groupedAchievements: { [key: string]: Achievement[] } = {};
  achievements.forEach((a) => {
    if (!groupedAchievements[a.date]) {
      groupedAchievements[a.date] = [];
    }
    groupedAchievements[a.date].push(a);
  });

  // Render the authentication view
  if (!user) {
    return (
      <div className={`min-h-screen flex flex-col justify-between transition-colors ${
        theme === "dark" ? "bg-zinc-950 text-zinc-100" : "bg-orange-50/30 text-zinc-900"
      }`}>
        <header className="py-6 px-4 max-w-lg mx-auto w-full text-center border-b border-zinc-200/50 dark:border-zinc-800/50">
          <h1 className="text-3xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 flex items-center justify-center gap-2">
            <Sparkles className="w-8 h-8 fill-amber-500/20 text-amber-500" aria-hidden="true" />
            <span>今日できたことメモ</span>
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-2 text-base font-medium">
            「できなかったこと」ではなく、あなたの「今日できたこと」に目を向けるメモです。
          </p>
        </header>

        <main className="flex-1 w-full max-w-lg mx-auto p-4 flex flex-col justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 md:p-8 shadow-sm border border-zinc-200/80 dark:border-zinc-800">
            {/* Tab to select login or Register */}
            <div className="grid grid-cols-2 gap-2 mb-6" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={authMode === "register"}
                onClick={() => { setAuthMode("register"); setAuthError(null); }}
                className={`py-3 px-2 font-bold text-base md:text-lg border-b-4 rounded-t-md transition-all cursor-pointer ${
                  authMode === "register"
                    ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/35 dark:bg-amber-950/10"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                アカウント登録
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={authMode === "login"}
                onClick={() => { setAuthMode("login"); setAuthError(null); }}
                className={`py-3 px-2 font-bold text-base md:text-lg border-b-4 rounded-t-md transition-all cursor-pointer ${
                  authMode === "login"
                    ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-50/35 dark:bg-amber-950/10"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
                }`}
              >
                ログインする
              </button>
            </div>

            {authError && (
              <div 
                className="mb-4 p-4 rounded-xl border-2 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 text-red-700 dark:text-red-300 flex items-start gap-2 text-sm leading-relaxed"
                role="alert"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{authError}</span>
              </div>
            )}

            {authMode !== "forgot" ? (
              <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reg-username" className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                    ID（おなまえ）
                  </label>
                  <input
                    id="reg-username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="例：たろう（3文字以上）"
                    className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl"
                  />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    ひらがな、英数字などで、あなたの好きな名前（ID）を入力してください。メールアドレスは不要です。
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reg-password" className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                    パスワード
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="例：よく使う数字や安全な言葉（4文字以上）"
                    className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl"
                  />
                </div>

                {authMode === "register" && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2 flex flex-col gap-1.5">
                    <label htmlFor="reg-secret" className="text-base font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      ひみつの合言葉 <span className="text-xs font-normal bg-zinc-100 dark:bg-zinc-850 px-2 py-0.5 rounded text-zinc-500 dark:text-zinc-400">任意</span>
                    </label>
                    <input
                      id="reg-secret"
                      type="text"
                      value={secretPhrase}
                      onChange={(e) => setSecretPhrase(e.target.value)}
                      placeholder="例：すきな食べものは？カレーライス など"
                      className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl animate-fade-in"
                    />
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      パスワードを忘れたときの再設定のために、あなただけが知っている秘密の言葉（合言葉）を登録できます。
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full mt-2 py-4 bg-amber-500 hover:bg-amber-600 text-white dark:text-zinc-950 font-bold text-lg rounded-xl select-none transition-all cursor-pointer min-h-[50px] shadow-sm active:scale-[0.98]"
                >
                  {authLoading ? "確認中..." : authMode === "register" ? "登録して、できたことを書きはじめる" : "ログインして、記録を見る"}
                </button>

                {authMode === "login" && (
                  <button
                    type="button"
                    onClick={() => { setAuthMode("forgot"); setAuthError(null); }}
                    className="text-sm font-medium text-zinc-500 hover:text-amber-600 dark:text-zinc-400 underline py-2 cursor-pointer"
                  >
                    パスワードを忘れました（ひみつの合言葉で再設定）
                  </button>
                )}
              </form>
            ) : (
              /* Password Reset View */
              <form onSubmit={handlePasswordReset} className="flex flex-col gap-4 animate-fade-in">
                <div className="p-3 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 rounded-xl text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  <span className="font-bold text-amber-600 dark:text-amber-400">パスワード再設定フォーム:</span>
                  <br />
                  登録したIDと「ひみつの合言葉」を入力することで、新しいパスワードを作成できます。
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reset-user" className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                    登録しているID
                  </label>
                  <input
                    id="reset-user"
                    type="text"
                    required
                    value={resetUsername}
                    onChange={(e) => setResetUsername(e.target.value)}
                    placeholder="IDを入力"
                    className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reset-phrase" className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                    あなたの「ひみつの合言葉」は何ですか？
                  </label>
                  <input
                    id="reset-phrase"
                    type="text"
                    required
                    value={resetSecretPhrase}
                    onChange={(e) => setResetSecretPhrase(e.target.value)}
                    placeholder="合言葉を入力"
                    className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reset-pass" className="text-base font-bold text-zinc-800 dark:text-zinc-200">
                    新しいパスワード（4文字以上）
                  </label>
                  <input
                    id="reset-pass"
                    type="password"
                    required
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="新しいパスワードを入力"
                    className="w-full px-4 py-3 border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl"
                  />
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white dark:text-zinc-950 font-bold text-lg rounded-xl transition-all cursor-pointer min-h-[50px]"
                  >
                    {authLoading ? "検証中..." : "パスワードを更新する"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthMode("login"); setAuthError(null); }}
                    className="w-full py-3 text-sm font-semibold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 cursor-pointer"
                  >
                    戻る
                  </button>
                </div>
              </form>
            )}
          </div>
        </main>

        <footer className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-600">
          今日できたことメモ &copy; {new Date().getFullYear()} - できたことの習慣化のために
        </footer>
      </div>
    );
  }

  // Render original Application Layout for logged-in user
  return (
    <div className={`min-h-screen flex flex-col justify-between pb-[84px] transition-colors ${
      theme === "dark" ? "bg-zinc-950 text-zinc-100" : "bg-orange-50/15 text-zinc-900"
    }`}>
      {/* Off-screen Screen Readers polite status announcer/box */}
      <div 
        id="announcer-status"
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        ref={announcerLockRef}
      >
        {srAnnouncement}
      </div>

      {/* Floating toast notification wrapper */}
      {toastMessage && (
        <div 
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm p-4 rounded-xl shadow-lg border-2 text-sm font-semibold animate-fade-in flex items-center justify-between bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>{toastMessage}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer text-xs uppercase"
            aria-label="この通知を閉じる"
          >
            閉じる
          </button>
        </div>
      )}

      {/* Accessible Header Section */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/80 dark:bg-zinc-950/85 border-b border-zinc-200/60 dark:border-zinc-800/80 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 
              ref={mainHeadingRef} 
              id="app-heading"
              tabIndex={-1}
              className="text-lg md:text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 flex items-center gap-1.5 focus:outline-none focus:ring-0"
            >
              <Sparkles className="w-5 h-5 fill-amber-500/10 text-amber-500" aria-hidden="true" />
              <span>今日できたことメモ</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* User status tag */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-50/50 dark:bg-amber-950/20 text-xs font-bold rounded-full border border-amber-200/50 text-amber-700 dark:text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>おなまえ: {user.username}さん</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main app navigation wrapper */}
      <main className="flex-1 w-full max-w-xl mx-auto p-4 md:p-6" id="main-content-scroll">
        
        {/* TAB SWITCHBOARD VIEWPORTS */}

        {activeTab === "add" && (
          <section aria-labelledby="tab-add-title" className="flex flex-col gap-6 md:gap-8 max-w-lg mx-auto">
            <h2 id="tab-add-title" className="sr-only">今日のできたことを書く</h2>
            
            {/* Soft encouraging slogan */}
            <div className="bg-amber-50/50 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-200/40 dark:border-amber-900/30 text-center">
              <p className="text-zinc-800 dark:text-zinc-200 text-lg font-bold leading-relaxed">
                今日できたことをひとつ残してみませんか？
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
                「起きられた」「ご飯を食べた」「薬を飲めた」など、ささやかなことで大丈夫です。
              </p>
            </div>

            {/* Simple Form input */}
            <form onSubmit={handleAddAchievement} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label 
                  htmlFor="user-achievement-text" 
                  className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1"
                >
                  小さな達成を記録する
                </label>
                <input
                  id="user-achievement-text"
                  type="text"
                  value={newAchievementText}
                  onChange={(e) => setNewAchievementText(e.target.value)}
                  placeholder="ここにできたことを入力してください"
                  disabled={isRefreshing}
                  className="w-full px-4 py-3.5 text-lg border-2 border-zinc-350 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl transition-all"
                  aria-describedby="text-input-instructions"
                />
                <span id="text-input-instructions" className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  1行で入力します。エンターキーを押すと保存できます。
                </span>
              </div>

              <button
                type="submit"
                disabled={isRefreshing || !newAchievementText.trim()}
                className={`w-full py-4 text-lg font-bold rounded-xl cursor-pointer shadow-sm min-h-[48px] select-none flex items-center justify-center gap-2 border-2 transition-all active:scale-[0.98] ${
                  newAchievementText.trim()
                    ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white dark:text-zinc-950"
                    : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-850 text-zinc-400 dark:text-zinc-650 cursor-not-allowed"
                }`}
              >
                <Plus className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
                <span>この「できたこと」を保存する</span>
              </button>
            </form>

            {/* Quick pre-seeded templates adder list */}
            <div className="flex flex-col gap-3.5 border-t border-zinc-200/50 dark:border-zinc-800 pt-6">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
                <span>ボタンを押すだけで簡単に追加</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                お好みの言葉を1回タップするだけで、すぐに今日のできたこととして保存されます。
              </p>

              {templates.length === 0 ? (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl text-center text-sm text-zinc-400 dark:text-zinc-600 border border-zinc-200/40 dark:border-zinc-800">
                  お気に入り候補がありません。「テンプレート」設定から追加できます。
                </div>
              ) : (
                <ul className="flex flex-wrap gap-2.5" aria-label="かんたん追加用の候補一覧">
                  {templates.map((tpl) => (
                    <li key={tpl.id}>
                      <button
                        type="button"
                        onClick={() => handleQuickAdd(tpl.text)}
                        disabled={isRefreshing}
                        className="px-4 py-2.5 text-base font-medium rounded-full cursor-pointer bg-zinc-100/90 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-855 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 min-h-[44px] flex items-center gap-1.5 transition-all text-left"
                        aria-label={`${tpl.text} を今日のできたことに追加する`}
                      >
                        <Check className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                        <span>{tpl.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === "list" && (
          <section aria-labelledby="tab-list-title" className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 id="tab-list-title" className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
                これまでのできたこと記録
              </h2>
              <span className="text-sm font-semibold px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400">
                合計 {achievements.length} 件
              </span>
            </div>

            {/* Keyword Search field */}
            <div className="relative">
              <label htmlFor="achievement-search" className="sr-only">
                できたことを検索する
              </label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-550">
                <Search className="w-5 h-5" aria-hidden="true" />
              </div>
              <input
                id="achievement-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="記録からキーワードで探す..."
                className="w-full pl-11 pr-4 py-3 border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 cursor-pointer"
                  aria-label="検索キーワードを消去"
                >
                  クリア
                </button>
              )}
            </div>

            {/* Achievements List */}
            {achievements.length === 0 ? (
              <div className="text-center py-12 px-6 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                <Clock className="w-12 h-12 text-zinc-400 dark:text-zinc-600 mx-auto mb-3" aria-hidden="true" />
                <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300">
                  {searchQuery ? "見つかりませんでした" : "まだ記録がありません"}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 max-w-sm mx-auto">
                  {searchQuery 
                    ? "別のキーワードを入力するか、検索クリアをタップしてください。" 
                    : "できたことに大きい小さいはありません。お水が飲めた、起きられた、それだけで立派なできたことです。"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveTab("add")}
                    className="mt-5 px-5 py-3.5 bg-amber-500 hover:bg-amber-600 text-white dark:text-zinc-950 font-bold rounded-xl shadow-sm cursor-pointer transition-all inline-flex items-center gap-2"
                  >
                    <span>書く画面へもどる</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {Object.keys(groupedAchievements).map((date) => (
                  <div key={date} className="flex flex-col gap-3">
                    {/* Header for Date group */}
                    <h3 className="text-base font-extrabold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 sticky top-[53px] bg-white/95 dark:bg-zinc-950/95 py-1.5 border-b border-zinc-200/50 dark:border-zinc-800/60 z-10">
                      <span className="w-1 h-4 rounded bg-amber-500" />
                      <time dateTime={date}>{date.replace(/-/g, "/")}</time>
                    </h3>

                    {/* Timeline items */}
                    <ul className="flex flex-col gap-3" aria-label={`${date} のできたことリスト`}>
                      {groupedAchievements[date].map((item) => (
                        <li 
                          key={item.id}
                          className="flex items-start justify-between gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 rounded-xl transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] min-h-[58px]"
                        >
                          <div className="flex-1 min-w-0 pr-1 py-0.5">
                            {editingAchievement?.id === item.id ? (
                              <form onSubmit={handleUpdateAchievement} className="flex flex-col gap-2.5 w-full">
                                <label htmlFor={`edit-input-${item.id}`} className="sr-only">
                                  記録の変更内容
                                </label>
                                <input
                                  id={`edit-input-${item.id}`}
                                  type="text"
                                  value={editAchievementText}
                                  onChange={(e) => setEditAchievementText(e.target.value)}
                                  className="w-full px-3 py-2 border-2 border-amber-400 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg text-base"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="submit"
                                    className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 text-xs font-bold rounded cursor-pointer"
                                  >
                                    保存
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setEditingAchievement(null); setEditAchievementText(""); }}
                                    className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-350 text-xs font-bold rounded cursor-pointer"
                                  >
                                    とりやめる
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <p className="text-zinc-900 dark:text-zinc-100 text-base font-semibold leading-relaxed break-words">
                                {item.text}
                              </p>
                            )}
                          </div>

                          {!editingAchievement && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => {
                                  setEditingAchievement(item);
                                  setEditAchievementText(item.text);
                                }}
                                className="p-2.5 text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer min-h-[44px]"
                                aria-label="この記録を編集する"
                              >
                                <Edit3 className="w-4.5 h-4.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingAchievement(item);
                                }}
                                className="p-2.5 text-zinc-500 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer min-h-[44px]"
                                aria-label="この記録を削除する"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "templates" && (
          <section aria-labelledby="tab-tpl-title" className="flex flex-col gap-5">
            <h2 id="tab-tpl-title" className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
              候補（テンプレート）の設定
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 -mt-2">
              「できたことを書く」画面に表示される、ワンタップでかんたんに追加できる言葉をカスタマイズできます。
            </p>

            {/* Create dynamic template form */}
            <form onSubmit={handleAddTemplate} className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1">
                <label htmlFor="tpl-add-input" className="sr-only">
                  新しいお気に入り候補を追加する
                </label>
                <input
                  id="tpl-add-input"
                  type="text"
                  value={newTemplateText}
                  onChange={(e) => setNewTemplateText(e.target.value)}
                  placeholder="例：薬を飲んだ、散歩した"
                  className="w-full px-4 py-3 border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-xl"
                />
              </div>
              <button
                type="submit"
                disabled={!newTemplateText.trim()}
                className={`px-5 py-3 font-bold rounded-xl cursor-pointer min-h-[44px] transition-all whitespace-nowrap overflow-hidden border-2 ${
                  newTemplateText.trim()
                    ? "bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:border-zinc-100 dark:text-zinc-950"
                    : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                }`}
              >
                追加
              </button>
            </form>

            {/* Template edit checklist list */}
            <div className="flex flex-col gap-3 mt-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                登録されている候補一覧
              </h3>

              {templates.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 dark:text-zinc-650 font-medium bg-zinc-50 dark:bg-zinc-900/30 rounded-xl">
                  登録してある候補はありません。上の入力欄から作成してください。
                </div>
              ) : (
                <ul className="flex flex-col gap-2.5" aria-label="候補テンプレート一覧">
                  {templates.map((tpl) => (
                    <li 
                      key={tpl.id}
                      className="flex items-center justify-between p-3 px-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
                    >
                      <div className="flex-1 pr-2">
                        {editingTemplate?.id === tpl.id ? (
                          <form onSubmit={handleUpdateTemplate} className="flex gap-2 w-full">
                            <label htmlFor={`edit-tpl-${tpl.id}`} className="sr-only">
                              お気に入り候補内容の編集
                            </label>
                            <input
                              id={`edit-tpl-${tpl.id}`}
                              type="text"
                              value={editTemplateText}
                              onChange={(e) => setEditTemplateText(e.target.value)}
                              className="w-full px-3 py-2 border-2 border-amber-400 bg-zinc-55 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg text-sm"
                              autoFocus
                            />
                            <button 
                              type="submit"
                              className="px-3 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 text-xs font-bold rounded"
                            >
                              保存
                            </button>
                          </form>
                        ) : (
                          <span className="text-zinc-900 dark:text-zinc-100 font-semibold text-base">
                            {tpl.text}
                          </span>
                        )}
                      </div>

                      {!editingTemplate && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingTemplate(tpl);
                              setEditTemplateText(tpl.text);
                            }}
                            className="p-2 text-zinc-500 hover:text-blue-500 dark:hover:text-blue-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer min-h-[40px]"
                            aria-label={`${tpl.text} の内容を変更する`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeletingTemplate(tpl);
                            }}
                            className="p-2 text-zinc-500 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800/60 cursor-pointer min-h-[40px]"
                            aria-label={`${tpl.text} を候補から削除する`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === "review" && (
          <section aria-labelledby="tab-review-title" className="flex flex-col gap-6 max-w-lg mx-auto py-4">
            <h2 id="tab-review-title" className="sr-only">ふりかえり</h2>

            {achievements.length === 0 ? (
              <div className="text-center p-8 bg-zinc-50 dark:bg-zinc-900/55 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                <BookOpen className="w-12 h-12 text-zinc-400 dark:text-zinc-650 mx-auto mb-3" aria-hidden="true" />
                <p className="text-lg font-bold text-zinc-700 dark:text-zinc-200">
                  振り返るための記録がまだありません
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">
                  1件でもできたことを保存すると、ここからいつでもランダムに思い出を振り返り、今のあなたに届けることができます。
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 text-center">
                <div className="bg-amber-50/50 dark:bg-amber-950/20 p-6 md:p-8 rounded-2xl border-2 border-amber-200/50 dark:border-amber-900/30 shadow-sm flex flex-col gap-4">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400 tracking-wide">
                    前のあなたが残してくれた「できたこと」です
                  </p>
                  
                  {randomAchievement ? (
                    <div className="flex flex-col gap-4 animate-fade-in my-2">
                      <p className="text-2xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-relaxed break-words">
                        「 {randomAchievement.text} 」
                      </p>
                      <p className="text-sm font-bold text-zinc-550 dark:text-zinc-400 flex items-center justify-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>保存された日: {randomAchievement.date.replace(/-/g, "/")}</span>
                      </p>
                    </div>
                  ) : (
                    <p className="italic text-zinc-400">読み込み中...</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={drawRandomAchievement}
                    className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-bold text-lg rounded-xl transition-all shadow-sm active:scale-[0.98] cursor-pointer min-h-[50px] flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                    <span>別のできたことを見る</span>
                  </button>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    ランダムに過去のあなたのあたたかい記録を選び出します。
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "account" && (
          <section aria-labelledby="tab-acc-title" className="flex flex-col gap-6 max-w-lg mx-auto">
            <h2 id="tab-acc-title" className="text-xl font-extrabold text-zinc-900 dark:text-zinc-100">
              アカウントと表示設定
            </h2>

            {/* Theme Toggle Component */}
            <ThemeToggle theme={theme} onThemeChange={setTheme} />

            {/* Data Export Block */}
            <div className="p-4 rounded-xl border border-zinc-250 dark:border-zinc-850 p-4 bg-white dark:bg-zinc-900 flex flex-col gap-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Download className="w-5 h-5 text-amber-500" aria-hidden="true" />
                <span>データを持っていき・保存する</span>
              </h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                あなたのこれまでの「できたこと」記録をテキストファイルや表計算ファイルとして書き出して保存できます。
              </p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => handleExport("txt")}
                  className="py-3 px-3 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 hover:bg-zinc-100 transition-all cursor-pointer min-h-[44px]"
                >
                  テキスト (TXT)
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  className="py-3 px-3 rounded-lg border-2 border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-850 text-sm font-bold text-zinc-800 dark:text-zinc-200 hover:border-zinc-400 hover:bg-zinc-100 transition-all cursor-pointer min-h-[44px]"
                >
                  Excel等用 (CSV)
                </button>
              </div>
            </div>

            {/* Password Change Block */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col gap-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                <Key className="w-5 h-5 text-amber-500" aria-hidden="true" />
                <span>パスワードを変更する</span>
              </h3>
              <form onSubmit={handlePasswordChange} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="old-pass" className="text-xs font-bold text-zinc-555 dark:text-zinc-400">
                    現在のパスワード
                  </label>
                  <input
                    id="old-pass"
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="change-new-pass" className="text-xs font-bold text-zinc-555 dark:text-zinc-400">
                    新しいパスワード
                  </label>
                  <input
                    id="change-new-pass"
                    type="password"
                    value={changeNewPassword}
                    onChange={(e) => setChangeNewPassword(e.target.value)}
                    placeholder="4文字以上"
                    className="w-full px-3 py-2 text-sm border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-sm font-bold rounded-lg cursor-pointer transition-all min-h-[42px]"
                >
                  パスワードを更新する
                </button>
              </form>
            </div>

            {/* Logout button */}
            <div className="border-t border-zinc-200/60 dark:border-zinc-800 pt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-4 border-2 border-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400 font-bold rounded-xl transition-all cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" aria-hidden="true" />
                <span>ログアウトする</span>
              </button>
              <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                ログインID: <span className="font-semibold">{user.username}</span>
                <br />
                ログアウトすると、この端末でのパスワード情報の保持が解除され、再ログインが必要になります。
              </p>
            </div>
          </section>
        )}

      </main>

      {/* ACCESSIBLE BOTTOM NAVIGATION TAB BAR */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-250 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2.5 py-2"
        aria-label="主要機能切り替えタブ"
      >
        <div className="max-w-xl mx-auto grid grid-cols-5 gap-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "add"}
            aria-controls="main-content-scroll"
            onClick={() => { setActiveTab("add"); announce("『できたことを書く』画面が表示されました。"); }}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl border transition-all cursor-pointer min-h-[64px] ${
              activeTab === "add"
                ? "bg-amber-500 border-amber-500 text-white dark:text-zinc-950 font-bold"
                : "border-transparent bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <Plus className="w-6 h-6 stroke-[2.5]" aria-hidden="true" />
            <span className="text-xs mt-1 leading-none tracking-tight">書く</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "list"}
            aria-controls="main-content-scroll"
            onClick={() => { setActiveTab("list"); announce("『できたことの一覧』画面を表示しました。"); }}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl border transition-all cursor-pointer min-h-[64px] ${
              activeTab === "list"
                ? "bg-amber-500 border-amber-500 text-white dark:text-zinc-950 font-bold"
                : "border-transparent bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <Clock className="w-6 h-6 stroke-[2]" aria-hidden="true" />
            <span className="text-xs mt-1 leading-none tracking-tight">一覧</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "templates"}
            aria-controls="main-content-scroll"
            onClick={() => { setActiveTab("templates"); announce("『テンプレート設定』画面を表示しました。"); }}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl border transition-all cursor-pointer min-h-[64px] ${
              activeTab === "templates"
                ? "bg-amber-500 border-amber-500 text-white dark:text-zinc-950 font-bold"
                : "border-transparent bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <Settings className="w-6 h-6 stroke-[2]" aria-hidden="true" />
            <span className="text-xs mt-1 leading-none tracking-tight">候補設定</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "review"}
            aria-controls="main-content-scroll"
            onClick={() => { setActiveTab("review"); announce("『ふりかえり』画面を表示しました。"); }}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl border transition-all cursor-pointer min-h-[64px] ${
              activeTab === "review"
                ? "bg-amber-500 border-amber-500 text-white dark:text-zinc-950 font-bold"
                : "border-transparent bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <Sparkles className="w-6 h-6 stroke-[2]" aria-hidden="true" />
            <span className="text-xs mt-1 leading-none tracking-tight">ふりかえり</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "account"}
            aria-controls="main-content-scroll"
            onClick={() => { setActiveTab("account"); announce("『アカウントと設定』画面を表示しました。"); }}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl border transition-all cursor-pointer min-h-[64px] ${
              activeTab === "account"
                ? "bg-amber-500 border-amber-500 text-white dark:text-zinc-950 font-bold"
                : "border-transparent bg-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <Settings className="w-6 h-6 stroke-[2]" aria-hidden="true" />
            <span className="text-xs mt-1 leading-none tracking-tight">おなまえ</span>
          </button>
        </div>
      </nav>

      {/* MODAL WINDOWS USING ARIA ROLE="DIALOG" */}

      {/* Delete Confirmation Modal for Achievement Record */}
      {deletingAchievement && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-modal-title"
          aria-describedby="del-modal-desc"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm border-2 border-zinc-250 dark:border-zinc-805/90 p-5 shadow-xl">
            <h3 id="del-modal-title" className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <AlertCircle className="text-rose-500 w-5 h-5 shrink-0" aria-hidden="true" />
              <span>本当に消しますか？</span>
            </h3>
            
            <p id="del-modal-desc" className="text-sm font-semibold text-zinc-600 dark:text-zinc-350 leading-relaxed mt-2.5">
              あたたかい「できたこと」の記録を削除します。この操作は元に戻せません。
            </p>
            <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-950 border rounded-lg text-sm font-medium italic break-words">
              「 {deletingAchievement.text} 」
            </div>

            <div className="flex gap-2.5 mt-5">
              <button
                ref={dialogConfirmButtonRef}
                onClick={handleDeleteAchievement}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-base rounded-xl cursor-pointer min-h-[46px]"
              >
                消去する
              </button>
              <button
                onClick={() => setDeletingAchievement(null)}
                className="flex-1 py-3 bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-base text-zinc-700 dark:text-zinc-300 rounded-xl cursor-pointer min-h-[46px]"
              >
                残しておく
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Favorite Templates */}
      {deletingTemplate && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-tpl-title"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm border-2 border-zinc-250 dark:border-zinc-800 p-5 shadow-xl">
            <h3 id="del-tpl-title" className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <AlertCircle className="text-rose-500 w-5 h-5" aria-hidden="true" />
              <span>候補を削除しますか？</span>
            </h3>
            
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-355 leading-relaxed mt-2">
              「できたことを書く」画面のボタン候補から、以下の言葉を取り除きます。
            </p>
            <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-950 border rounded-lg text-sm font-medium italic">
              「 {deletingTemplate.text} 」
            </div>

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={handleDeleteTemplate}
                className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-base rounded-xl cursor-pointer min-h-[46px]"
              >
                削除する
              </button>
              <button
                onClick={() => setDeletingTemplate(null)}
                className="flex-1 py-3 bg-zinc-150 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-750 font-bold text-base text-zinc-700 dark:text-zinc-300 rounded-xl cursor-pointer min-h-[46px]"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
