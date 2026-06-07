import { WifiOff } from "lucide-react";
import { useOffline } from "@/hooks/use-offline";
import { motion, AnimatePresence } from "framer-motion";

export function OfflineBanner() {
  const isOffline = useOffline();

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-0 top-0 z-[200] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        >
          <WifiOff className="h-4 w-4 shrink-0" />
          Нет интернета — показываем кэшированные данные
        </motion.div>
      )}
    </AnimatePresence>
  );
}
