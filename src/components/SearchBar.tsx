import { useEffect, useRef, useState, useCallback } from "react";
import { Search, X, Sparkles, Mic, Clock, MicOff } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { autocompleteProducts, getTopSearches } from "@/lib/products.functions";
import { hapticLight } from "@/hooks/use-native";

interface Props {
  variant?: "hero" | "compact";
  defaultValue?: string;
}

// ✅ FIX 4.1: SUGGESTIONS больше не захардкожены — берутся из БД через getTopSearches
// Фоллбэк на случай пустой БД
const FALLBACK_SUGGESTIONS = [
  "молоко 3.2%",
  "куриная грудка",
  "яйца C1",
  "бананы",
  "сыр российский",
  "масло сливочное",
];

const HISTORY_KEY = "cenomer-search-history";
const MAX_HISTORY = 8;

interface SpeechRecognitionResultItem {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionResultList {
  0: SpeechRecognitionResultItem;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start(): void;
  stop(): void;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
}

function getSpeechWindow(): WindowWithSpeech {
  return window as WindowWithSpeech;
}

function getHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function addToHistory(q: string) {
  const prev = getHistory().filter((h) => h !== q);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([q, ...prev].slice(0, MAX_HISTORY)));
}
function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function SearchBar({ variant = "hero", defaultValue = "" }: Props) {
  const navigate = useNavigate();
  const [value, setValue] = useState(defaultValue);
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const autocomplete = useServerFn(autocompleteProducts);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), 180);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const { data: autocompleteData } = useQuery({
    queryKey: ["autocomplete", debounced],
    queryFn: () => autocomplete({ data: { q: debounced } }),
    enabled: debounced.trim().length >= 2,
    staleTime: 30_000,
  });

  // ✅ FIX 4.1: загружаем топ запросов из БД
  const { data: topSearchesData } = useQuery({
    queryKey: ["top-searches"],
    queryFn: () => getTopSearches(),
    staleTime: 5 * 60_000,
  });

  const suggestions = topSearchesData?.queries?.length
    ? topSearchesData.queries
    : FALLBACK_SUGGESTIONS;

  const submit = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      addToHistory(q.trim());
      setHistory(getHistory());
      setOpen(false);
      hapticLight();
      // ✅ FIX 5.5: убираем фокус на iOS чтобы скрыть клавиатуру
      inputRef.current?.blur();
      navigate({ to: "/search", search: { q: q.trim() } });
    },
    [navigate],
  );

  function onFocus() {
    setHistory(getHistory());
    setOpen(true);
  }

  // Голосовой поиск через Web Speech API
  const startVoice = useCallback(() => {
    const speechWindow = getSpeechWindow();
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "ru-RU";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      setValue(transcript);
      if (e.results[0].isFinal) submit(transcript);
    };
    recognition.start();
  }, [listening, submit]);

  const hasVoice =
    typeof window !== "undefined" &&
    (getSpeechWindow().SpeechRecognition || getSpeechWindow().webkitSpeechRecognition);

  const isHero = variant === "hero";
  const showHistory = open && !debounced.trim() && history.length > 0;
  const showAutocomplete = open && debounced.trim().length >= 2 && autocompleteData?.items.length;
  const showSuggestions = open && !debounced.trim() && history.length === 0;

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className={
          isHero
            ? "group flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-lift transition focus-within:ring-4 focus-within:ring-primary/20"
            : "group flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 shadow-soft focus-within:ring-2 focus-within:ring-primary/30"
        }
      >
        <Search
          className={
            isHero ? "ml-3 h-6 w-6 text-muted-foreground" : "h-4 w-4 text-muted-foreground"
          }
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={onFocus}
          placeholder={isHero ? "Например, молоко 3.2% 900мл" : "Поиск товаров…"}
          className={
            isHero
              ? "min-w-0 flex-1 bg-transparent px-2 py-3 text-base outline-none placeholder:text-muted-foreground sm:text-lg"
              : "min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          }
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue("");
              inputRef.current?.focus();
            }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Очистить"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {hasVoice && isHero && (
          <button
            type="button"
            onClick={startVoice}
            aria-label="Голосовой поиск"
            className={`rounded-xl p-2.5 transition ${listening ? "bg-primary/10 text-primary animate-pulse" : "text-muted-foreground hover:bg-muted"}`}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
        <button
          type="submit"
          className={
            isHero
              ? "rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:opacity-90 sm:px-7 sm:text-base"
              : "rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          }
        >
          Найти
        </button>
      </form>

      {/* Dropdown */}
      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lift">
          {/* Автокомплит */}
          {showAutocomplete ? (
            <ul className="max-h-96 overflow-y-auto py-1">
              {autocompleteData!.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setValue("");
                      setOpen(false);
                      navigate({ to: "/product/$slug", params: { slug: item.slug } });
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-muted"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      {item.brand && (
                        <p className="truncate text-xs text-muted-foreground">{item.brand}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : showHistory ? (
            /* История поиска */
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Недавние поиски
                </p>
                <button
                  type="button"
                  onClick={() => {
                    clearHistory();
                    setHistory([]);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Очистить
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => {
                      setValue(h);
                      submit(h);
                    }}
                    className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs transition hover:bg-accent"
                  >
                    <Clock className="h-3 w-3 text-muted-foreground" /> {h}
                  </button>
                ))}
              </div>
            </div>
          ) : showSuggestions ? (
            /* ✅ FIX 4.1: Топ запросов из БД (или фоллбэк) */
            <div className="px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Популярные запросы
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => submit(s)}
                    className="rounded-full bg-muted px-3 py-1 text-xs transition hover:bg-accent hover:text-accent-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
