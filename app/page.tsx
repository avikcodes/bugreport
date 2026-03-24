"use client";

import { useState } from "react";

type DiagnoseResult = {
  severity: "Critical" | "Warning" | "Minor" | string;
  what_broke: string;
  exact_fix: string;
  prevention: string;
};

const languages = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "Go",
  "Rust",
];

export default function Home() {
  const [error_message, setErrorMessage] = useState("");
  const [stack_trace, setStackTrace] = useState("");
  const [language, setLanguage] = useState("Python");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleDiagnose = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("http://localhost:8000/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error_message,
          stack_trace,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong while diagnosing the bug.");
        return;
      }

      setResult(data);
    } catch {
      setError("Unable to reach the API. Make sure the backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.exact_fix) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.exact_fix);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const severityStyles: Record<string, string> = {
    Critical: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
    Warning: "bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/30",
    Minor: "bg-green-500/15 text-green-300 ring-1 ring-green-500/30",
  };

  const severityIcons: Record<string, string> = {
    Critical: "🔴",
    Warning: "🟡",
    Minor: "🟢",
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.18),_transparent_34%),linear-gradient(180deg,rgba(20,20,20,0.98),rgba(10,10,10,0.98))] px-6 py-12 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_30px_100px_rgba(0,0,0,0.65)] sm:px-10 sm:py-16">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#ef4444] to-transparent opacity-70" />

          <header className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="inline-flex items-center rounded-full border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.28em] text-[#fca5a5]">
              Open Source • Free Forever
            </div>
            <h1 className="mt-6 text-5xl font-black tracking-tight text-white sm:text-6xl">
              BugReport
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-zinc-300 sm:text-xl">
              Paste any error. Get the exact fix in seconds.
            </p>
            <p className="mt-3 text-sm text-zinc-500 sm:text-base">
              No more Stack Overflow rabbit holes.
            </p>
          </header>

          <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/20 backdrop-blur sm:p-6">
              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="error_message"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Error Message
                  </label>
                  <textarea
                    id="error_message"
                    value={error_message}
                    onChange={(event) => setErrorMessage(event.target.value)}
                    placeholder="Paste your error message here..."
                    className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-[#0f0f0f] px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ef4444]/60 focus:ring-2 focus:ring-[#ef4444]/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="stack_trace"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Stack Trace
                  </label>
                  <textarea
                    id="stack_trace"
                    value={stack_trace}
                    onChange={(event) => setStackTrace(event.target.value)}
                    placeholder="Paste your stack trace here (optional)..."
                    className="min-h-[120px] w-full rounded-2xl border border-white/10 bg-[#0f0f0f] px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[#ef4444]/60 focus:ring-2 focus:ring-[#ef4444]/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="language"
                    className="mb-2 block text-sm font-medium text-zinc-300"
                  >
                    Language
                  </label>
                  <select
                    id="language"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f0f0f] px-4 text-sm text-white outline-none transition focus:border-[#ef4444]/60 focus:ring-2 focus:ring-[#ef4444]/20"
                  >
                    {languages.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleDiagnose}
                  disabled={loading}
                  className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-[#ef4444] px-5 text-sm font-semibold text-white transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Diagnosing...
                    </>
                  ) : (
                    "Diagnose Bug"
                  )}
                </button>
              </div>
            </section>

            <section className="flex min-h-[320px] flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-6">
              {!result && !error ? (
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#fca5a5]">
                      AI Debug Console
                    </p>
                    <h2 className="mt-4 text-2xl font-bold text-white">
                      Ship fixes faster with less guesswork.
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-400">
                      Drop in the raw error, add a stack trace if you have one,
                      and BugReport turns noisy failures into a clear diagnosis,
                      exact fix guidance, and prevention steps your future self
                      will thank you for.
                    </p>
                  </div>

                  <div className="mt-8 grid gap-3 text-sm text-zinc-400 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      Plain-English breakdowns
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      Actionable code-level fixes
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      Prevention guidance for next time
                    </div>
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="rounded-3xl border border-red-500/25 bg-red-500/10 p-5 text-red-100">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-red-300">
                    Error
                  </p>
                  <p className="mt-3 text-sm leading-7 text-red-100/90">{error}</p>
                </div>
              ) : null}

              {result ? (
                <div className="rounded-3xl border border-white/10 bg-[#0d0d0d] p-5 shadow-xl shadow-black/20">
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${
                      severityStyles[result.severity] ||
                      "bg-white/10 text-white ring-1 ring-white/15"
                    }`}
                  >
                    <span>{severityIcons[result.severity] || "•"}</span>
                    <span>{result.severity}</span>
                  </div>

                  <div className="mt-6 space-y-6">
                    <section>
                      <h3 className="text-lg font-semibold text-white">
                        🔍 What Broke
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-zinc-300">
                        {result.what_broke}
                      </p>
                    </section>

                    <section>
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-lg font-semibold text-white">
                          ⚙️ Exact Fix
                        </h3>
                        <button
                          type="button"
                          onClick={handleCopy}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-[#ef4444]/40 hover:text-white"
                        >
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4">
                        <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-zinc-200">
                          {result.exact_fix}
                        </pre>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-lg font-semibold text-white">
                        🛡️ How to Prevent This
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-zinc-300">
                        {result.prevention}
                      </p>
                    </section>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <footer className="mt-12 text-center text-sm text-zinc-500">
            Built by @avikcodes • Project 3 of 30
          </footer>
        </section>
      </div>
    </main>
  );
}
