import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import System from "@/models/system";
import paths from "@/utils/paths";

export default function useRedirectToHomeOnOnboardingComplete() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function checkOnboardingComplete() {
      const onboardingComplete = await System.isOnboardingComplete();

      if (!mounted || onboardingComplete !== true) return;

      // Avoid pushing another history entry when an already-completed user
      // lands on any onboarding route directly.
      if (location.pathname !== paths.home()) {
        navigate(paths.home(), { replace: true });
      }
    }

    checkOnboardingComplete();

    return () => {
      mounted = false;
    };
  }, [location.pathname, navigate]);
}
