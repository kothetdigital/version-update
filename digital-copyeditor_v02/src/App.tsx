import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { AUTH_ENABLED, currentUser, login, logout, register, type AuthUser } from "./lib/auth";
import { analyzeWithConfiguredProvider } from "./lib/provider";
import {
  clearProviderConfig,
  GEMINI_MODEL_OPTIONS,
  getProviderConfig,
  isProviderProxyEnabled,
  providerLabel,
  providerReady,
  saveProviderConfig,
  type ProviderConfig,
} from "./lib/provider-config";
import {
  clearLocalData,
  getDraft,
  getHistory,
  getPolicies,
  getTheme,
  saveDraft,
  saveHistory,
  savePolicies,
  saveTheme,
} from "./lib/storage";
import type { EditorialResult, EditingSession, HousePolicy, TargetStyle } from "./lib/types";
import {
  burmeseOnly,
  burmeseOnlyFallback,
  limitSourceText,
  MAX_SOURCE_CHARACTERS,
} from "./lib/editor";

const styleLabels: Record<TargetStyle, string> = {
  SPOKEN: "စကားပြေ (အပြော)",
  WRITTEN: "စကားပြေ (အရေး)",
};
function burmeseNote(value: string) {
  return burmeseOnly(value, burmeseOnlyFallback);
}

function HistoryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="nav-icon">
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5zM8 9h8M8 13h5M8 17h3" />
    </svg>
  );
}

function StyleIcon({ style }: { style: TargetStyle }) {
  return style === "SPOKEN" ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="style-icon">
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4.5A2.5 2.5 0 0 1 5 12.5zM9 8h6M9 11h4" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="style-icon">
      <path d="m14.5 5.5 4 4M5 19l3.2-.8L19.3 7.1a1.8 1.8 0 0 0 0-2.6 1.8 1.8 0 0 0-2.6 0L5.6 15.6zM13 4l7 7" />
    </svg>
  );
}

async function copyText(value: string) {
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard ကို အသုံးပြု၍ မရပါ။");
  await navigator.clipboard.writeText(value);
}

