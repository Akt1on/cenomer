/**
 * Onboarding — показывается один раз при первом запуске.
 * 3 экрана с анимацией. Сохраняет флаг в localStorage.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Bell, ShoppingCart, ArrowRight, X } from "lucide-react";
import { hapticLight, hapticSuccess } from "@/hooks/use-native";

const STEPS = [
  {
    icon: Search,
    emoji: "🔍",
    color: "#16a34a",
    title: "Ищи и сравнивай",
    text: "Введи название любого продукта — Ценомер мгновенно покажет цены в Перекрёстке, Пятёрочке, Магните и Ленте.",
  },
  {
    icon: Bell,
    emoji: "🔔",
    color: "#f59e0b",
    title: "Следи за ценами",
    text: "Добавь товар в избранное и мы пришлём уведомление как только цена упадёт.",
  },
  {
    icon: ShoppingCart,
    emoji: "🛒",
    color: "#6366f1",
    title: "Считай итог",
    text: "Список покупок покажет в каком магазине выгоднее купить всё сразу — и сколько ты сэкономишь.",
  },
];

const ONBOARDING_KEY = "cenomer-onboarding-done";

export function useOnboarding() {
  const done = typeof window !== "undefined" && localStorage.getItem(ONBOARDING_KEY) === "1";
  return !done;
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const s = STEPS[step];

  function next() {
    hapticLight();
    if (isLast) finish();
    else setStep((n) => n + 1);
  }

  function finish() {
    hapticSuccess();
    localStorage.setItem(ONBOARDING_KEY, "1");
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-background">
      {/* Кнопка пропустить */}
      <button onClick={finish}
        className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
        Пропустить <X className="h-3.5 w-3.5" />
      </button>

      {/* Прогресс */}
      <div className="absolute top-0 inset-x-0 flex gap-1 p-4 pt-safe">
        {STEPS.map((_, i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full rounded-full bg-primary"
              initial={{ width: i < step ? "100%" : "0%" }}
              animate={{ width: i < step ? "100%" : i === step ? "100%" : "0%" }}
              transition={{ duration: i === step ? 0.4 : 0 }} />
          </div>
        ))}
      </div>

      {/* Контент */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }}
            className="flex flex-col items-center">

            {/* Иконка */}
            <div className="mb-8 grid h-28 w-28 place-items-center rounded-[2rem] shadow-lift"
              style={{ backgroundColor: `${s.color}18` }}>
              <span className="text-6xl">{s.emoji}</span>
            </div>

            {/* Текст */}
            <h2 className="font-display text-3xl font-bold tracking-tight">{s.title}</h2>
            <p className="mt-4 max-w-xs text-base leading-relaxed text-muted-foreground">{s.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Кнопка */}
      <div className="px-6 pb-12 pb-safe">
        <button onClick={next}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-base font-semibold text-primary-foreground shadow-lift transition active:scale-[0.98]">
          {isLast ? "Начать" : "Далее"}
          <ArrowRight className="h-5 w-5" />
        </button>
        {/* Точки */}
        <div className="mt-5 flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <button key={i} onClick={() => { hapticLight(); setStep(i); }}
              className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
