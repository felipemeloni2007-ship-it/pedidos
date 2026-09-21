import { OnboardingWizard } from "@/components/food/onboarding-wizard";
import { requirePortalSession } from "@/lib/auth/portals";

export const metadata = {
  title: "Criar estabelecimento",
};

export default async function OnboardingPage() {
  await requirePortalSession("seller");
  return <OnboardingWizard />;
}
