import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { useServiceWorkerUpdate } from "@/hooks/use-sw-update";
import { hapticSuccess } from "@/hooks/use-native";

export function UpdateBanner() {
  const { hasUpdate, apply } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(false);

  return (
    <AnimatePresence>
      {hasUpdate && !dismissed && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="fixed bottom-20 inset-x-4 z-[250] flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lift lg:bottom-6 lg:left-auto lg:right-6 lg:w-80"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Доступно обновление</p>
            <p className="text-xs text-muted-foreground">Новая версия Ценомера готова</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => { hapticSuccess(); apply(); }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Обновить
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
