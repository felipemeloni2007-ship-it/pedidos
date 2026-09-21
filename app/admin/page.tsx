import { AdminWorkspace } from "@/components/food/admin-workspace";

export const metadata = {
  title: "Painel operacional",
};

export default function AdminPage() {
  return <AdminWorkspace view="overview" />;
}
