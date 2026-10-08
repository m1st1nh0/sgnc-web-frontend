"use client";
import { AuthProvider } from "../../features/auth/components/AuthContext.jsx";
import { OnboardingProvider } from "../../features/onboarding/components/OnboardingContext.jsx";
import OnboardingInicialModal from "../../features/onboarding/components/OnboardingInicialModal.jsx";
import AppNavigation from "../../components/navigation/AppNavigation.jsx";
export default function Providers({ initialUser, navCompacta, children }) {
  return <AuthProvider initialUser={initialUser}><OnboardingProvider><OnboardingInicialModal /><AppNavigation compactaInicial={navCompacta}>{children}</AppNavigation></OnboardingProvider></AuthProvider>;
}
