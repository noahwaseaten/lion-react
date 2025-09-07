"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import NumberFlow from "@number-flow/react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);

// Types
type Gender = "Men" | "Women";
interface RowApi {
  firstName?: string;
  lastName?: string;
  name?: string;
  familyName?: string;
  fullName?: string;
  count?: number | string;
  pushUps?: number | string;
  pushups?: number | string;
  gender?: Gender | "Male" | "Female" | string;
  [k: string]: unknown;
}
interface NormalizedRow {
  firstName: string;
  lastName: string;
  count: number;
  gender?: Gender;
}
// Apps Script error response shape
interface ScriptError {
  status: "ERROR";
  message?: string;
  [k: string]: unknown;
}
const isScriptError = (val: unknown): val is ScriptError =>
  typeof val === "object" && val !== null && (val as Record<string, unknown>).status === "ERROR";

// Stable identity signature, independent of count
const toSignature = (p: { firstName?: string; lastName?: string; gender?: Gender }) =>
  `${(p.firstName || "").trim().toLowerCase()}|${(p.lastName || "").trim().toLowerCase()}|${(p.gender || "")}`;

const ROW_HEIGHT_REM = 4.5; // Slightly taller rows for two-line name layout, keeps Flip stable
const STORAGE_KEY_ROWS = "pushups:rows:v1";

// Tunable timings: env defaults, with optional URL/localStorage overrides for on-site tuning
const parseMs = (v: unknown, fallback: number) => {
  const n = typeof v === "number" ? v : v == null ? NaN : parseInt(String(v), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const DEFAULT_TIMINGS = {
  settleMs: parseMs(process.env.NEXT_PUBLIC_TOP5_SETTLE_MS, 1200),
  preSubmitMs: parseMs(process.env.NEXT_PUBLIC_PRESUBMIT_WINDOW_MS, 3000),
  genderLoaderMinMs: parseMs(process.env.NEXT_PUBLIC_GENDER_LOADER_MIN_MS, 500),
};

const LogoSwitcher = () => {
  const [currentLogo, setCurrentLogo] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setCurrentLogo((p) => (p === 0 ? 1 : 0)), 12000);
    return () => clearInterval(interval);
  }, []);

  const logos = ["/Alphawin_logo.svg", "/lionheart.svg"];

  return (
    <div className="relative w-full" style={{ height: 600 }}>
      <Image
        src={logos[currentLogo]}
        alt={currentLogo === 0 ? "Alphawin Logo" : "Lion Heart Logo"}
        fill
        sizes="(max-width: 768px) 100vw, 40vw"
        style={{ objectFit: "contain" }}
        priority
      />
    </div>
  );
};

// Subtle animated three-dots loader used on gender switch
const ThreeDotsLoader = ({ size = 14, color = "#222222" }: { size?: number; color?: string }) => {
  const dotsRef = useRef<HTMLSpanElement[]>([]);
  const setDotRef = useCallback((idx: number) => (el: HTMLSpanElement | null) => {
    if (el) dotsRef.current[idx] = el;
  }, []);

  useEffect(() => {
    const els = dotsRef.current.filter(Boolean);
    if (!els.length) return;
    const tl = gsap.to(els, {
      y: -Math.max(6, size * 0.7),
      duration: 0.45,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
      stagger: 0.1,
    });
    return () => { try { tl.kill(); } catch {} };
  }, [size]);

  const dotStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    display: "inline-block",
    willChange: "transform",
  };

  return (
    <div aria-label="Loading" className="flex items-end" style={{ gap: Math.max(4, Math.round(size * 0.6)) }}>
      <span ref={setDotRef(0)} style={dotStyle} />
      <span ref={setDotRef(1)} style={dotStyle} />
      <span ref={setDotRef(2)} style={dotStyle} />
    </div>
  );
};