async function readClipboard() {
  if (!navigator.clipboard?.readText) throw new Error("Clipboard ကို အသုံးပြု၍ မရပါ။");
  return navigator.clipboard.readText();
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(AUTH_ENABLED ? currentUser() : null);
  const [theme, setTheme] = useState<"light" | "dark">(getTheme());
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  if (AUTH_ENABLED && !user)
    return (
      <Routes>
        <Route path="/login" element={<AuthPage mode="login" onAuth={setUser} />} />
        <Route path="/register" element={<AuthPage mode="register" onAuth={setUser} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  return (
    <AppShell
      user={user}
      theme={theme}
      onTheme={() => setTheme(theme === "light" ? "dark" : "light")}
      onLogout={() => {
        logout();
        setUser(null);
      }}
    />
  );
}

function AppShell({
  user,
  theme,
  onTheme,
  onLogout,
}: {
  user: AuthUser | null;
  theme: "light" | "dark";
  onTheme: () => void;
  onLogout: () => void;
}) {
  const [provider, setProvider] = useState(getProviderConfig());
  useEffect(() => {
    const refresh = () => setProvider(getProviderConfig());
    window.addEventListener("provider-config-changed", refresh);
    return () => window.removeEventListener("provider-config-changed", refresh);
  }, []);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="topbar">
        <Link to="/editor" className="brand">
          <img src="/primary-logo.png" alt="" className="brand-mark" />
          <span>
            <b>Ko Thet</b>
            <small>Digital _ Copy Editor</small>
          </span>
        </Link>
        <nav aria-label="Primary navigation">
          <NavLink to="/editor">Editor</NavLink>
          <NavLink to="/history" className="nav-with-icon">
            <HistoryIcon />
            <span>History</span>
          </NavLink>
          <NavLink to="/policies">Policies</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="top-actions">
          <span className="demo-badge">
            ● {AUTH_ENABLED ? user?.displayName : providerLabel(provider)}
          </span>
          <button className="icon-button" onClick={onTheme} aria-label="Toggle theme">
            {theme === "light" ? "☾" : "☀"}
          </button>
          {AUTH_ENABLED && (
            <button className="text-button" onClick={onLogout}>
              Logout
            </button>
          )}
        </div>
      </header>
      <main id="main-content" className="page">
        <Routes>
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<HistoryDetailPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/settings" element={<SettingsPage onLogout={onLogout} />} />
          <Route path="*" element={<Navigate to="/editor" replace />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <img src="/primary-logo.png" alt="Ko Thet Digital logo" />
          <div>
            <strong>Ko Thet Digital</strong>
            <span>Burmese Digital Copy Editor</span>
          </div>
        </div>
        <div className="footer-follow">
          <p className="eyebrow">FOLLOW</p>
          <div className="footer-links">
            <a
              className="footer-link"
              href="https://www.facebook.com/KoThetDigital"
              target="_blank"
              rel="noreferrer"
              aria-label="Ko Thet Digital Facebook Page"
            >
              <FooterIcon type="facebook" />
              <span>Ko Thet Digital</span>
            </a>
            <a
              className="footer-link"
              href="https://www.youtube.com/@KoThetDigital"
              target="_blank"
              rel="noreferrer"
              aria-label="Ko Thet Digital YouTube channel"
            >
              <FooterIcon type="youtube" />
              <span>www.youtube.com/@KoThetDigital</span>
            </a>
            <a
              className="footer-link"
              href="https://www.tiktok.com/@kothetdigital01"
              target="_blank"
              rel="noreferrer"
              aria-label="Ko Thet Digital TikTok profile"
            >
              <FooterIcon type="tiktok" />
              <span>www.tiktok.com/@kothetdigital01</span>
            </a>
            <a className="footer-link" href="mailto:kothetdigitalservice@gmail.com">
              <FooterIcon type="email" />
              <span>kothetdigitalservice@gmail.com</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterIcon({ type }: { type: "facebook" | "youtube" | "tiktok" | "email" }) {
  if (type === "facebook") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="footer-icon">
        <path d="M14 8h2V4.5c-.4-.1-1.8-.2-3.1-.2-3.1 0-5.2 1.9-5.2 5.4V13H4v3.9h3.7V24h4.5v-7.1h3.6l.6-3.9h-4.2V10c0-1.1.3-2 1.8-2Z" />
      </svg>
    );
  }
  if (type === "youtube") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="footer-icon">
        <path d="M21.6 7.2a2.9 2.9 0 0 0-2-2C17.8 4.7 12 4.7 12 4.7s-5.8 0-7.6.5a2.9 2.9 0 0 0-2 2C2 9 2 12 2 12s0 3 .4 4.8a2.9 2.9 0 0 0 2 2c1.8.5 7.6.5 7.6.5s5.8 0 7.6-.5a2.9 2.9 0 0 0 2-2C22 15 22 12 22 12s0-3-.4-4.8Z" />
        <path className="footer-icon-cutout" d="m10 15.5 5-3.5-5-3.5z" />
      </svg>
    );
  }
  if (type === "tiktok") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="footer-icon">
        <path d="M15 4c.3 1.8 1.3 3 3 3.6v3.1a7.5 7.5 0 0 1-3-.8v6.2a5.4 5.4 0 1 1-4.7-5.3v3.2a2.2 2.2 0 1 0 1.7 2.1V4z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="footer-icon">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function EditorPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sourceText, setSourceText] = useState(() => limitSourceText(getDraft()));
  const [recoverableDraft, setRecoverableDraft] = useState("");
  const [targetStyle, setTargetStyle] = useState<TargetStyle | null>(null);
  const [gatekeeper, setGatekeeper] = useState(false);
  const [result, setResult] = useState<EditorialResult | null>(null);
  const [clipboardError, setClipboardError] = useState("");
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: getPolicies,
    initialData: getPolicies,
  });
  const activePolicies = useMemo(
    () => policies.data.filter((policy) => policy.isActive),
    [policies.data],
  );
  const importedText = searchParams.get("text");
  const importedStyle = searchParams.get("style");

  useEffect(() => {
    if (!importedText) return;

    const limitedText = limitSourceText(importedText);
    setSourceText(limitedText);
    saveDraft(limitedText);
    if (importedStyle === "SPOKEN" || importedStyle === "WRITTEN") {
      setTargetStyle(importedStyle);
    }
    setSearchParams({}, { replace: true });
  }, [importedStyle, importedText, setSearchParams]);

  const proofread = useMutation({
    mutationFn: (style: TargetStyle) =>
      analyzeWithConfiguredProvider({ sourceText, targetStyle: style, activePolicies }),
    onSuccess: (data) => {
      setResult(data);
      const session: EditingSession = {
        id: crypto.randomUUID(),
        sourceText,
        result: data,
        createdAt: new Date().toISOString(),
      };
      saveHistory([session, ...getHistory()].slice(0, 50));
      queryClient.invalidateQueries({ queryKey: ["history"] });
    },
  });
  function submit() {
    if (!sourceText.trim()) return;
    if (!targetStyle) {
      setGatekeeper(true);
      return;
    }
    proofread.mutate(targetStyle);
  }
  async function pasteSource() {
    try {
      setClipboardError("");
      const value = await readClipboard();
      const limitedValue = limitSourceText(value);
      setSourceText(limitedValue);
      saveDraft(limitedValue);
    } catch (error) {
      setClipboardError(error instanceof Error ? error.message : "Clipboard ကို အသုံးပြု၍ မရပါ။");
    }
  }
  async function copyReport() {
    if (!result) return;
    try {
      setClipboardError("");
      await copyText(
        `# Ko Thet Digital Copy Editor\n\nရေးဟန်: ${styleLabels[result.targetStyle]}\n\n## ပြင်ဆင်ပြီးစာသား\n${result.correctedText}\n\n## မှတ်ချက်များ\n${[...result.structureIssues, ...result.spellingNotes, ...result.grammarNotes].map((item) => `- ${item.original} → ${item.suggestion}: ${burmeseNote(item.explanation)}`).join("\n") || "- ထူးခြားသော ပြင်ဆင်ချက် မရှိပါ။"}`,
      );
    } catch (error) {
      setClipboardError(error instanceof Error ? error.message : "Copy မလုပ်နိုင်ပါ။");
    }
  }
  async function copyCorrectedText() {
    if (!result) return;
    try {
      setClipboardError("");
      await copyText(result.correctedText);
    } catch (error) {
      setClipboardError(error instanceof Error ? error.message : "Copy မလုပ်နိုင်ပါ။");
    }
  }
  const providerConfigured = providerReady(getProviderConfig());
  return (
    <div className="editor-page">
      <section className="hero">
        <div>
          <p className="eyebrow">BURMESE COPY EDITOR</p>
          <h1>စာပြင်အယ်ဒီတာ (မြန်မာစာ)</h1>
          <p className="hero-copy">စာလုံးပေါင်း၊ သဒ္ဒါနှင့် ရေးဟန်ကို ရိုးရှင်းစွာ စစ်ဆေးပြင်ဆင်ပေးပါသည်။</p>
        </div>
        <div className="hero-stamp">
          ✎
          <span>
            Ko Thet Digital မှ
            <br />
            ဖန်တီးထားပါသည်။
          </span>
        </div>
      </section>
      <div className="editor-grid">
        <section className="panel input-panel">
          <div className="panel-head">
            <div>
              <span className="step">01</span>
              <div>
                <p className="eyebrow">STYLE</p>
                <h2>စာရေးဟန် ရွေးချယ်ပါ</h2>
              </div>
            </div>
            <Link to="/policies" className="quiet-link">
              မူဝါဒများ →
            </Link>
          </div>
          <div className="style-options">
            {(Object.keys(styleLabels) as TargetStyle[]).map((style) => (
              <button
                type="button"
                key={style}
                className={`style-option ${targetStyle === style ? "selected" : ""}`}
                onClick={() => {
                  setTargetStyle(style);
                  setGatekeeper(false);
                }}
              >
                <span>{style === "SPOKEN" ? "◌" : "✒"}</span>
                {styleLabels[style]}
              </button>
            ))}
          </div>
          {gatekeeper && (
            <div className="gatekeeper">
              <strong>ရေးဟန် မရွေးချယ်ရသေးပါ</strong>
              <span>စစ်ဆေးမည့် ရေးဟန်ကို အရင်ရွေးချယ်ပေးပါ။</span>
            </div>
          )}
          <div className="panel-head source-head">
            <div>
              <span className="step">02</span>
              <div>
                <p className="eyebrow">SOURCE TEXT</p>
                <h2>စစ်ဆေးလိုသော စာသား</h2>
              </div>
            </div>
            <div className="source-actions">
              <button type="button" className="quiet-button" onClick={pasteSource}>
                Paste
              </button>
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  setRecoverableDraft(sourceText);
                  setSourceText("");
                  saveDraft("");
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <textarea
            className="source-text"
            value={sourceText}
            onChange={(event) => {
              const value = limitSourceText(event.target.value);
              setSourceText(value);
              saveDraft(value);
            }}
            aria-label="Myanmar source text"
            maxLength={MAX_SOURCE_CHARACTERS}
          />
          {recoverableDraft && (
            <div className="draft-recovery">
              <span>ယခင်စာသားကို ပြန်ယူနိုင်ပါသည်။</span>
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  setSourceText(recoverableDraft);
                  saveDraft(recoverableDraft);
                  setRecoverableDraft("");
                }}
              >
                Undo
              </button>
            </div>
          )}
          {clipboardError && <p className="error-text">{clipboardError}</p>}
          {!providerConfigured && (
            <div className="provider-warning">
              API key မထည့်ရသေးပါ။ <Link to="/settings">Settings</Link> ထဲတွင် Gemini သို့မဟုတ် Custom API ကို
              သတ်မှတ်ပါ။
            </div>
          )}
          <button
            type="button"
            className="primary-button"
            disabled={proofread.isPending || !sourceText.trim()}
            onClick={submit}
          >
            {proofread.isPending ? "စစ်ဆေးနေသည်..." : "စာသား စစ်ဆေးပြင်ဆင်မည်  →"}
          </button>
          {proofread.isError && (
            <p className="error-text">
              {proofread.error instanceof Error
                ? proofread.error.message
                : "ဝန်ဆောင်မှုပေးသူ လုပ်ဆောင်မှု မအောင်မြင်ပါ။"}
            </p>
          )}
        </section>
        <section className="panel result-panel">
          <div className="panel-head">
            <div>
              <span className="step result-step">03</span>
              <div>
                <p className="eyebrow">EDITORIAL RESULT</p>
                <h2>ပြင်ဆင်ပြီး ရလဒ်</h2>
              </div>
            </div>
            {result && (
              <div className="result-actions">
                <button type="button" className="quiet-button" onClick={copyCorrectedText}>
                  Copy text
                </button>
                <button type="button" className="quiet-button" onClick={copyReport}>
                  Copy Markdown
                </button>
              </div>
            )}
          </div>
          {!result && (
            <div className="result-empty">
              <div className="empty-orbit">✦</div>
              <h3>ရလဒ်ကို ဒီနေရာမှာ တွေ့ရပါမယ်</h3>
              <p>ဘယ်ဘက်မှာ စာရေးဟန်ရွေးပြီး စာသားကို စစ်ဆေးပါ။</p>
              <span>တိုက်ပိုင်မူဝါဒ {activePolicies.length} ခု အသုံးပြုနေသည်</span>
            </div>
          )}
          {result && <ResultView result={result} />}
        </section>
      </div>
    </div>
  );
}

