"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Activity, ArrowDownToLine, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, Fingerprint,
  LogOut, Menu, Plus, Printer, RefreshCw, ScanLine, ShieldCheck, Users, X
} from "lucide-react";

type Staff = { id: string; full_name: string; gender: "ወ" | "ሴ"; job_title: string; biometric_template_hash: string | null };
type RecordRow = { id: string; staff_id: string; date: string; day_of_week: string; check_in_time: string | null; status: "Present" | "Late" | "Absent"; signature_verified: boolean };
type SchoolPayload = { school: { id: string; name: string }; staff: Staff[]; records: RecordRow[] };
type Day = { key: string; label: string; date: Date };

const weekdayAm = ["እሑድ", "ሰኞ", "ማክሰኞ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ"];
const weekdayShortEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });

function ethiopianDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-ethiopic-nu-latn", {
    calendar: "ethiopic", year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Africa/Addis_Ababa"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: value("year"), month: value("month").padStart(2, "0"), day: value("day").padStart(2, "0") };
}

function ethiopianDateKey(date: Date) {
  const parts = ethiopianDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function ethiopianDateLabel(date: Date) {
  return new Intl.DateTimeFormat("am-ET-u-ca-ethiopic", {
    calendar: "ethiopic", year: "numeric", month: "long", day: "numeric", timeZone: "Africa/Addis_Ababa"
  }).format(date);
}

function ethiopianTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const etHour = ((hour + 6) % 12) || 12;
  const suffix = hour >= 6 && hour < 12 ? "ጧት" : hour >= 12 && hour < 18 ? "ከሰዓት" : hour >= 18 ? "ማታ" : "ሌሊት";
  return `${suffix} ${etHour}:${minute}`;
}

function addisTimeOfDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Addis_Ababa", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function getWorkWeek(now: Date): Day[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const addisDate = new Date(Date.UTC(value("year"), value("month") - 1, value("day"), 12));
  const mondayOffset = (addisDate.getUTCDay() + 6) % 7;
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(Date.UTC(value("year"), value("month") - 1, value("day") - mondayOffset + index, 12));
    const weekday = date.getUTCDay();
    return {
      date,
      key: ethiopianDateKey(date),
      label: `${weekdayAm[weekday]} · ${weekdayShortEn[weekday]} ${monthDay.format(date)}`
    };
  });
}

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function useApiError() {
  const [error, setError] = useState("");
  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
    let payload: { error?: string };
    try {
      payload = await response.json();
    } catch {
      throw new Error(`The server returned an invalid response (${response.status}).`);
    }
    if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
    return payload;
  }, []);
  return { error, setError, request };
}

function StatusBadge({ status }: { status: RecordRow["status"] | "—" }) {
  const style = status === "Present" ? "bg-emerald-50 text-emerald-700" : status === "Late" ? "bg-amber-50 text-amber-700" : status === "Absent" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500";
  const text = status === "Present" ? "ተገኝቷል" : status === "Late" ? "ዘግይቷል" : status === "Absent" ? "ቀርቷል" : "—";
  return <span className={`inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-semibold ${style}`}>{text}</span>;
}

function Header({ title, subtitle, role, onSignOut }: { title: string; subtitle: string; role: string; onSignOut: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="no-print sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl bg-mint p-2.5 text-forest"><Fingerprint size={22} /></div>
          <div className="min-w-0"><p className="truncate font-bold text-ink">{title}</p><p className="truncate text-xs text-slate-500">{subtitle}</p></div>
        </div>
        <button aria-label="Toggle account menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 sm:ml-auto">
          <span className="hidden text-slate-500 sm:inline">{role}</span><ChevronDown size={16} /><Menu size={17} className="sm:hidden" />
        </button>
        {menuOpen && <div className="absolute right-4 top-[calc(100%-2px)] w-56 rounded-xl border border-slate-100 bg-white p-2 shadow-card sm:right-8">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{role} portal</p>
          <button onClick={onSignOut} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-slate-700 hover:bg-slate-50"><LogOut size={16} /> Sign out</button>
        </div>}
      </div>
    </header>
  );
}

function signOut() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return;
  void createBrowserClient(url, key).auth.signOut().then(({ error }) => {
    if (error) window.alert(`Unable to sign out: ${error.message}`);
    else window.location.assign("/login");
  });
}

function MetricCard({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone: string }) {
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-card sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-ink">{value}</p></div><div className={`rounded-xl p-3 ${tone}`}>{icon}</div></div>
  </div>;
}

