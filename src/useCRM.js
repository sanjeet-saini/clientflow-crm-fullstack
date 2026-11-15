// =====================================================================
// useCRM.js — custom hook. Kaam: data LOAD karna aur har change SAVE karna.
//
// Do modes:
//   "api"   → backend server (Express + SQLite) se data aata/jaata hai
//   "local" → server na mile (jaise GitHub Pages par) to purana tareeka: localStorage
// App ko farq nahi padta — use same { data, mutate } milta hai.
// =====================================================================
import { useEffect, useState } from "react";
import { demoData, isValidData } from "./data";

// localStorage ki key. "v1" version hai — aage data ka shape badle to v2 bana sakte hain
export const STORAGE_KEY = "clientflow-v1";
// API ka address. Dev mein Vite "/api" ko server (port 4000) par proxy karta hai.
// Alag server ho to build se pehle VITE_API_URL set karo.
export const API_URL = (import.meta.env?.VITE_API_URL || "./api").replace(
  /\/$/,
  "",
);

const EMPTY = { customers: [], leads: [], tasks: [] };

// Server se baat karne ka chhota helper. Error ho to server ka message throw karta hai.
async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(API_URL + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

// localStorage se data (pehle wala logic). Kharab ho to demo data + warning.
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: demoData(), error: "" };
    const parsed = JSON.parse(raw);
    if (!isValidData(parsed)) throw new Error();
    return { data: parsed, error: "" };
  } catch {
    return {
      data: demoData(),
      error: "Saved data could not be read. Demo data was restored.",
    };
  }
}

export function useCRM() {
  const [data, setData] = useState(EMPTY);
  const [mode, setMode] = useState("loading"); // "loading" | "api" | "local"
  const [storageError, setStorageError] = useState("");

  // LOAD (sirf ek baar): pehle server try karo; fail → localStorage mode
  useEffect(() => {
    let cancelled = false;
    request("/data")
      .then((json) => {
        if (!isValidData(json)) throw new Error("Invalid data from server");
        if (!cancelled) {
          setData(json);
          setMode("api");
        }
      })
      .catch(() => {
        if (cancelled) return;
        const local = loadLocal();
        setData(local.data);
        setStorageError(local.error);
        setMode("local");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // SAVE (sirf local mode): data badle to localStorage mein likho
  useEffect(() => {
    if (mode !== "local") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. Changes will only last for this session.",
      );
    }
  }, [data, mode]);

  // CHANGE karne ka ek hi rasta:
  //   updater → screen turant update (optimistic UI, user ko wait nahi karna padta)
  //   path/options → api mode mein server ko bhi batao
  // Server mana kare (validation/network error) → error dikhao aur server se fresh data lo,
  // taaki screen aur database kabhi alag na rahein.
  function mutate(updater, path, options) {
    setData(updater);
    if (mode !== "api") return;
    request(path, options)
      .then((json) => {
        // Reset jaisa call poora data lautaata hai → wahi screen par dikhao
        if (isValidData(json)) setData(json);
      })
      .catch(async (err) => {
        setStorageError(
          `Could not save to server: ${err.message}. Showing latest saved data.`,
        );
        try {
          setData(await request("/data"));
        } catch {
          /* server band — jo screen par hai wahi rehne do */
        }
      });
  }

  return { data, mutate, mode, storageError };
}
