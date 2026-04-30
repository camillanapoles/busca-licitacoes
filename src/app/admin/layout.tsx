import { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-muted/20 md:-mt-[65px]">
      <AdminSidebar />

      <main className="flex-1 p-4 md:p-8 md:pt-24 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
