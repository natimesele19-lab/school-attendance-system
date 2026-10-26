"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Fingerprint, ShieldCheck } from "lucide-react";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY));

  useEffect(() => {
    setQueryError(new URLSearchParams(window.location.search).get("error"));
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError("Supabase is not configured. Add the required environment variables and restart the app.");
        return;
      }
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        return;
      }
      window.location.assign("/");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-card lg:grid-cols-2">
        <section className="hidden min-h-[620px] flex-col justify-between bg-forest p-12 text-white lg:flex">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/15 p-3"><Fingerprint size={26} /></div>
            <div><p className="font-semibold">School Staff</p><p className="text-sm text-white/70">Attendance Management</p></div>
          </div>
          <div>
            <p className="ethiopic mb-4 text-3xl font-bold">የሰራተኞች ክትትል</p>
            <h1 className="max-w-md text-4xl font-semibold leading-tight">A clearer, more reliable way to manage school attendance.</h1>
            <p className="mt-5 max-w-md leading-7 text-white/75">Secure access for School Admins and Portal Admins. Your assigned portal is determined by your account.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/75"><ShieldCheck size={18} /> Protected by Supabase authentication</div>
        </section>
        <section className="flex min-h-[620px] flex-col justify-center p-6 sm:p-10 lg:p-12">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="rounded-xl bg-mint p-3 text-forest"><Fingerprint size={24} /></div>
            <div><p className="font-semibold">School Staff</p><p className="text-xs text-slate-500">Attendance Management</p></div>
          </div>
          <p className="ethiopic text-sm font-semibold text-forest">ደህንነቱ የተጠበቀ መግቢያ</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in with your assigned school or platform administrator account.</p>
          {queryError && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{queryError === "assignment" ? "Your School Admin account does not have a school assignment yet." : queryError === "lookup" ? "We could not verify your account role. Please try again or contact your system administrator." : "This account is not assigned to either supported portal."}</p>}
          {!configured && <p role="alert" className="mt-5 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800">Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code>, add your project URL and anon key, then restart.</p>}
          <form className="mt-8 space-y-5" onSubmit={signIn}>
            <label className="block text-sm font-medium text-slate-700">Email address
              <input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-forest" placeholder="you@school.edu.et" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Password
              <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-forest" placeholder="Enter your password" />
            </label>
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button disabled={!configured || busy} className="min-h-12 w-full rounded-xl bg-forest px-4 py-3 font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Signing in…" : "Sign in securely"}</button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-slate-400">Access is provisioned by your system administrator. There is no public sign-up or worker portal.</p>
        </section>
      </div>
    </main>
  );
}
