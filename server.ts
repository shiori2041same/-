import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

// Ensure Data Directories exist safely
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, "users.json");
const ACHIEVEMENTS_FILE = path.join(DATA_DIR, "achievements.json");
const TEMPLATES_FILE = path.join(DATA_DIR, "templates.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

// Define Default Templates to seed new users
const DEFAULT_TEMPLATES = [
  "起きられた",
  "ご飯を食べた",
  "薬を飲めた",
  "外に出られた",
  "誰かと話せた",
  "休むことができた",
  "お風呂に入れた",
  "水分補給できた"
];

// Structural reading and writing with safe fallbacks
function readJSON<T>(filePath: string, defaultVal: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), "utf8");
      return defaultVal;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data) as T;
  } catch (err) {
    console.error(`Error reading file ${filePath}, falling back.`, err);
    return defaultVal;
  }
}

function writeJSON<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Error writing file ${filePath}`, err);
  }
}

// Memory & File-backed session tracking to avoid user logouts on restarts
interface Session {
  token: string;
  userId: string;
  username: string;
  expiresAt: number;
}

let activeSessions: Session[] = readJSON<Session[]>(SESSIONS_FILE, []);

// Purge expired sessions
function cleanupSessions() {
  const now = Date.now();
  const initialLen = activeSessions.length;
  activeSessions = activeSessions.filter((s) => s.expiresAt > now);
  if (activeSessions.length !== initialLen) {
    writeJSON(SESSIONS_FILE, activeSessions);
  }
}
cleanupSessions();

// Hash Passwords cleanly using Node's cryptographic PBKDF2
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 12000, 64, "sha512").toString("hex");
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Clean and sanitize text to prevent HTML/XSS injection
function sanitizeInput(text: string): string {
  if (typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>/g, "") // Strip raw HTML tags entirely
    .replace(/[\r\n]+/g, " ") // Flatten linebreaks to preserve single line format
    .trim();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple Rate Limiting Map
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  app.use((req, res, next) => {
    const ip = (req.headers["x-forwarding-for"] as string) || req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const limitWindow = 60000; // 1 minute
    const maxRequests = 200; // Max requests per window

    const record = rateLimitMap.get(ip);
    if (!record || now > record.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + limitWindow });
      next();
    } else {
      record.count++;
      if (record.count > maxRequests) {
        return res.status(429).json({
          error: "頻繁な操作を検知しました。少し時間を置いてもう一度お試しください。"
        });
      }
      next();
    }
  });

  // Bearer Token Validation Middleware
  function authenticateToken(req: any, res: any, next: any) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "ログインしてください。" });
    }

    cleanupSessions();
    const session = activeSessions.find((s) => s.token === token);
    if (!session) {
      return res.status(403).json({ error: "セッションの有効期限が切れたか、無効です。再度ログインしてください。" });
    }

    req.user = { id: session.userId, username: session.username };
    next();
  }

  // ----------------------------------------------------
  // AUTH API ENDPOINTS
  // ----------------------------------------------------

  // Sign Up / Register
  app.post("/api/auth/register", (req, res) => {
    try {
      const usernameRaw = req.body.username;
      const passwordRaw = req.body.password;
      const secretPhraseRaw = req.body.secretPhrase;

      if (!usernameRaw || !passwordRaw) {
        return res.status(400).json({ error: "IDとパスワードを入力してください。" });
      }

      const username = sanitizeInput(usernameRaw).toLowerCase();
      const password = passwordRaw.toString(); // Do not sanitize password (can contain special symbols)
      const secretPhrase = secretPhraseRaw ? sanitizeInput(secretPhraseRaw) : "";

      if (username.length < 3) {
        return res.status(400).json({ error: "IDは3文字以上で入力してください。" });
      }
      if (password.length < 4) {
        return res.status(400).json({ error: "パスワードは4文字以上で入力してください。" });
      }

      const users = readJSON<any[]>(USERS_FILE, []);
      // Prevent duplicate username
      if (users.some((u) => u.username === username)) {
        return res.status(400).json({ error: "このIDは既に使用されています。別のIDをお試しください。" });
      }

      const salt = generateSalt();
      const passwordHash = hashPassword(password, salt);

      let secretPhraseHash = "";
      let secretPhraseSalt = "";
      if (secretPhrase) {
        secretPhraseSalt = generateSalt();
        secretPhraseHash = hashPassword(secretPhrase.toLowerCase(), secretPhraseSalt);
      }

      const userId = crypto.randomUUID();
      const newUser = {
        id: userId,
        username,
        passwordHash,
        salt,
        secretPhraseHash,
        secretPhraseSalt,
        createdAt: Date.now()
      };

      users.push(newUser);
      writeJSON(USERS_FILE, users);

      // Instantly seed custom templates with default suggestions
      const templates = readJSON<any[]>(TEMPLATES_FILE, []);
      DEFAULT_TEMPLATES.forEach((title) => {
        templates.push({
          id: crypto.randomUUID(),
          userId: userId,
          text: title
        });
      });
      writeJSON(TEMPLATES_FILE, templates);

      // Create Active Session
      const token = crypto.randomBytes(32).toString("hex");
      const session: Session = {
        token,
        userId,
        username,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 day lifespan
      };
      activeSessions.push(session);
      writeJSON(SESSIONS_FILE, activeSessions);

      res.status(201).json({
        token,
        user: { id: userId, username }
      });
    } catch (e: any) {
      res.status(500).json({ error: "登録中にエラーが発生しました。" });
    }
  });

  // Login
  app.post("/api/auth/login", (req, res) => {
    try {
      const usernameRaw = req.body.username;
      const passwordRaw = req.body.password;

      if (!usernameRaw || !passwordRaw) {
        return res.status(400).json({ error: "IDとパスワードを入力してください。" });
      }

      const username = sanitizeInput(usernameRaw).toLowerCase();
      const password = passwordRaw.toString();

      const users = readJSON<any[]>(USERS_FILE, []);
      const user = users.find((u) => u.username === username);

      if (!user) {
        return res.status(400).json({ error: "IDまたはパスワードが正しくありません。" });
      }

      const matchHash = hashPassword(password, user.salt);
      if (matchHash !== user.passwordHash) {
        return res.status(400).json({ error: "IDまたはパスワードが正しくありません。" });
      }

      // Generate Session Token
      const token = crypto.randomBytes(32).toString("hex");
      const session: Session = {
        token,
        userId: user.id,
        username: user.username,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000
      };
      activeSessions.push(session);
      writeJSON(SESSIONS_FILE, activeSessions);

      res.json({
        token,
        user: { id: user.id, username: user.username }
      });
    } catch (e) {
      res.status(500).json({ error: "ログイン処理中にエラーが発生しました。" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      activeSessions = activeSessions.filter((s) => s.token !== token);
      writeJSON(SESSIONS_FILE, activeSessions);
    }
    res.json({ success: true });
  });

  // Update Password
  app.post("/api/auth/change-password", authenticateToken, (req: any, res) => {
    try {
      const oldPassword = req.body.oldPassword;
      const newPassword = req.body.newPassword;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ error: "現在のパスワードと新しいパスワードを入力してください。" });
      }

      if (newPassword.length < 4) {
        return res.status(400).json({ error: "新しいパスワードは4文字以上である必要があります。" });
      }

      const users = readJSON<any[]>(USERS_FILE, []);
      const userIndex = users.findIndex((u) => u.id === req.user.id);
      if (userIndex === -1) {
        return res.status(404).json({ error: "ユーザーが見つかりません。" });
      }

      const user = users[userIndex];
      const verifyHash = hashPassword(oldPassword.toString(), user.salt);
      if (verifyHash !== user.passwordHash) {
        return res.status(400).json({ error: "現在のパスワードが間違っています。" });
      }

      // Hash and update
      const newSalt = generateSalt();
      user.salt = newSalt;
      user.passwordHash = hashPassword(newPassword.toString(), newSalt);

      users[userIndex] = user;
      writeJSON(USERS_FILE, users);

      res.json({ success: true, message: "パスワードを変更しました。" });
    } catch (e) {
      res.status(500).json({ error: "パスワード変更中にエラーが発生しました。" });
    }
  });

  // Reset Password via Secret Phrase (ひみつの合言葉)
  app.post("/api/auth/reset-password", (req, res) => {
    try {
      const usernameRaw = req.body.username;
      const secretPhraseRaw = req.body.secretPhrase;
      const newPasswordRaw = req.body.newPassword;

      if (!usernameRaw || !secretPhraseRaw || !newPasswordRaw) {
        return res.status(400).json({ error: "ID、ひみつの合言葉、新しいパスワードを入力してください。" });
      }

      const username = sanitizeInput(usernameRaw).toLowerCase();
      const secretPhrase = sanitizeInput(secretPhraseRaw).toLowerCase();
      const newPassword = newPasswordRaw.toString();

      if (newPassword.length < 4) {
        return res.status(400).json({ error: "新しいパスワードは4文字以上で入力してください。" });
      }

      const users = readJSON<any[]>(USERS_FILE, []);
      const userIndex = users.findIndex((u) => u.username === username);
      if (userIndex === -1) {
        return res.status(400).json({ error: "ID、またはひみつの合言葉が一致しません。" });
      }

      const user = users[userIndex];
      if (!user.secretPhraseHash || !user.secretPhraseSalt) {
        return res.status(400).json({ error: "このアカウントには「ひみつの合言葉」が設定されていません。" });
      }

      const verifyPhraseHash = hashPassword(secretPhrase, user.secretPhraseSalt);
      if (verifyPhraseHash !== user.secretPhraseHash) {
        return res.status(400).json({ error: "ID、またはひみつの合言葉が一致しません。" });
      }

      // Set and hash new password
      const newSalt = generateSalt();
      user.salt = newSalt;
      user.passwordHash = hashPassword(newPassword, newSalt);

      users[userIndex] = user;
      writeJSON(USERS_FILE, users);

      res.json({ success: true, message: "パスワードをリセットしました。新しいパスワードでログインしてください。" });
    } catch (e) {
      res.status(500).json({ error: "パスワードリセット中にエラーが発生しました。" });
    }
  });

  // ----------------------------------------------------
  // ACHIEVEMENTS ENDPOINTS
  // ----------------------------------------------------

  // Get Achievements (optionally with search string)
  app.get("/api/achievements", authenticateToken, (req: any, res) => {
    try {
      const userId = req.user.id;
      const searchQuery = req.query.search ? sanitizeInput(req.query.search as string).toLowerCase() : "";

      const achievements = readJSON<any[]>(ACHIEVEMENTS_FILE, []);
      let userAchievements = achievements.filter((a) => a.userId === userId);

      if (searchQuery) {
        userAchievements = userAchievements.filter((a) =>
          a.text.toLowerCase().includes(searchQuery)
        );
      }

      // Sort: Date descending, and within same date, creation order (newest first)
      userAchievements.sort((a, b) => {
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        return b.createdAt - a.createdAt;
      });

      res.json(userAchievements);
    } catch (e) {
      res.status(500).json({ error: "記録の読み込み中にエラーが発生しました。" });
    }
  });

  // Add achievement
  app.post("/api/achievements", authenticateToken, (req: any, res) => {
    try {
      const textRaw = req.body.text;
      const dateRaw = req.body.date; // YYYY-MM-DD from client's timezone

      if (!textRaw) {
        return res.status(400).json({ error: "できたことを入力してください。" });
      }

      const text = sanitizeInput(textRaw);
      if (!text) {
        return res.status(400).json({ error: "できたことが空白です。" });
      }

      let date = dateRaw ? sanitizeInput(dateRaw) : new Date().toISOString().split("T")[0];

      const achievements = readJSON<any[]>(ACHIEVEMENTS_FILE, []);
      const newAchievement = {
        id: crypto.randomUUID(),
        userId: req.user.id,
        text,
        date,
        createdAt: Date.now()
      };

      achievements.push(newAchievement);
      writeJSON(ACHIEVEMENTS_FILE, achievements);

      res.status(201).json(newAchievement);
    } catch (e) {
      res.status(500).json({ error: "記録の保存中にエラーが発生しました。" });
    }
  });

  // Edit achievement
  app.put("/api/achievements/:id", authenticateToken, (req: any, res) => {
    try {
      const id = req.params.id;
      const textRaw = req.body.text;

      if (!textRaw) {
        return res.status(400).json({ error: "できたことを入力してください。" });
      }

      const text = sanitizeInput(textRaw);
      if (!text) {
        return res.status(400).json({ error: "できたことが空白です。" });
      }

      const achievements = readJSON<any[]>(ACHIEVEMENTS_FILE, []);
      const index = achievements.findIndex((a) => a.id === id);

      if (index === -1) {
        return res.status(404).json({ error: "記録が見つかりません。" });
      }

      // Check ownership
      if (achievements[index].userId !== req.user.id) {
        return res.status(403).json({ error: "変更する権限がありません。" });
      }

      achievements[index].text = text;
      writeJSON(ACHIEVEMENTS_FILE, achievements);

      res.json(achievements[index]);
    } catch (e) {
      res.status(500).json({ error: "記録の更新中にエラーが発生しました。" });
    }
  });

  // Delete achievement
  app.delete("/api/achievements/:id", authenticateToken, (req: any, res) => {
    try {
      const id = req.params.id;

      const achievements = readJSON<any[]>(ACHIEVEMENTS_FILE, []);
      const index = achievements.findIndex((a) => a.id === id);

      if (index === -1) {
        return res.status(404).json({ error: "記録が見つかりません。" });
      }

      // Check ownership
      if (achievements[index].userId !== req.user.id) {
        return res.status(403).json({ error: "削除する権限がありません。" });
      }

      achievements.splice(index, 1);
      writeJSON(ACHIEVEMENTS_FILE, achievements);

      res.json({ success: true, message: "削除しました。" });
    } catch (e) {
      res.status(500).json({ error: "記録の削除中にエラーが発生しました。" });
    }
  });

  // ----------------------------------------------------
  // TEMPLATES ENDPOINTS
  // ----------------------------------------------------

  // Get Custom Templates
  app.get("/api/templates", authenticateToken, (req: any, res) => {
    try {
      const userId = req.user.id;
      const templates = readJSON<any[]>(TEMPLATES_FILE, []);
      const userTemplates = templates.filter((t) => t.userId === userId);
      res.json(userTemplates);
    } catch (e) {
      res.status(500).json({ error: "テンプレートの読み込み中にエラーが発生しました。" });
    }
  });

  // Create custom template
  app.post("/api/templates", authenticateToken, (req: any, res) => {
    try {
      const textRaw = req.body.text;
      if (!textRaw) {
        return res.status(400).json({ error: "テンプレート内容を入力してください。" });
      }

      const text = sanitizeInput(textRaw);
      if (!text) {
        return res.status(400).json({ error: "テンプレートが空白です。" });
      }

      const templates = readJSON<any[]>(TEMPLATES_FILE, []);
      const newTemplate = {
        id: crypto.randomUUID(),
        userId: req.user.id,
        text
      };

      templates.push(newTemplate);
      writeJSON(TEMPLATES_FILE, templates);

      res.status(201).json(newTemplate);
    } catch (e) {
      res.status(500).json({ error: "テンプレートの保存中にエラーが発生しました。" });
    }
  });

  // Edit custom template
  app.put("/api/templates/:id", authenticateToken, (req: any, res) => {
    try {
      const id = req.params.id;
      const textRaw = req.body.text;

      if (!textRaw) {
        return res.status(400).json({ error: "テンプレート内容を入力してください。" });
      }

      const text = sanitizeInput(textRaw);
      if (!text) {
        return res.status(400).json({ error: "テンプレートが空白です。" });
      }

      const templates = readJSON<any[]>(TEMPLATES_FILE, []);
      const index = templates.findIndex((t) => t.id === id);

      if (index === -1) {
        return res.status(404).json({ error: "テンプレートが見つかりません。" });
      }

      if (templates[index].userId !== req.user.id) {
        return res.status(403).json({ error: "編集する権限がありません。" });
      }

      templates[index].text = text;
      writeJSON(TEMPLATES_FILE, templates);

      res.json(templates[index]);
    } catch (e) {
      res.status(500).json({ error: "テンプレートの更新中にエラーが発生しました。" });
    }
  });

  // Delete custom template
  app.delete("/api/templates/:id", authenticateToken, (req: any, res) => {
    try {
      const id = req.params.id;

      const templates = readJSON<any[]>(TEMPLATES_FILE, []);
      const index = templates.findIndex((t) => t.id === id);

      if (index === -1) {
        return res.status(404).json({ error: "テンプレートが見つかりません。" });
      }

      if (templates[index].userId !== req.user.id) {
        return res.status(403).json({ error: "削除する権限がありません。" });
      }

      templates.splice(index, 1);
      writeJSON(TEMPLATES_FILE, templates);

      res.json({ success: true, message: "テンプレートを削除しました。" });
    } catch (e) {
      res.status(500).json({ error: "テンプレートの削除中にエラーが発生しました。" });
    }
  });

  // ----------------------------------------------------
  // VITE & STATIC FILES INTEGRATION
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in Development mode with Vite Middleware Integrations.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in Production mode.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express application successfully started on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Critical server startup failure:", err);
});