export function SchoolDashboard() {
  const { error, setError, request } = useApiError();
  const [data, setData] = useState<SchoolPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [staffModal, setStaffModal] = useState(false);
  const [scannerModal, setScannerModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState("");
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"ወ" | "ሴ">("ወ");
  const [jobTitle, setJobTitle] = useState("");
  const [scannerStep, setScannerStep] = useState<"ready" | "scanning" | "verified">("ready");
  const now = useClock();
  const days = useMemo(() => now ? getWorkWeek(now) : [], [now ? ethiopianDateKey(now) : ""]);

  const load = useCallback(async () => {
    if (days.length !== 5) return;
    setBusy(true);
    try {
      const result = await request(`/api/dashboard?dates=${days.map((day) => day.key).join(",")}`);
      setData(result as SchoolPayload);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load school data.");
    } finally {
      setBusy(false);
    }
  }, [days, request, setError]);

  useEffect(() => { void load(); }, [load]);

  const todayKey = now ? ethiopianDateKey(now) : "";
  const todayRecords = data?.records.filter((record) => record.date === todayKey) ?? [];
  const presentCount = todayRecords.filter((record) => record.status === "Present").length;
  const lateCount = todayRecords.filter((record) => record.status === "Late").length;
  const absentCount = Math.max(0, (data?.staff.length ?? 0) - todayRecords.filter((record) => record.status !== "Absent").length);

  function currentRecord(staffId: string, dateKey: string) {
    return data?.records.find((record) => record.staff_id === staffId && record.date === dateKey);
  }

  async function updateAttendance(staff: Staff, day: Day, status: RecordRow["status"], verified = false) {
    if (!now) return;
    setError("");
    try {
      await request("/api/attendance", {
        method: "POST",
        body: JSON.stringify({
          staff_id: staff.id,
          date: day.key,
          day_of_week: weekdayAm[day.date.getUTCDay()],
          check_in_time: status === "Absent"
            ? null
            : day.key === todayKey
              ? addisTimeOfDay(now)
              : currentRecord(staff.id, day.key)?.check_in_time ?? null,
          status,
          signature_verified: verified
        })
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save attendance.");
    }
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request("/api/staff", { method: "POST", body: JSON.stringify({ full_name: name, gender, job_title: jobTitle }) });
      setName("");
      setJobTitle("");
      setStaffModal(false);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to register staff.");
    } finally {
      setSaving(false);
    }
  }

  async function simulateScan() {
    const staff = data?.staff.find((person) => person.id === selectedStaff);
    const today = days.find((day) => day.key === todayKey);
    if (!staff || !today) return;
    setScannerStep("scanning");
    window.setTimeout(async () => {
      setScannerStep("verified");
      await updateAttendance(staff, today, "Present", true);
    }, 850);
  }

  function exportCsv() {
    if (!data) return;
    const rows = [["ሙሉ ስም", "ጾታ", "የሥራ ድርሻ", ...days.map((day) => day.label)]];
    for (const staff of data.staff) {
      rows.push([staff.full_name, staff.gender, staff.job_title, ...days.map((day) => {
        const record = currentRecord(staff.id, day.key);
        return record ? `${record.status}${record.check_in_time ? ` (${record.check_in_time})` : ""}` : "";
      })]);
    }
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `weekly-attendance-${todayKey}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <div className="min-h-screen">
    <Header title="የሰራተኞች ክትትል" subtitle={data?.school.name ?? "School attendance"} role="School Admin" onSignOut={signOut} />
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="ethiopic text-sm font-semibold text-forest">{now ? ethiopianDateLabel(now) : "የኢትዮጵያ ቀን"}</p><h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">Weekly attendance</h1><p className="mt-1 text-sm text-slate-500">{now ? `Ethiopian time · ${ethiopianTime(now)}` : "Loading local time…"}</p></div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} disabled={!data} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none sm:px-4"><ArrowDownToLine size={17} /> Export CSV</button>
          <button onClick={() => window.print()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none sm:px-4"><Printer size={17} /> Print report</button>
        </div>
      </section>

      {error && <div role="alert" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")} className="min-h-8 min-w-8"><X size={16} /></button></div>}

      <section aria-label="Today's attendance statistics" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <MetricCard label="Total Staff" value={busy ? "…" : data?.staff.length ?? 0} icon={<Users size={21} />} tone="bg-slate-100 text-slate-600" />
        <MetricCard label="Present Today" value={presentCount} icon={<CheckCircle2 size={21} />} tone="bg-emerald-50 text-emerald-700" />
        <MetricCard label="Late Today" value={lateCount} icon={<Clock3 size={21} />} tone="bg-amber-50 text-amber-700" />
        <MetricCard label="Absent Today" value={absentCount} icon={<Users size={21} />} tone="bg-rose-50 text-rose-700" />
      </section>

      <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3"><div className="rounded-xl bg-mint p-3 text-forest"><CalendarDays size={21} /></div><div><h2 className="font-semibold text-ink">School attendance register</h2><p className="text-sm text-slate-500">Monday–Friday · Ethiopian calendar</p></div></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => { setStaffModal(true); setError(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus size={17} /> Register staff</button>
          <button onClick={() => { setScannerModal(true); setScannerStep("ready"); setSelectedStaff(""); setError(""); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2 text-sm font-semibold text-white hover:bg-ink"><ScanLine size={17} /> Biometric scanner</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div><h2 className="font-semibold text-ink">Weekly attendance</h2><p className="text-xs text-slate-500">Tap an attendance cell to update its status.</p></div><button onClick={() => void load()} aria-label="Refresh attendance" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button></div>
        <div className="overflow-x-auto scroll-smooth">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead className="bg-slate-50"><tr><th className="sticky left-0 z-10 min-w-56 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:px-5">ሰራተኛ</th>{days.map((day) => <th key={day.key} className="min-w-32 px-3 py-3 text-xs font-semibold text-slate-600"><span className="block">{day.label.split(" · ")[0]}</span><span className="mt-1 block font-normal text-slate-400">{day.label.split(" · ")[1]}</span></th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {busy && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">Loading staff and attendance…</td></tr>}
              {!busy && data?.staff.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center"><Users size={28} className="mx-auto text-slate-300" /><p className="mt-3 font-medium text-slate-600">No staff registered yet</p><p className="mt-1 text-sm text-slate-400">Add your first staff member to start the register.</p></td></tr>}
              {!busy && data?.staff.map((staff) => <tr key={staff.id} className="hover:bg-slate-50/70">
                <th scope="row" className="sticky left-0 z-[1] bg-white px-4 py-3 text-left sm:px-5"><p className="font-semibold text-ink">{staff.full_name}</p><p className="mt-0.5 text-xs font-normal text-slate-500">{staff.job_title} · {staff.gender}</p></th>
                {days.map((day) => {
                  const record = currentRecord(staff.id, day.key);
                  const state = record?.status ?? (day.key <= todayKey ? "Absent" : "—");
                  return <td key={day.key} className="px-3 py-3"><button aria-label={`${staff.full_name}: ${state}; tap to update`} title="Tap to cycle status" onClick={() => {
                    const next = state === "Present" ? "Late" : state === "Late" ? "Absent" : "Present";
                    void updateAttendance(staff, day, next);
                  }} className="flex min-h-11 min-w-[118px] flex-col items-start justify-center gap-1 rounded-lg px-1 py-1 hover:bg-slate-50"><StatusBadge status={state} />{record?.check_in_time && <span className="px-1 text-[11px] text-slate-500">{record.check_in_time}{record.signature_verified ? " · ✓" : ""}</span>}</button></td>;
                })}
              </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:px-5"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Present</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Late</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Absent</span><span className="ethiopic ml-auto">{now ? ethiopianDateLabel(now) : ""}</span></div>
      </section>
      <p className="no-print mt-4 text-center text-xs leading-5 text-slate-400">The scanner simulator records an attendance verification flag only; it does not capture or store real biometric data.</p>
    </main>

    <div className="print-report hidden">
      <div className="text-center"><h1 className="text-xl font-bold">Yeka D.M.K.M Primary &amp; Middle School</h1><p className="ethiopic mt-1 text-sm">የሰራተኞች ሳምንታዊ የመገኘት ሪፖርት</p><p className="mt-2 text-sm">{now ? ethiopianDateLabel(now) : ""}</p></div>
      <table className="mt-8"><thead><tr><th>ሙሉ ስም</th><th>ጾታ</th><th>የሥራ ድርሻ</th>{days.map((day) => <th key={day.key}>{day.label.split(" · ")[0]}<br />{day.label.split(" · ")[1]}</th>)}</tr></thead><tbody>{data?.staff.map((staff) => <tr key={staff.id}><td>{staff.full_name}</td><td>{staff.gender}</td><td>{staff.job_title}</td>{days.map((day) => { const record = currentRecord(staff.id, day.key); return <td key={day.key}>{record ? `${record.status}${record.check_in_time ? `, ${record.check_in_time}` : ""}` : day.key <= todayKey ? "Absent" : "—"}</td>; })}</tr>)}</tbody></table>
      <div className="mt-16 grid grid-cols-3 gap-8 text-center text-sm"><div><div className="mb-10 border-b border-black" />Principal&apos;s Signature</div><div><div className="mb-10 border-b border-black" />Official Stamp</div><div><div className="mb-10 border-b border-black" />Date</div></div>
    </div>

    {staffModal && <Modal title="Register school staff" onClose={() => setStaffModal(false)}>
      <form onSubmit={addStaff} className="space-y-4">
        <label className="block text-sm font-medium text-slate-700">Full name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="Enter full name" /></label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Gender<select value={gender} onChange={(event) => setGender(event.target.value as "ወ" | "ሴ")} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="ወ">ወ</option><option value="ሴ">ሴ</option></select></label>
        <label className="block text-sm font-medium text-slate-700">Job title<input required maxLength={120} value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3" placeholder="e.g. Teacher" /></label></div>
        <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Biometric data must be enrolled using approved school hardware. This web form does not capture fingerprint data.</p>
        <button disabled={saving} className="min-h-12 w-full rounded-xl bg-forest px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Registering…" : "Register staff member"}</button>
      </form>
    </Modal>}
    {scannerModal && <Modal title="Biometric scanner simulator" onClose={() => setScannerModal(false)}>
      <div className="space-y-5">
        <p className="text-sm leading-6 text-slate-500">Touch-friendly demonstration only. No real biometric data is collected or stored.</p>
        <label className="block text-sm font-medium text-slate-700">Select staff member<select value={selectedStaff} onChange={(event) => setSelectedStaff(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3"><option value="">Choose staff</option>{data?.staff.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {person.job_title}</option>)}</select></label>
        <div aria-live="polite" className={`flex min-h-36 flex-col items-center justify-center rounded-2xl ${scannerStep === "verified" ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}>
          {scannerStep === "verified" ? <Check size={38} /> : <Fingerprint size={42} className={scannerStep === "scanning" ? "animate-pulse text-forest" : ""} />}
          <p className="mt-2 text-sm font-semibold">{scannerStep === "ready" ? "Scanner ready" : scannerStep === "scanning" ? "Checking simulator…" : "Simulation verified"}</p>
          {scannerStep === "verified" && <p className="mt-1 text-xs">Attendance was marked present for today.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button disabled={!selectedStaff || scannerStep === "scanning" || scannerStep === "verified"} onClick={() => void simulateScan()} className="min-h-12 w-full rounded-xl bg-forest px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{scannerStep === "scanning" ? "Verifying…" : scannerStep === "verified" ? "Complete" : "Start scan simulation"}</button>
      </div>
    </Modal>}
  </div>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-ink">{title}</h2><button aria-label="Close dialog" onClick={onClose} className="min-h-11 min-w-11 rounded-xl text-slate-500 hover:bg-slate-100"><X className="mx-auto" size={19} /></button></div>{children}
    </section>
  </div>;
}

type AdminPayload = {
  schools: { id: string; name: string; created_at: string }[];
  staffCount: number;
  devices: { id: string; school_id: string; device_name: string; status: string; last_seen_at: string | null; schools: { name: string } | null }[];
  logs: { id: string; device_id: string; level: string; message: string; created_at: string }[];
  systemStatus: { component: string; status: "operational" | "degraded" | "outage" | "maintenance"; details: string; updated_at: string }[];
};

export function PortalDashboard() {
  const { error, setError, request } = useApiError();
  const [data, setData] = useState<AdminPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const now = useClock();

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setData(await request("/api/admin") as AdminPayload);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load platform status.");
    } finally {
      setBusy(false);
    }
  }, [request, setError]);

  useEffect(() => { void load(); }, [load]);

  const healthyCount = data?.devices.filter((device) => device.status.toLowerCase() === "online").length ?? 0;
  const platformStatus = data?.systemStatus.some((item) => item.status === "outage")
    ? "Outage"
    : data?.systemStatus.some((item) => item.status === "degraded" || item.status === "maintenance")
      ? "Degraded"
      : "Operational";
  return <div className="min-h-screen">
    <Header title="System overview" subtitle="School attendance platform" role="Portal Admin" onSignOut={signOut} />
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-forest">PLATFORM OPERATIONS</p><h1 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">Portal Admin dashboard</h1><p className="mt-1 text-sm text-slate-500">{now ? `${ethiopianDateLabel(now)} · ${ethiopianTime(now)}` : "Loading time…"}</p></div><button onClick={() => void load()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"><RefreshCw size={16} /> Refresh status</button></section>
      {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Registered Schools" value={busy ? "…" : data?.schools.length ?? 0} icon={<Building2 size={21} />} tone="bg-slate-100 text-slate-600" />
        <MetricCard label="Registered Staff" value={busy ? "…" : data?.staffCount ?? 0} icon={<Users size={21} />} tone="bg-mint text-forest" />
        <MetricCard label="Scanners Online" value={busy ? "…" : `${healthyCount} / ${data?.devices.length ?? 0}`} icon={<Fingerprint size={21} />} tone="bg-emerald-50 text-emerald-700" />
        <MetricCard label="Platform Status" value={busy ? "…" : platformStatus} icon={<Activity size={21} />} tone={platformStatus === "Operational" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"} />
      </section>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="font-semibold text-ink">Platform system status</h2><p className="mt-1 text-sm text-slate-500">Operational indicators maintained by platform operations</p></div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2">{data?.systemStatus.map((item) => <div key={item.component} className="bg-white p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-ink">{item.component.replaceAll("_", " ")}</p><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "operational" ? "bg-emerald-50 text-emerald-700" : item.status === "outage" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{item.status}</span></div><p className="mt-2 text-sm text-slate-500">{item.details}</p><p className="mt-2 text-xs text-slate-400">Updated {new Date(item.updated_at).toLocaleString()}</p></div>)}</div>
      </section>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="font-semibold text-ink">Registered schools</h2><p className="mt-1 text-sm text-slate-500">Schools connected to the attendance platform</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[430px] text-left"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 font-semibold sm:px-5">School</th><th className="px-4 py-3 font-semibold">Registered</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{data?.schools.map((school) => <tr key={school.id}><td className="px-4 py-4 font-medium text-ink sm:px-5">{school.name}</td><td className="px-4 py-4 text-sm text-slate-500">{new Date(school.created_at).toLocaleDateString()}</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span></td></tr>)}{!busy && data?.schools.length === 0 && <tr><td colSpan={3} className="px-5 py-10 text-center text-sm text-slate-500">No schools have been registered.</td></tr>}</tbody></table></div>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5"><h2 className="font-semibold text-ink">Biometric scanner health</h2><p className="mt-1 text-sm text-slate-500">Most recent device connectivity signals</p></div>
          <div className="divide-y divide-slate-100">{data?.devices.map((device) => <div key={device.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><Fingerprint size={19} /></div><div><p className="font-medium text-ink">{device.device_name}</p><p className="text-xs text-slate-500">{device.schools?.name ?? "Unknown school"} · Last seen {device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : "never"}</p></div></div><span className={`inline-flex min-h-8 w-fit items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${device.status.toLowerCase() === "online" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}><span className={`h-1.5 w-1.5 rounded-full ${device.status.toLowerCase() === "online" ? "bg-emerald-500" : "bg-rose-500"}`} />{device.status}</span></div>)}{!busy && data?.devices.length === 0 && <div className="px-5 py-10 text-center text-sm text-slate-500">No biometric devices have reported health status.</div>}</div>
        </section>
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-card">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-5"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Activity size={19} /></div><div><h2 className="font-semibold text-ink">Scanner health log</h2><p className="text-sm text-slate-500">Recent events reported by registered hardware</p></div></div>
        <div className="divide-y divide-slate-100">{data?.logs.map((log) => <div key={log.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-slate-400" /><p className="text-sm text-slate-700">{log.message}</p></div><span className="pl-6 text-xs text-slate-400 sm:pl-0">{new Date(log.created_at).toLocaleString()}</span></div>)}{!busy && data?.logs.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-500">No health logs have been received.</div>}</div>
      </section>
      <p className="mt-4 text-center text-xs text-slate-400">Platform-wide access is restricted to assigned Portal Admin accounts.</p>
    </main>
  </div>;
}
