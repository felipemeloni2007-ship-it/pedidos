import { redirect } from "next/navigation";

export const metadata = {
  title: "Central de pedidos",
};

export default function OrdersPage() {
  redirect("/painel");
}
