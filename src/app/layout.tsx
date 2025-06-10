// inspect-drive\src\app\layout.tsx

import "./globals.css";
import { ReactNode } from "react";
import Navbar from "@/components/Navbar"; // Import Navbar
import SessionProvider from "@/components/SessionProvider"; // Import SessionProvider

export const metadata = {
  title: "Inspect Drive",
  description: "ระบบจัดเก็บและแชร์ไฟล์",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-gradient-to-r from-blue-100 to-white">
        <SessionProvider>
          {/* Navbar อยู่ด้านบน */}
          <Navbar />

          {/* เนื้อหาอยู่ใน `main` ตามโครงสร้างที่เหมาะสม */}
          <main className="content-container h-screen overflow-auto pt-16">
            {children}
          </main>
        </SessionProvider>
      </body>
    </html>
  );
}
