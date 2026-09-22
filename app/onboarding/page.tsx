import { LiveOnboarding } from "@/components/food/live-onboarding";
import { requirePortalSession } from "@/lib/auth/portals";

export const metadata = {
  title: "Criar estabelecimento",
};

export default async function OnboardingPage() {
  await requirePortalSession("seller");
  return <LiveOnboarding />;
}
