"use client";
import { AuthProvider } from "../../features/auth/components/AuthContext.jsx";
import { OnboardingProvider } from "../../features/onboarding/components/OnboardingContext.jsx";
import OnboardingInicialModal from "../../features/onboarding/components/OnboardingInicialModal.jsx";
export default function Providers({ initialUser, children }) {
  return <AuthProvider initialUser={initialUser}><OnboardingProvider><OnboardingInicialModal />{children}</OnboardingProvider></AuthProvider>;
}