function ResultView({ result }: { result: EditorialResult }) {
  const notes = [...result.structureIssues, ...result.spellingNotes, ...result.grammarNotes];
  return (
    <div className="result-content">
      <div className="applied-row">
        <span className="applied-badge style-badge">
          <StyleIcon style={result.targetStyle} />
          <span>{styleLabels[result.targetStyle]}</span>
        </span>
        <span className="applied-badge soft">{providerLabel(getProviderConfig())}</span>
      </div>
      <div className="corrected-box">
        <p className="eyebrow">ပြင်ဆင်ပြီးစာသား</p>
        <p>{result.correctedText}</p>
      </div>
      <div className="notes-section">
        <p className="eyebrow">မှတ်ချက်များ {notes.length > 0 && `· ${notes.length}`}</p>
        {notes.length === 0 ? (
          <p className="muted">ပြင်ဆင်ရန် ထူးခြားသောအချက် မတွေ့ပါ။</p>
        ) : (
          notes.map((item, index) => (
            <div className="note-row" key={`${item.original}-${index}`}>
              <span className="note-arrow">↳</span>
              <div>
                <strong>
                  {item.original} → {item.suggestion}
                </strong>
                <p>{burmeseNote(item.explanation)}</p>
              </div>
            </div>
          ))
        )}
      </div>
      {result.policyNotes.length > 0 && (
        <div className="policy-notes">
          <p className="eyebrow">တိုက်ပိုင်မူဝါဒ</p>
          {result.policyNotes.map((note) => (
            <p key={note}>• {burmeseNote(note)}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryPage() {
  const sessions = useQuery({
    queryKey: ["history"],
    queryFn: getHistory,
    initialData: getHistory,
  });
  return (
    <div className="content-page">
      <PageTitle eyebrow="YOUR WORKSPACE" title="History" subtitle="ယခင် စစ်ဆေးထားသော စာသားများ" />
      {sessions.data.length === 0 ? (
        <EmptyState
          title="History မရှိသေးပါ"
          text="Editor မှာ စာသားစစ်ဆေးပြီးရင် ဒီနေရာမှာ သိမ်းဆည်းပေးပါမယ်။"
        />
      ) : (
        <div className="history-list">
          {sessions.data.map((session) => (
            <Link to={`/history/${session.id}`} className="history-card" key={session.id}>
              <div>
                <span className="applied-badge style-badge">
                  <StyleIcon style={session.result.targetStyle} />
                  <span>{styleLabels[session.result.targetStyle]}</span>
                </span>
                <p>{session.result.correctedText}</p>
                <small>{new Date(session.createdAt).toLocaleString()}</small>
              </div>
              <span className="history-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
function HistoryDetailPage() {
  const { id } = useParams();
  const session = getHistory().find((item) => item.id === id);
  if (!session) return <EmptyState title="Session မတွေ့ပါ" text="ဒီ history entry ကို မတွေ့ရှိပါ။" />;
  return (
    <div className="content-page">
      <Link to="/history" className="back-link">
        ← History သို့ ပြန်သွားရန်
      </Link>
      <PageTitle
        eyebrow="SAVED SESSION"
        title={styleLabels[session.result.targetStyle]}
        subtitle={new Date(session.createdAt).toLocaleString()}
      />
      <div className="saved-source">
        <p className="eyebrow">SOURCE TEXT</p>
        <p>{session.sourceText}</p>
      </div>
      <ResultView result={session.result} />
    </div>
  );
}

function PoliciesPage() {
  const queryClient = useQueryClient();
  const policies = useQuery({
    queryKey: ["policies"],
    queryFn: getPolicies,
    initialData: getPolicies,
  });
  const [ruleText, setRuleText] = useState("");
  const [label, setLabel] = useState("");
  function addPolicy(event: FormEvent) {
    event.preventDefault();
    if (!ruleText.trim()) return;
    const timestamp = new Date().toISOString();
    savePolicies([
      {
        id: crypto.randomUUID(),
        label: label.trim() || "Custom policy",
        ruleText: ruleText.trim(),
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      ...policies.data,
    ]);
    setLabel("");
    setRuleText("");
    queryClient.invalidateQueries({ queryKey: ["policies"] });
  }
  function update(id: string, patch: Partial<HousePolicy>) {
    savePolicies(
      policies.data.map((policy) =>
        policy.id === id ? { ...policy, ...patch, updatedAt: new Date().toISOString() } : policy,
      ),
    );
    queryClient.invalidateQueries({ queryKey: ["policies"] });
  }
  return (
    <div className="content-page">
      <PageTitle
        eyebrow="EDITORIAL SYSTEM"
        title="House policies"
        subtitle="တိုက်ပိုင်မူဝါဒများကို စီမံခန့်ခွဲပါ"
      />
      <form className="add-policy" onSubmit={addPolicy}>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Policy name (optional)"
        />
        <div className="policy-form-row">
          <input
            value={ruleText}
            onChange={(event) => setRuleText(event.target.value)}
            placeholder="ဥပမာ - ကျွန်တော် လို့ မပြင်ဘဲ ကျနော် လို့ပဲ သုံးပါ"
          />
          <button className="primary-button compact">Add policy</button>
        </div>
      </form>
      <div className="policy-list">
        {policies.data.map((policy) => (
          <div className={`policy-card ${policy.isActive ? "" : "inactive"}`} key={policy.id}>
            <div>
              <div className="policy-card-title">
                <span className="policy-dot" />
                {policy.label}
              </div>
              <p>{policy.ruleText}</p>
            </div>
            <div className="policy-actions">
              <button
                className="quiet-button"
                onClick={() => update(policy.id, { isActive: !policy.isActive })}
              >
                {policy.isActive ? "Active" : "Enable"}
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  savePolicies(policies.data.filter((item) => item.id !== policy.id));
                  queryClient.invalidateQueries({ queryKey: ["policies"] });
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage({ onLogout }: { onLogout: () => void }) {
  const [config, setConfig] = useState<ProviderConfig>(getProviderConfig());
  const [saved, setSaved] = useState(false);
  function update(patch: Partial<ProviderConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
    setSaved(false);
  }
  function save() {
    saveProviderConfig(config);
    window.dispatchEvent(new Event("provider-config-changed"));
    setSaved(true);
  }
  function clearAllLocalData() {
    if (!window.confirm("Draft, history, policies နှင့် provider setting အားလုံးကို ဖျက်မည်လား?")) return;
    clearLocalData();
    clearProviderConfig();
    window.location.reload();
  }
  return (
    <div className="content-page">
      <PageTitle
        eyebrow="PREFERENCES"
        title="Settings"
        subtitle="သင်၏ editor အတွေ့အကြုံကို စိတ်ကြိုက်ပြင်ဆင်ပါ"
      />
      <section className="settings-section">
        <div className="settings-section-head">
          <div>
            <p className="eyebrow">API KEY PROVIDER</p>
            <h2>Gemini / Custom API</h2>
            <p className="muted provider-required">
              {isProviderProxyEnabled()
                ? "Server proxy ကို အသုံးပြုနေသည်။ Provider secret များကို server environment မှ ဖတ်ပါသည်။"
                : "API key မထည့်ထားပါက proofreading မလုပ်နိုင်ပါ။"}
            </p>
          </div>
          <span className="status-pill">{providerLabel(config)}</span>
        </div>
        <div className="provider-tabs">
          <button
            type="button"
            className={config.kind === "GEMINI" ? "provider-tab active" : "provider-tab"}
            onClick={() => update({ kind: "GEMINI" })}
          >
            Gemini
          </button>
          <button
            type="button"
            className={config.kind === "CUSTOM" ? "provider-tab active" : "provider-tab"}
            onClick={() => update({ kind: "CUSTOM" })}
          >
            Custom
          </button>
        </div>
        {!isProviderProxyEnabled() && (
          <label className="field-label">
            API key
            <input
              type="password"
              value={config.apiKey}
              onChange={(event) => update({ apiKey: event.target.value })}
              placeholder="ထည့်သွင်းရန်"
              autoComplete="off"
            />
          </label>
        )}
        <label className="field-label">
          Model
          {config.kind === "GEMINI" ? (
            <span className="select-wrap">
              <select
                value={config.model}
                onChange={(event) => update({ model: event.target.value })}
                aria-label="Gemini model"
              >
                {!GEMINI_MODEL_OPTIONS.some((model) => model.value === config.model) &&
                  config.model && (
                    <option value={config.model}>Saved model · {config.model}</option>
                  )}
                {GEMINI_MODEL_OPTIONS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label} · {model.hint}
                  </option>
                ))}
              </select>
            </span>
          ) : (
            <input
              value={config.model}
              onChange={(event) => update({ model: event.target.value })}
              placeholder="model-name"
            />
          )}
        </label>
        {config.kind === "CUSTOM" && !isProviderProxyEnabled() && (
          <label className="field-label">
            Custom endpoint
            <input
              value={config.endpoint}
              onChange={(event) => update({ endpoint: event.target.value })}
              placeholder="https://api.example.com/v1/chat/completions"
            />
          </label>
        )}
        <div className="settings-actions">
          <button type="button" className="primary-button compact" onClick={save}>
            Save provider
          </button>
          {saved && <span className="saved-message">သိမ်းဆည်းပြီးပါပြီ</span>}
        </div>
        <p className="settings-note">
          ဤသော့ကို ဤဘရောက်ဇာ၏ မှတ်ဉာဏ်ထဲတွင်သာ သိမ်းဆည်းထားသည်။ အများသုံးကွန်ပျူတာတွင် မသုံးပါနှင့်။ ချိတ်ဆက်မရပါက ဝန်ဆောင်မှုပေးသူ၏
          ခွင့်ပြုချက်များကို စစ်ဆေးပါ။
        </p>
      </section>
      <div className="settings-card">
        <div>
          <strong>Local data</strong>
          <p>Drafts, policies, and history are stored in this browser.</p>
        </div>
        <button
          type="button"
          className="danger-button clear-data-button"
          onClick={clearAllLocalData}
          title="Clear local data"
          aria-label="Clear local data"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="trash-icon">
            <path d="M4 7h16M9 7V4h6v3m-9 0 1 13h8l1-13M10 11v5M14 11v5" />
          </svg>
          <span>Clear local data</span>
        </button>
      </div>
      {AUTH_ENABLED && (
        <button type="button" className="primary-button compact" onClick={onLogout}>
          Logout
        </button>
      )}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <div className="empty-orbit">✦</div>
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="primary-button compact" to="/editor">
        Open editor
      </Link>
    </div>
  );
}
function AuthPage({
  mode,
  onAuth,
}: {
  mode: "login" | "register";
  onAuth: (user: AuthUser) => void;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const user =
        mode === "login"
          ? await login(email, password)
          : await register(email, displayName, password);
      onAuth(user);
      navigate("/editor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-card">
        <img src="/primary-logo.png" alt="Ko Thet logo" className="brand-mark large" />
        <p className="eyebrow">KO THET DIGITAL</p>
        <h1>{mode === "login" ? "ဝင်ရောက်ရန်" : "အကောင့်ဖန်တီးရန်"}</h1>
        <p className="muted">အကောင့်အသုံးပြုမှုကို ဖွင့်ထားသည်။</p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Display name"
              required
            />
          )}
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="Email"
            required
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="Password (8+ characters)"
            minLength={8}
            required
          />
          <button className="primary-button">
            {mode === "login" ? "ဝင်ရောက်မည်" : "အကောင့်ဖန်တီးမည်"}
          </button>
        </form>
        {error && <p className="error-text">{error}</p>}
        <Link to={mode === "login" ? "/register" : "/login"} className="quiet-link">
          {mode === "login" ? "အကောင့်အသစ် ဖန်တီးရန်" : "အကောင့်ရှိပြီးသားဖြစ်ပါက ဝင်ရန်"}
        </Link>
      </div>
    </main>
  );
}
