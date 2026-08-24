import { createContext, useEffect, useState } from "react";
import SovereignLogo from "./media/logo/sovereign-ai.svg";
import System from "./models/system";

export const REFETCH_LOGO_EVENT = "refetch-logo";

function isLightMode() {
  return document.documentElement.getAttribute("data-theme") === "light";
}
export const LogoContext = createContext();

export function LogoProvider({ children }) {
  const [logo, setLogo] = useState(SovereignLogo);
  const [loginLogo, setLoginLogo] = useState(SovereignLogo);
  const [isCustomLogo, setIsCustomLogo] = useState(false);

  async function fetchInstanceLogo() {
    try {
      const { isCustomLogo, logoURL } = await System.fetchLogo();
      if (logoURL && isCustomLogo) {
        setLogo(logoURL);
        setLoginLogo(logoURL);
        setIsCustomLogo(true);
      } else {
        setLogo(SovereignLogo);
        setLoginLogo(SovereignLogo);
        setIsCustomLogo(false);
      }
    } catch {
      setLogo(SovereignLogo);
      setLoginLogo(SovereignLogo);
      setIsCustomLogo(false);
    }
  }

  useEffect(() => {
    fetchInstanceLogo();
    window.addEventListener(REFETCH_LOGO_EVENT, fetchInstanceLogo);
    return () => {
      window.removeEventListener(REFETCH_LOGO_EVENT, fetchInstanceLogo);
    };
  }, []);

  return (
    <LogoContext.Provider value={{ logo, setLogo, loginLogo, isCustomLogo }}>
      {children}
    </LogoContext.Provider>
  );
}
