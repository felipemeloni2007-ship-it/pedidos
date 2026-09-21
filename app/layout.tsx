import type { Metadata } from "next";

import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mesa Pronta · Pedidos sem fricção",
    template: "%s · Mesa Pronta",
  },
  description:
    "Plataforma de pedidos e operação para negócios de food service.",
  applicationName: "Mesa Pronta",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Mesa Pronta",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
