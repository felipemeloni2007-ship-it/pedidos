import { AdminWorkspace } from "@/components/food/admin-workspace";

export const metadata = {
  title: "Central de pedidos",
};

export default function OrdersPage() {
  return <AdminWorkspace view="orders" />;
}