const PushupsCounter = () => {
  // Name / submission state
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [count, setCount] = useState(0);
  const nameRef = useRef(name);
  const submittedRef = useRef(submitted);
  const countRef = useRef(count);

  // Gender & Top 5 view
  const [gender, setGender] = useState<Gender>("Men");
  const genderRef = useRef(gender);
  const [isTopFiveView, setIsTopFiveView] = useState(false);
  const isTopFiveViewRef = useRef(isTopFiveView);

  // Data
  const [topFive, setTopFive] = useState<NormalizedRow[]>([]);
  // State not read, keep setter only to avoid lint warning while still enabling potential debug toggles
  const [, setAllRows] = useState<NormalizedRow[]>([]);
  const allRowsRef = useRef<NormalizedRow[]>([]);

  // Loading overlay with crossfade
  const [topFiveLoading, setTopFiveLoading] = useState(false);
  const [showLoadingUI, setShowLoadingUI] = useState(false);
  const isFetchingRef = useRef(false);

  // Subtle loading on gender switch (cached-to-fresh)
  const [genderSwitchLoading, setGenderSwitchLoading] = useState(false);

  // Refs for animations & DOM
  const inputEl = useRef<HTMLInputElement | null>(null);
  const topFiveRef = useRef<HTMLDivElement | null>(null);
  const topTitleRef = useRef<HTMLDivElement | null>(null);
  // Overlay/list refs for crossfade
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const listWrapRef = useRef<HTMLDivElement | null>(null);
  // Subtle overlay for gender switch
  const genderOverlayRef = useRef<HTMLDivElement | null>(null);
  // Track when Top 5 view was opened and defer pending apply if needed
  const topFiveOpenedAtRef = useRef<number>(0);
  const pendingApplyTimerRef = useRef<number | null>(null);
  const pendingApplyVersionRef = useRef(0);
  // Track last submit time and a snapshot of rows before submit to show on initial open
  const lastSubmitAtRef = useRef(0);
  const preSubmitRowsRef = useRef<NormalizedRow[] | null>(null);
  // Queue for pending apply when Top 5 is closed or settle window hasn't elapsed yet
  const pendingRowsRef = useRef<{
    rows: NormalizedRow[];
    spotlightSig: string | null;
    clearPre: boolean;
    version: number;
  } | null>(null);

  // Stable UIDs per identity to keep React keys consistent across reorders
  const uidCounterRef = useRef(0);
  const identityUidRegistryRef = useRef<Map<string, string>>(new Map());
  const getStableUidForIdentity = useCallback((identitySig: string) => {
    let uid = identityUidRegistryRef.current.get(identitySig);
    if (!uid) {
      uid = `uid-${uidCounterRef.current++}`;
      identityUidRegistryRef.current.set(identitySig, uid);
    }
    return uid;
  }, []);

  // Track last submitted participant to spotlight
  const lastSubmittedSignatureRef = useRef<string | null>(null);

  // Track running Flip timeline to avoid overlap
  const flipTlRef = useRef<gsap.core.Timeline | null>(null);

  // Track previous ranks per gender to compute up/down indicators
  const previousRankByGenderRef = useRef<{ Men: Map<string, number>; Women: Map<string, number> }>({
    Men: new Map(),
    Women: new Map(),
  });
  const [changeHints, setChangeHints] = useState<Record<string, { dir: "up" | "down" | "same" | "new"; delta: number }>>({});
  const [changeHintsVisible, setChangeHintsVisible] = useState(false);
  const changeHintsTimerRef = useRef<number | null>(null);
  const lastFetchAtRef = useRef(0);

  // Runtime-tunable timings (URL/localStorage overrides)
  const [timings, setTimings] = useState(DEFAULT_TIMINGS);
  const [preferPreAlways, setPreferPreAlways] = useState(true);
  useEffect(() => {
    try {
      const url = typeof window !== 'undefined' ? new URL(window.location.href) : null;
      const sp = url ? url.searchParams : null;
      const lsGet = (k: string) => {
        try { return localStorage.getItem(k); } catch { return null; }
      };
      const read = (keys: string[], fallback: number) => {
        for (const k of keys) {
          const qv = sp?.get(k);
          if (qv != null) return parseMs(qv, fallback);
        }
        for (const k of keys) {
          const lv = lsGet(`timing:${k}`);
          if (lv != null) return parseMs(lv, fallback);
        }
        return fallback;
      };
      const readBool = (keys: string[], fallback: boolean) => {
        const toB = (v: string | null): boolean | null => {
          if (v == null) return null;
          const s = String(v).toLowerCase();
          if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true;
          if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false;
          return null;
        };
        for (const k of keys) {
          const qb = toB(sp?.get(k) ?? null);
          if (qb !== null) return qb;
        }
        for (const k of keys) {
          const lb = toB(lsGet(`timing:${k}`));
          if (lb !== null) return lb;
        }
        return fallback;
      };
      const next = {
        settleMs: read(["settle", "top5_settle_ms"], DEFAULT_TIMINGS.settleMs),
        preSubmitMs: read(["pre", "presubmit", "pre_submit_ms"], DEFAULT_TIMINGS.preSubmitMs),
        genderLoaderMinMs: read(["gloader", "gender_loader_min_ms"], DEFAULT_TIMINGS.genderLoaderMinMs),
      };
      setTimings(next);
      const nextPrefer = readBool(["preAlways", "pre_always"], true);
      setPreferPreAlways(nextPrefer);
      // Persist any query-provided overrides for quick iteration
      const persistIfQP = (key: string) => {
        const qv = sp?.get(key);
        if (qv != null) try { localStorage.setItem(`timing:${key}`, qv); } catch {}
      };
      ["settle", "top5_settle_ms", "pre", "presubmit", "pre_submit_ms", "gloader", "gender_loader_min_ms", "preAlways", "pre_always"].forEach(persistIfQP);
    } catch {}
  }, []);

  // Helpers
  const normalizeRows = useCallback((rows: RowApi[]): NormalizedRow[] =>
    rows.map((r) => {
      let first = (r.firstName ?? r.name ?? "").toString().trim();
      let last = (r.lastName ?? r.familyName ?? "").toString().trim();
      if (!first && r.fullName) {
        const parts = String(r.fullName).trim().split(/\s+/);
        first = parts[0] || "";
        last = parts.slice(1).join(" ");
      }
      if (!first && !last) {
        const letters = /[A-Za-zА-Яа-я]/;
        for (const key in r) {
          if (String(key).toLowerCase() === "gender") continue;
          const val = (r as Record<string, unknown>)[key];
          if (typeof val === "string") {
            const s = val.trim();
            if (s && letters.test(s)) {
              const parts = s.split(/\s+/);
              first = parts[0] || "";
              last = parts.slice(1).join(" ");
              break;
            }
          }
        }
      }
      if (!first && last) {
        first = last;
        last = "";
      }
      const g = r.gender;
      const genderNorm: Gender | undefined = g === "Male" ? "Men" : g === "Female" ? "Women" : (g as Gender | undefined);
      return {
        firstName: first,
        lastName: last,
        count: Number(r.count ?? r.pushUps ?? r.pushups ?? 0) || 0,
        gender: genderNorm,
      } as NormalizedRow;
    }), []);

  const computeTopFive = useCallback((rows: RowApi[] | NormalizedRow[], currentGender: Gender): NormalizedRow[] => {
    const normalized = normalizeRows(rows as RowApi[]);
    // Deduplicate by identity, keeping highest count per person to avoid duplicate entries causing Flip key churn
    const bestBySig = new Map<string, NormalizedRow>();
    for (const r of normalized) {
      const sig = toSignature({ firstName: r.firstName, lastName: r.lastName, gender: r.gender as Gender });
      const prev = bestBySig.get(sig);
      if (!prev || r.count > prev.count) bestBySig.set(sig, r);
    }
    return Array.from(bestBySig.values())
      .filter((a) => a.count > 0 && (a.firstName || a.lastName))
      .filter((a) => !a.gender || a.gender === currentGender)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [normalizeRows]);

  // Core: animate reorder with GSAP Flip (flow-safe)
  const setTopFiveWithAnimation = useCallback((
    nextTopFive: NormalizedRow[],
    opts?: { spotlightSignature?: string | null }
  ) => {
    // Compute change hints (rank deltas) vs previous snapshot for current gender
    const prevRankMap = previousRankByGenderRef.current[genderRef.current];
    const nextRankMap = new Map<string, number>();
    const changes: Record<string, { dir: "up" | "down" | "same" | "new"; delta: number }> = {};
    nextTopFive.forEach((el, idx) => {
      const identity = toSignature({ firstName: el.firstName, lastName: el.lastName, gender: el.gender as Gender });
      const newRank = idx + 1;
      nextRankMap.set(identity, newRank);
      const prevRank = prevRankMap.get(identity);
      if (prevRank === undefined) {
        changes[identity] = { dir: "new", delta: 0 };
      } else {
        const delta = prevRank - newRank;
        changes[identity] = { dir: delta > 0 ? "up" : delta < 0 ? "down" : "same", delta };
      }
    });
    // Save new snapshot for this gender
    previousRankByGenderRef.current[genderRef.current] = nextRankMap;

    // Expose hints and show briefly
    setChangeHints(changes);
    setChangeHintsVisible(true);
    if (changeHintsTimerRef.current) window.clearTimeout(changeHintsTimerRef.current);
    changeHintsTimerRef.current = window.setTimeout(() => setChangeHintsVisible(false), 8500);

    const container = topFiveRef.current;
    // If container not ready or heavy overlay is showing, just set state (it won't be visible or will fade in)
    if (!container || topFiveLoading || showLoadingUI) {
      setTopFive(nextTopFive);
      if (opts?.spotlightSignature) lastSubmittedSignatureRef.current = opts.spotlightSignature;
      return;
    }
    // If Top 5 view isn't active, do not mutate DOM/state here; caller must gate/queue applies
    if (!isTopFiveViewRef.current) {
      if (opts?.spotlightSignature) lastSubmittedSignatureRef.current = opts.spotlightSignature;
      return;
    }

    // Cancel any running Flip to avoid overlap and clear any lingering transforms
    if (flipTlRef.current) {
      try { flipTlRef.current.kill(); } catch {}
      flipTlRef.current = null;
      try {
        const prevEls = Array.from(container.querySelectorAll('[data-row="true"][data-sig]')) as HTMLElement[];
        if (prevEls.length) gsap.set(prevEls, { clearProps: "transform,filter,willChange" });
        const prevSkeletons = Array.from(container.querySelectorAll('[data-skeleton="true"]')) as HTMLElement[];
        if (prevSkeletons.length) gsap.set(prevSkeletons, { clearProps: "opacity" });
      } catch {}
    }

    // Only include real items (exclude skeletons) to stabilize Flip
    const itemSelector = '[data-row="true"][data-sig]';
    const prevItems = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
    const prevState = prevItems.length ? Flip.getState(prevItems) : null;

    setTopFive(nextTopFive);

    // Hide skeletons during animation to prevent overlap
    const skeletons = Array.from(container.querySelectorAll('[data-skeleton="true"]')) as HTMLElement[];
    if (skeletons.length) gsap.set(skeletons, { opacity: 0 });

    // Double-RAF to ensure DOM is ready and styles/layout are committed before Flip
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const items = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
        if (!items.length) return;

        const prefersReduced = typeof window !== "undefined" &&
          !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

        let tl: gsap.core.Timeline | null = null;
        if (prevState) {
          tl = Flip.from(prevState, {
            targets: items,
            duration: prefersReduced ? 0 : 0.8,
            ease: "power3.out",
            stagger: prefersReduced ? 0 : 0.04,
            prune: true,
            absolute: true,
            scale: false,
            onEnter: (els) =>
              gsap.fromTo(
                els as HTMLElement[] | gsap.TweenTarget,
                { opacity: 0, filter: "blur(8px)" },
                { opacity: 1, filter: "blur(0px)", duration: prefersReduced ? 0 : 0.4, ease: "power2.out" }
              ),
            onLeave: (els) =>
              gsap.to(els as HTMLElement[] | gsap.TweenTarget, { opacity: 0, filter: "blur(8px)", duration: prefersReduced ? 0 : 0.3, ease: "power1.in" }),
          });
        } else {
          tl = gsap.timeline().fromTo(
            items,
            { opacity: 0, filter: "blur(10px)" },
            { opacity: 1, filter: "blur(0px)", duration: prefersReduced ? 0 : 0.5, stagger: prefersReduced ? 0 : 0.06, ease: "power2.out" }
          );
        }

        flipTlRef.current = tl;

        // Clear transforms after animation to prevent drift and restore skeletons
        if (tl) {
          tl.eventCallback("onComplete", () => {
            gsap.set(items, { clearProps: "transform,filter,willChange" });
            if (skeletons.length) gsap.to(skeletons, { opacity: 1, duration: prefersReduced ? 0 : 0.3, ease: "power1.out" });
            flipTlRef.current = null;
          });
        }

        // Animate change indicators entrance
        const changeEls = Array.from(container.querySelectorAll('[data-change]')) as HTMLElement[];
        if (changeEls.length) {
          gsap.fromTo(
            changeEls,
            { opacity: 0, y: 6 },
            { opacity: 1, y: 0, duration: prefersReduced ? 0 : 0.35, stagger: prefersReduced ? 0 : 0.03, ease: "power2.out" }
          );
        }
      });
    });
  }, [showLoadingUI, topFiveLoading]);

  // Helper: apply or queue Top 5 updates based on open state and settle window
  const applyOrQueueTopFive = useCallback((
    rows: NormalizedRow[],
    opts?: { spotlightSignature?: string | null; clearPreOnApply?: boolean; forceImmediate?: boolean }
  ) => {
    const spotlight = opts?.spotlightSignature ?? null;
    const clearPre = !!opts?.clearPreOnApply;
    const version = ++pendingApplyVersionRef.current;

    // If Top 5 is not open, stash and wait for open
    if (!isTopFiveViewRef.current) {
      pendingRowsRef.current = { rows, spotlightSig: spotlight, clearPre, version };
      return;
    }

    const openedAt = topFiveOpenedAtRef.current || 0;
    const now = Date.now();
    const shouldDelay = !opts?.forceImmediate && openedAt && now - openedAt < timings.settleMs;

    if (shouldDelay) {
      pendingRowsRef.current = { rows, spotlightSig: spotlight, clearPre, version };
      const delay = Math.max(0, openedAt + timings.settleMs - now);
      if (pendingApplyTimerRef.current) window.clearTimeout(pendingApplyTimerRef.current);
      pendingApplyTimerRef.current = window.setTimeout(() => {
        if (!isTopFiveViewRef.current) return; // still closed somehow
        const p = pendingRowsRef.current;
        if (!p || p.version !== version) return; // superseded
        setTopFiveWithAnimation(p.rows, { spotlightSignature: p.spotlightSig });
        if (p.clearPre) preSubmitRowsRef.current = null;
        pendingRowsRef.current = null;
      }, delay);
    } else {
      setTopFiveWithAnimation(rows, { spotlightSignature: spotlight });
      if (clearPre) preSubmitRowsRef.current = null;
      pendingRowsRef.current = null;
    }
  }, [timings.settleMs, setTopFiveWithAnimation]);

  // Animate crossfade of loading UI and list
  useEffect(() => {
    const overlay = overlayRef.current;
    const list = listWrapRef.current;
    if (!overlay || !list) return;
    const show = topFiveLoading && showLoadingUI;
    const prefersReduced = typeof window !== "undefined" &&
      !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    gsap.to(overlay, {
      opacity: show ? 1 : 0,
      duration: prefersReduced ? 0 : show ? 0.25 : 0.4,
      ease: "power2.out",
      onStart: () => {
        if (show) overlay.style.pointerEvents = "auto";
      },
      onComplete: () => {
        if (!show) overlay.style.pointerEvents = "none";
      },
    });

    gsap.to(list, {
      opacity: show ? 0.2 : 1,
      filter: show ? "blur(4px)" : "blur(0px)",
      duration: prefersReduced ? 0 : 0.4,
      ease: "power2.out",
    });
  }, [topFiveLoading, showLoadingUI]);

  // Data fetching - instant updates
  const getFromGoogleSheet = useCallback(async (force = false, options?: { showLoading?: boolean; deferIfOpening?: boolean }): Promise<NormalizedRow[] | null> => {
    const showLoading = options?.showLoading !== false;
    if (isFetchingRef.current) return null;

    const now = Date.now();
    if (!force) {
      if (now - lastFetchAtRef.current < 1500) {
        return null; // throttle non-forced fetches
      }
      lastFetchAtRef.current = now;
    } else {
      lastFetchAtRef.current = now;
    }

    isFetchingRef.current = true;
    
    // Show loading (crossfaded) unless silent
    if (showLoading) {
      setTopFiveLoading(true);
      setShowLoadingUI(true);
    }

    try {
      const res = await fetch(`/api/getInfoFromGoogleSheet${force ? "?nocache=true" : ""}`, {
        cache: "no-store",
      });
      let incoming = (await res.json()) as unknown;

      if (isScriptError(incoming)) {
        if (process.env.NODE_ENV !== "production") console.error("Apps Script error:", incoming.message);
        return null;
      }
      if (!Array.isArray(incoming)) {
        if (typeof incoming === "object" && incoming !== null && Object.keys(incoming as object).length === 0) {
          incoming = [];
        } else {
          if (process.env.NODE_ENV !== "production") console.error("Unexpected data format:", incoming);
          return null;
        }
      }
      const rows = (incoming as RowApi[]).map((r) => r) as RowApi[];
      const normalized = normalizeRows(rows);
      setAllRows(normalized);
      allRowsRef.current = normalized;
      try { sessionStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(normalized)); } catch {}
      
      // Compute filtered for current gender and apply/queue with settle gating
      const filtered = computeTopFive(normalized, genderRef.current);
      applyOrQueueTopFive(filtered, { clearPreOnApply: true });
      return normalized;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("Error fetching from internal API:", err);
      return null;
    } finally {
      // Hide loading (crossfade) if it was shown
      if (showLoading) {
        setTopFiveLoading(false);
        setShowLoadingUI(false);
      }
      isFetchingRef.current = false;
    }
  }, [computeTopFive, normalizeRows, applyOrQueueTopFive]);

  // Subtle blur + dots during gender switch (always show even when cached)
  useEffect(() => {
    const overlay = genderOverlayRef.current;
    const list = listWrapRef.current;
    if (!overlay || !list) return;
    const prefersReduced = typeof window !== "undefined" &&
      !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    gsap.to(overlay, {
      opacity: genderSwitchLoading ? 1 : 0,
      duration: prefersReduced ? 0 : 0.2,
      ease: "power2.out",
    });

    gsap.to(list, {
      filter: genderSwitchLoading ? "blur(2px)" : "blur(0px)",
      opacity: genderSwitchLoading ? 0.92 : 1,
      duration: prefersReduced ? 0 : 0.25,
      ease: "power2.out",
    });
  }, [genderSwitchLoading]);

  useEffect(() => {
    if (!isTopFiveViewRef.current) return;
    const startedAt = Date.now();
    setGenderSwitchLoading(true);

    // Swap instantly to cached for responsive feel (forceImmediate to bypass settle gating)
    const rows = allRowsRef.current;
    if (rows && rows.length) {
      applyOrQueueTopFive(computeTopFive(rows, genderRef.current), { forceImmediate: true });
    }

    Promise.resolve(getFromGoogleSheet(true, { showLoading: false }))
      .finally(() => {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, timings.genderLoaderMinMs - elapsed);
        window.setTimeout(() => setGenderSwitchLoading(false), remaining);
      });
  }, [gender, computeTopFive, getFromGoogleSheet, applyOrQueueTopFive, timings.genderLoaderMinMs]);

  // Submit to Google Sheet
  const sendToGoogleSheet = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      // Capture a snapshot before submitting so the next Top 5 open can show the pre-submit state briefly
      preSubmitRowsRef.current = allRowsRef.current ? [...allRowsRef.current] : null;
      lastSubmitAtRef.current = Date.now();

      const payload = {
        firstName: nameRef.current.split(" ")[0],
        familyName: nameRef.current.split(" ").slice(1).join(" "),
        count: countRef.current,
        gender: genderRef.current,
        age: "",
      } as const;

      lastSubmittedSignatureRef.current = toSignature({
        firstName: payload.firstName,
        lastName: payload.familyName,
        gender: payload.gender as Gender,
      });

      const res = await fetch("/api/sendToGoogleSheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const contentType = res.headers.get("content-type");

      if (!res.ok) {
        if (contentType && contentType.includes("application/json")) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error || `HTTP ${res.status}`);
        } else {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status} - ${errText}`);
        }
      }

      if (contentType && contentType.includes("application/json")) {
        await res.json();
      } else {
        await res.text();
      }

      // Refresh leaderboard after save (silent to keep UI stable)
      setTimeout(() => {
        void getFromGoogleSheet(true, { showLoading: false });
      }, 0);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("Error sending to Google Sheet:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [getFromGoogleSheet]);

  // Effects
  useEffect(() => {
    if (!submitted) inputEl.current?.focus();
  }, [submitted]);

  useEffect(() => {
    // Warm state from session cache for immediate Top 5 when opened
    try {
      const raw = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEY_ROWS) : null;
      if (raw) {
        const rows = JSON.parse(raw) as RowApi[] | NormalizedRow[];
        if (Array.isArray(rows)) {
          const normalized = normalizeRows(rows as RowApi[]);
          setAllRows(normalized);
          allRowsRef.current = normalized;
        }
      }
    } catch {}
  }, [normalizeRows]);

  useEffect(() => {
    void getFromGoogleSheet(false, { showLoading: false });
  }, [getFromGoogleSheet]);

  useEffect(() => {
    if (isTopFiveView) {
      // Mark open time and clear any previous pending apply
      topFiveOpenedAtRef.current = Date.now();
      if (pendingApplyTimerRef.current) {
        window.clearTimeout(pendingApplyTimerRef.current);
        pendingApplyTimerRef.current = null;
      }

      // Choose initial rows: prefer pre-submit snapshot if available (always if enabled), otherwise cached
      const now = Date.now();
      let initialRows = allRowsRef.current;
      if (
        preSubmitRowsRef.current &&
        preSubmitRowsRef.current.length &&
        (preferPreAlways || (lastSubmitAtRef.current && now - lastSubmitAtRef.current < timings.preSubmitMs))
      ) {
        initialRows = preSubmitRowsRef.current;
      }

      if (initialRows && initialRows.length) {
        // Force immediate to ensure pre-open snapshot shows instantly for audience reaction
        applyOrQueueTopFive(computeTopFive(initialRows, genderRef.current), { forceImmediate: true });
      }
      // If we had pending rows queued while closed, queue/apply them using settle gating now
      if (pendingRowsRef.current) {
        const p = pendingRowsRef.current;
        applyOrQueueTopFive(p.rows, { spotlightSignature: p.spotlightSig, clearPreOnApply: p.clearPre });
      }

      // Fetch in background without overlay; apply will be gated by helper
      void getFromGoogleSheet(true, { showLoading: false, deferIfOpening: true });
    } else {
      // Closed: cancel any pending apply timer (but keep pending rows in ref)
      if (pendingApplyTimerRef.current) {
        window.clearTimeout(pendingApplyTimerRef.current);
        pendingApplyTimerRef.current = null;
      }
      topFiveOpenedAtRef.current = 0;
    }
  }, [isTopFiveView, computeTopFive, getFromGoogleSheet, applyOrQueueTopFive, timings.preSubmitMs, preferPreAlways]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingApplyTimerRef.current) {
        window.clearTimeout(pendingApplyTimerRef.current);
        pendingApplyTimerRef.current = null;
      }
    };
  }, []);

  // Refs sync
  useEffect(() => {
    submittedRef.current = submitted;
  }, [submitted]);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  useEffect(() => {
    countRef.current = count;
  }, [count]);
  useEffect(() => {
    genderRef.current = gender;
  }, [gender]);
  useEffect(() => {
    isTopFiveViewRef.current = isTopFiveView;
  }, [isTopFiveView]);

  // Keybinds / shortcuts
  const [showKeybinds, setShowKeybinds] = useState(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShowKeybinds(true);

      if (!submittedRef.current) {
        const active = document.activeElement;
        const input = inputEl.current;
        const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        // Do not steal keys for typing when Top 5 view is active
        if (!isTopFiveViewRef.current && input && (!active || active !== input) && (isPrintable || e.key === "Backspace")) {
          if (e.key === "Backspace") {
            const next = (nameRef.current || "").slice(0, -1);
            nameRef.current = next;
            setName(next);
          } else if (isPrintable) {
            const next = (nameRef.current || "") + e.key;
            nameRef.current = next;
            setName(next);
          }
          return;
        }
      }

      switch (e.key) {
        case "Escape":
          setSubmitted(false);
          setName("");
          setCount(0);
          setTimeout(() => inputEl.current?.focus(), 0);
          break;
        case "Enter":
          if (submittedRef.current) {
            void sendToGoogleSheet();
            setName("");
            setCount(0);
            setSubmitted(false);
            setTimeout(() => inputEl.current?.focus(), 0);
          } else {
            const input = inputEl.current ?? (document.getElementById("firstName") as HTMLInputElement | null);
            if (input) setName(input.value);
            setSubmitted(true);
          }
          break;
        case " ":
          if (submittedRef.current) {
            e.preventDefault();
            setCount((prev) => {
              const c = prev + 1;
              countRef.current = c;
              return c;
            });
          }
          break;
        case "g":
        case "G":
          if (submittedRef.current) {
            setCount((prev) => {
              const c = Math.max(0, prev - 1);
              countRef.current = c;
              return c;
            });
          }
          break;
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight":
          setIsTopFiveView(!isTopFiveViewRef.current);
          if (!isTopFiveViewRef.current) inputEl.current?.blur();
          break;
        case "m":
        case "M":
          if (e.ctrlKey || e.metaKey) setGender("Men");
          break;
        case "w":
        case "W":
          if (e.ctrlKey || e.metaKey) setGender("Women");
          break;
        case "r":
        case "R":
          if (isTopFiveViewRef.current) {
            e.preventDefault();
            e.stopPropagation();
            void getFromGoogleSheet(true, { showLoading: false });
          }
          break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShowKeybinds(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [getFromGoogleSheet, sendToGoogleSheet]);

  // Helper to attach both refs to the list element
  const setListRef = useCallback((el: HTMLDivElement | null) => {
    topFiveRef.current = el;
    listWrapRef.current = el;
  }, []);

  return (
    <div className="w-screen h-screen flex bg-[#f5f5f5]">
      {showKeybinds && (
        <div className="fixed top-2 right-3 text-sm text-black z-50 whitespace-pre">
          Enter: Start/Finish | Space: +1 | G: -1 | Esc: Reset | Arrows: Toggle Top 5 | Ctrl/Cmd+M: Men | Ctrl/Cmd+W: Women | R (in Top 5): Refresh
        </div>
      )}

      <div className="w-[40vw] mx-auto my-auto py-10 rounded-xl">
        <LogoSwitcher />
      </div>

      <div className="relative z-10 w-[50vw] mr-0 text-[#222222] py-10 rounded-xl select-none">
        {!submitted ? (
          <div>
            <div
              className={`absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/2 transition-opacity duration-300 ${
                !isTopFiveView ? "opacity-100 delay-300" : "opacity-0"
              } text-2xl mx-auto`}
            >
              <div className="flex flex-col gap-2">
                <div>
                  <div className="text-center mb-5 text-3xl">Кой ще се напомпа сега?</div>
                  <input
                    ref={inputEl}
                    type="text"
                    id="firstName"
                    className="w-full h-auto border border-black rounded-lg px-2 overflow-hidden"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`absolute z-20 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1/2 transition-opacity duration-300 ${
              !isTopFiveView ? "opacity-100 delay-300" : "opacity-0"
            } flex flex-col items-center justify-center h-[50vh] text-center gap-2`}
          >
            <div className="mt-auto w-full max-w-full flex flex-col items-center justify-center">
              <span className="text-8xl break-words px-2 truncate max-w-[90vw] inline-block">
                {name.split(" ")[0].toUpperCase()}
              </span>
              <span className="text-6xl break-words px-2 truncate max-w-[90vw] inline-block">
                {name.split(" ").slice(1).join(" ").toUpperCase()}
              </span>
            </div>
            <div className="text-[16rem] flex justify-center w-full">
              <NumberFlow value={countRef.current} locales="en-US" format={{ useGrouping: false }} animated willChange />
            </div>
            <div className="mb-auto select-none text-8xl flex justify-center w-full">
              <span className="inline-block">Лицеви</span>
            </div>
          </div>
        )}

        {/* Top 5 block */}
        <div
          className={`
            absolute z-10 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
            flex flex-col items-center justify-center h-[50vh] w-full text-center gap-2
            transition-all duration-700
            ${isTopFiveView ? "opacity-100 scale-100 blur-0 pointer-events-auto" : "opacity-0 scale-95 blur-sm pointer-events-none"}
          `}
        >
          <div ref={topTitleRef} className="text-9xl mt-2 mb-16 tracking-tight transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]">
            Топ 5 <span className="text-7xl opacity-90">{gender === "Men" ? "Мъже" : "Жени"}</span>
          </div>
          <div className="relative w-full flex flex-col items-center">
            {/* Loading overlay (crossfaded; stays mounted) */}
            <div
              ref={overlayRef}
              className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ 
                backgroundColor: "rgba(245,245,245,0.9)", 
                backdropFilter: "blur(8px)",
                opacity: 0,
                pointerEvents: "none"
              }}
              role="status"
              aria-live="polite"
              aria-busy={topFiveLoading && showLoadingUI}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 border-[3px] border-gray-300 border-t-black rounded-full animate-spin" aria-label="Loading" />
                <span className="text-4xl font-semibold tracking-wide text-gray-700">Зареждане…</span>
              </div>
            </div>

            <div
              ref={setListRef}
              className={`relative z-0 w-full flex flex-col items-center text-[#222222] transition-[opacity,filter] duration-300 gap-2`}
              style={{ 
                height: ROW_HEIGHT_REM * 5 + "rem", // lock to 5 rows to prevent height snap
                position: "relative",
                overflow: "hidden" // prevent animated items from bleeding outside and glitching with skeletons
              }}
              role="list"
              aria-hidden={topFiveLoading && showLoadingUI}
              aria-busy={topFiveLoading && showLoadingUI}
            >
              {(() => {
                // Build 5 fixed rank slots to avoid skeleton/row overlap during Flip
                const slots: Array<NormalizedRow | null> = [
                  topFive[0] ?? null,
                  topFive[1] ?? null,
                  topFive[2] ?? null,
                  topFive[3] ?? null,
                  topFive[4] ?? null,
                ];

                return slots.map((row, i) => {
                  const rank = i + 1;
                  if (row) {
                    const identity = toSignature({ firstName: row.firstName, lastName: row.lastName, gender: row.gender as Gender });
                    const uid = getStableUidForIdentity(identity);
                    const first = (row.firstName || "").trim();
                    const last = (row.lastName || "").trim();
                    const hint = changeHints[identity];
                    const visible = changeHintsVisible && !!hint;
                    const hintColor = hint?.dir === "up"
                      ? "text-green-600"
                      : hint?.dir === "down"
                      ? "text-red-600"
                      : hint?.dir === "new"
                      ? "text-green-600"
                      : "text-gray-500";
                    const hintSymbol = hint?.dir === "down" ? "↓" : hint?.dir === "same" ? "•" : "↑";

                    return (
                      <div
                        key={uid}
                        data-key={uid}
                        data-row="true"
                        data-sig={identity}
                        className="px-4 rounded will-change-[opacity,transform,filter] w-[80%] max-w-[1100px] relative z-10"
                        style={{ height: ROW_HEIGHT_REM + "rem" }}
                        role="listitem"
                      >
                        <div className="w-full h-full flex items-center justify-between gap-4">
                          <div className="flex items-center gap-6 min-w-0 text-left">
                            <span className="w-12 text-right shrink-0 text-black text-[2rem]">{rank}.</span>
                            <div className="min-w-0 leading-tight">
                              {first ? (
                                <div className="truncate font-semibold tracking-tight text-[2.4rem] max-w-[38ch]">{first.toUpperCase()}</div>
                              ) : (
                                <div className="truncate font-semibold tracking-tight text-[2.4rem] opacity-70 max-w-[38ch]">Unknown</div>
                              )}
                              {last && (
                                <div className="truncate text-[1.7rem] text-black -mt-1 max-w-[38ch]">{last.toUpperCase()}</div>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 relative flex items-center gap-6 pr-16">
                            <div className="shrink-0 tabular-nums whitespace-nowrap text-[2.2rem]">{row.count} лицеви</div>
                            {/* Centered indicator in fixed square box to avoid layout shift */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center">
                              <span
                                data-change
                                data-dir={hint?.dir || "none"}
                                className={`pointer-events-none will-change-[opacity,transform] text-[2.2rem] leading-none transition-all duration-500 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"} ${hintColor}`}
                                aria-hidden={!visible}
                              >
                                <span className="w-[1em] h-[1em] flex items-center justify-center leading-none">{hintSymbol}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Skeleton for empty rank slot
                  return (
                    <div
                      key={`skeleton-slot-${rank}`}
                      data-row="true"
                      data-skeleton="true"
                      className="px-4 rounded w-[80%] max-w-[1100px] z-0"
                      style={{ height: ROW_HEIGHT_REM + "rem" }}
                      role="listitem"
                      aria-hidden
                    >
                      <div className="w-full h-full flex items-center justify-between gap-4">
                        <div className="flex items-center gap-6 min-w-0 pointer-events-none">
                          <div className="w-12 h-6 rounded bg-gray-400/70" />
                          <div className="min-w-0">
                            <div className="h-7 w-[24ch] max-w-[60vw] bg-gray-300/80 rounded" />
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-6 pr-16 pointer-events-none">
                          <div className="h-7 w-[15ch] bg-gray-300/80 rounded" />
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
            {/* Subtle gender-switch overlay (below heavy loading overlay) */}
            <div
              ref={genderOverlayRef}
              className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
              style={{ opacity: 0, zIndex: 15 }}
              aria-hidden={!genderSwitchLoading}
              role="status"
              aria-live="polite"
            >
              <ThreeDotsLoader size={18} color="#222" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushupsCounter;
