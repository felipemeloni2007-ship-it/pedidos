import { redirect } from "next/navigation";

export const metadata = {
  title: "KDS",
};

export default function KdsPage() {
  redirect("/painel");
}
