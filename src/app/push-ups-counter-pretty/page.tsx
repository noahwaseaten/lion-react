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

const LogoSwitcher = () => {
  const [currentLogo, setCurrentLogo] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setCurrentLogo((p) => (p === 0 ? 1 : 0)), 10000);
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

  // Refs for animations & DOM
  const inputEl = useRef<HTMLInputElement | null>(null);
  const topFiveRef = useRef<HTMLDivElement | null>(null);
  const topTitleRef = useRef<HTMLDivElement | null>(null);
  // Overlay/list refs for crossfade
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const listWrapRef = useRef<HTMLDivElement | null>(null);

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
    return normalized
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
    if (!container || !isTopFiveViewRef.current || topFiveLoading || showLoadingUI) {
      setTopFive(nextTopFive);
      if (opts?.spotlightSignature) lastSubmittedSignatureRef.current = opts.spotlightSignature;
      return;
    }

    // Cancel any running Flip to avoid overlap
    if (flipTlRef.current) {
      try { flipTlRef.current.kill(); } catch {}
      flipTlRef.current = null;
    }

    const itemSelector = '[data-row="true"]';
    const prevItems = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
    const prevState = prevItems.length ? Flip.getState(prevItems) : null;

    setTopFive(nextTopFive);

    requestAnimationFrame(() => {
      const items = Array.from(container.querySelectorAll(itemSelector)) as HTMLElement[];
      if (!items.length) return;

      // Height is locked via CSS to 5 rows; no JS height tween needed (prevents post-anim snap)

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
          // Use absolute positioning during the flip to reduce overlap/teleport
          absolute: true,
          // Avoid scaling to reduce visual jumpiness
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

      // Clear transforms after animation to prevent drift
      if (tl) {
        tl.eventCallback("onComplete", () => {
          gsap.set(items, { clearProps: "transform,filter,willChange" });
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
        // Auto-fade handled by state after timeout
      }

      // Spotlight last submitted participant
      const spotlightSig = opts?.spotlightSignature ?? lastSubmittedSignatureRef.current;
      if (spotlightSig) {
        const target = items.find((el) => String(el.dataset.sig) === spotlightSig);
        if (target) {
          gsap.fromTo(
            target,
            { backgroundColor: "rgba(255,235,150,0.7)", boxShadow: "0 0 0 10px rgba(255,235,150,0.35)" },
            { backgroundColor: "transparent", boxShadow: "0 0 0 0 rgba(255,235,150,0)", duration: prefersReduced ? 0 : 1.2, ease: "power3.out" }
          );
        }
        lastSubmittedSignatureRef.current = null;
      }
    });
  }, [showLoadingUI, topFiveLoading]);

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

  // Animate hiding of change indicators
  useEffect(() => {
    const container = topFiveRef.current;
    if (!container) return;
    const changeEls = Array.from(container.querySelectorAll('[data-change]')) as HTMLElement[];
    if (!changeEls.length) return;
    const prefersReduced = typeof window !== "undefined" &&
      !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!changeHintsVisible) {
      gsap.to(changeEls, { opacity: 0, y: 2, duration: prefersReduced ? 0 : 0.3, ease: "power1.in" });
    }
  }, [changeHintsVisible]);

  // Animate title/list subtly on gender change so the cached swap feels responsive
  useEffect(() => {
    if (!isTopFiveViewRef.current) return;
    const title = topTitleRef.current;
    const list = listWrapRef.current;
    const prefersReduced = typeof window !== "undefined" && !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (title) {
      gsap.fromTo(title, { y: 10, opacity: 0.7 }, { y: 0, opacity: 1, duration: prefersReduced ? 0 : 0.35, ease: "power2.out" });
    }
    if (list) {
      gsap.fromTo(list, { y: 6, opacity: 0.9 }, { y: 0, opacity: 1, duration: prefersReduced ? 0 : 0.4, ease: "power2.out" });
    }
  }, [gender]);

  // Data fetching - instant updates
  const getFromGoogleSheet = useCallback(async (force = false, options?: { showLoading?: boolean }): Promise<NormalizedRow[] | null> => {
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
        console.error("Apps Script error:", incoming.message);
        return null;
      }
      if (!Array.isArray(incoming)) {
        if (typeof incoming === "object" && incoming !== null && Object.keys(incoming as object).length === 0) {
          incoming = [];
        } else {
          console.error("Unexpected data format:", incoming);
          return null;
        }
      }
      const rows = (incoming as RowApi[]).map((r) => r) as RowApi[];
      const normalized = normalizeRows(rows);
      setAllRows(normalized);
      allRowsRef.current = normalized;
      try { sessionStorage.setItem(STORAGE_KEY_ROWS, JSON.stringify(normalized)); } catch {}
      
      // Apply data immediately when ready
      if (isTopFiveViewRef.current) {
        const filtered = computeTopFive(normalized, genderRef.current);
        setTopFiveWithAnimation(filtered);
      }
      return normalized;
    } catch (err) {
      console.error("Error fetching from internal API:", err);
      return null;
    } finally {
      // Hide loading (crossfade) if it was shown
      if (showLoading) {
        setTopFiveLoading(false);
        setShowLoadingUI(false);
      }
      isFetchingRef.current = false;
    }
  }, [computeTopFive, normalizeRows, setTopFiveWithAnimation]);

  // Submit to Google Sheet
  const sendToGoogleSheet = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
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
      console.error("Error sending to Google Sheet:", err);
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
      // Show cached immediately
      const rows = allRowsRef.current;
      if (rows && rows.length) {
        setTopFiveWithAnimation(computeTopFive(rows, genderRef.current));
      }
      // Fetch in background without overlay, then animate reordering
      void getFromGoogleSheet(true, { showLoading: false });
    }
  }, [isTopFiveView, computeTopFive, getFromGoogleSheet, setTopFiveWithAnimation]);

  useEffect(() => {
    if (!isTopFiveViewRef.current) return;
    const rows = allRowsRef.current;
    if (rows && rows.length) {
      setTopFiveWithAnimation(computeTopFive(rows, genderRef.current));
    }
    // Always refresh silently when gender switches while Top 5 is open
    void getFromGoogleSheet(true, { showLoading: false });
  }, [gender, computeTopFive, getFromGoogleSheet, setTopFiveWithAnimation]);

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
      if (e.key === "Tab") setShowKeybinds(true);

      if (!submittedRef.current) {
        const active = document.activeElement as HTMLElement | null;
        const input = inputEl.current;
        const isPrintable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
        // Do not steal keys for typing when Top 5 view is active
        if (!isTopFiveViewRef.current && input && (!active || active !== input) && (isPrintable || e.key === "Backspace")) {
          e.preventDefault();
          input.focus();
          if (isPrintable) {
            const next = (nameRef.current || "") + e.key;
            nameRef.current = next;
            setName(next);
          } else if (e.key === "Backspace") {
            const next = (nameRef.current || "").slice(0, -1);
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
      if (e.key === "Tab") setShowKeybinds(false);
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
                  <div className="text-center text-base mt-2">Пол: {gender === "Men" ? "Мъже" : "Жени"}</div>
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
              <span className="text-5xl break-words px-2 truncate max-w-[90vw] inline-block">
                {name.split(" ").slice(1).join("").toUpperCase()}
              </span>
            </div>
            <div className="text-[12rem] flex justify-center w-full">
              <NumberFlow value={countRef.current} locales="en-US" format={{ useGrouping: false }} animated willChange />
            </div>
            <div className="mb-auto select-none text-6xl flex justify-center w-full">
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
                position: "relative"
              }}
              role="list"
              aria-hidden={topFiveLoading && showLoadingUI}
            >
              {(() => {
                const occ = new Map<string, number>();
                const rows = topFive.map((el, i) => {
                  const identity = toSignature({ firstName: el.firstName, lastName: el.lastName, gender: el.gender as Gender });
                  const baseUid = getStableUidForIdentity(identity);
                  const n = occ.get(identity) || 0;
                  occ.set(identity, n + 1);
                  const uid = n ? `${baseUid}#${n}` : baseUid;
                  const first = (el.firstName || "").trim();
                  const last = (el.lastName || "").trim();
                  const hint = changeHints[identity];
                  const visible = changeHintsVisible && !!hint; // show dot for unchanged too
                  const hintColor = hint?.dir === "up"
                    ? "text-green-600"
                    : hint?.dir === "down"
                    ? "text-red-600"
                    : hint?.dir === "new"
                    ? "text-green-600"
                    : "text-gray-500"; // neutral for unchanged
                  const hintSymbol = hint?.dir === "down" ? "↓" : hint?.dir === "same" ? "•" : "↑";

                  return (
                    <div
                      key={uid}
                      data-key={uid}
                      data-row="true"
                      data-sig={identity}
                      className="px-4 rounded will-change-[opacity,transform,filter] w-[80%] max-w-[1100px] relative"
                      style={{ height: ROW_HEIGHT_REM + "rem" }}
                      role="listitem"
                    >
                      <div className="w-full h-full flex items-center justify-between gap-4">
                        <div className="flex items-center gap-6 min-w-0 text-left">
                          <span className="w-12 text-right shrink-0 text-black text-[2rem]">{i + 1}.</span>
                          <div className="min-w-0 leading-tight">
                            {first ? (
                              <div className="truncate font-semibold tracking-tight text-[2.4rem]">{first.toUpperCase()}</div>
                            ) : (
                              <div className="truncate font-semibold tracking-tight text-[2.4rem] opacity-70">Unknown</div>
                            )}
                            {last && (
                              <div className="truncate text-[1.7rem] text-black -mt-1">{last.toUpperCase()}</div>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 relative flex items-center gap-6 pr-16">
                          <div className="shrink-0 tabular-nums whitespace-nowrap text-[2.2rem]">{el.count} лицеви</div>
                          {/* Centered indicator in fixed square box to avoid layout shift */}
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center">
                            <span
                              data-change
                              data-dir={hint?.dir || "none"}
                              className={`pointer-events-none will-change-[opacity,transform] text-[2.2rem] leading-none transition-all transition-colors duration-500 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"} ${hintColor}`}
                              aria-hidden={!visible}
                            >
                              <span className="w-[1em] h-[1em] flex items-center justify-center leading-none">{hintSymbol}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });

                // Skeleton rows to complete Top 5 when fewer entries exist
                const missing = Math.max(0, 5 - rows.length);
                const skeletons = Array.from({ length: missing }).map((_, j) => {
                  const rank = rows.length + j + 1;
                  return (
                    <div
                      key={`skeleton-${rank}`}
                      data-row="true"
                      className="px-4 rounded w-[80%] max-w-[1100px]"
                      style={{ height: ROW_HEIGHT_REM + "rem" }}
                      role="listitem"
                    >
                      <div className="w-full h-full flex items-center justify-between gap-4">
                        <div className="flex items-center gap-6 min-w-0">
                          <div className="w-12 h-6 rounded bg-gray-400/70" />
                          <div className="min-w-0">
                            <div className="h-7 w-[24ch] max-w-[60vw] bg-gray-300/80 rounded" />
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-6 pr-16">
                          <div className="h-7 w-[15ch] bg-gray-300/80 rounded" />
                        </div>
                      </div>
                    </div>
                  );
                });

                return [...rows, ...skeletons];
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushupsCounter;
