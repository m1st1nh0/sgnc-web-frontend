"use client";
import { AuthProvider } from "@/legacy/context/AuthContext";
import { OnboardingProvider } from "@/legacy/context/OnboardingContext";
import OnboardingInicialModal from "@/legacy/components/onboarding/OnboardingInicialModal";
export default function Providers({ initialUser, children }) {
  return <AuthProvider initialUser={initialUser}><OnboardingProvider><OnboardingInicialModal />{children}</OnboardingProvider></AuthProvider>;
}
