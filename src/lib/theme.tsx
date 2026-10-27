import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isHalloweenSeason } from "./season";

const Ctx = createContext<{ halloween: boolean }>({ halloween: false });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [halloween, setHalloween] = useState(false);
  useEffect(() => {
    const update = () => setHalloween(isHalloweenSeason(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("halloween", halloween);
  }, [halloween]);
  return <Ctx.Provider value={{ halloween }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
