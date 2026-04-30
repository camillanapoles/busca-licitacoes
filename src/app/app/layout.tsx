import { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-muted/20 md:-mt-16">
      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 md:pt-24 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
