import { redirect } from "next/navigation";

export const metadata = {
  title: "Painel operacional",
};

export default function AdminPage() {
  redirect("/plataforma");
}
