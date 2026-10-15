import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProvider } from "@/components/providers";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "CardioVision 3D — AI Cardiovascular Risk Prediction & Visualization",
  description:
    "Experimental clinical decision-support prototype: CAD and vessel-level stenosis probability estimation with interactive 3D coronary visualization and model explanations.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#060b16] text-slate-200 antialiased">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
