// inspect-drive\src\components\Navbar.tsx

"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  KeyboardEvent,
  MouseEvent,
} from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

// ค่าคงที่สำหรับเมนูหลักเพื่อการบำรุงรักษาที่ดีขึ้น
const MAIN_MENU_ITEMS = [
  { href: "/", label: "Upload" },
  { href: "/drive", label: "Drive" },
  { href: "/share", label: "Share" },
  { href: "/deptshare", label: "DeptShare" },
] as const;

const AUTH_LINKS = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
] as const;

export default function Navbar() {
  const { data: session, status } = useSession();

  // สถานะเมนูมือถือ
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // สถานะ dropdown ผู้ใช้
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Refs สำหรับการเข้าถึงและการตรวจสอบคลิกภายนอก
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  // กำหนด aria-expanded ผ่าน DOM API เพื่อหลีกเลี่ยงปัญหา linter
  useEffect(() => {
    if (userButtonRef.current) {
      userButtonRef.current.setAttribute(
        "aria-expanded",
        isUserMenuOpen ? "true" : "false"
      );
    }
    if (mobileButtonRef.current) {
      mobileButtonRef.current.setAttribute(
        "aria-expanded",
        isMobileMenuOpen ? "true" : "false"
      );
    }
  }, [isUserMenuOpen, isMobileMenuOpen]);

  // ฟังก์ชันสลับเมนูที่จำได้ (memoized)
  const toggleMobileMenu = useCallback((e?: MouseEvent | KeyboardEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsMobileMenuOpen(prev => !prev);
    // ปิดเมนูผู้ใช้เมื่อเปิดเมนูมือถือ
    setIsUserMenuOpen(false);
  }, []);

  const toggleUserMenu = useCallback((e?: MouseEvent | KeyboardEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setIsUserMenuOpen(prev => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);
  const closeUserMenu = useCallback(() => setIsUserMenuOpen(false), []);
  const closeAllMenus = useCallback(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, []);

  // ตัวจัดการคลิกภายนอกที่ปรับปรุงประสิทธิภาพ
  const handleClickOutside = useCallback<EventListener>((event) => {
    const target = event.target as Node;

    // ตรวจสอบว่าคลิกอยู่ในปุ่มหรือเนื้อหาเมนูมือถือ
    const isMobileButtonClick = mobileButtonRef.current?.contains(target);
    const isMobileMenuClick = mobileMenuRef.current?.contains(target);

    // ตรวจสอบว่าคลิกอยู่ในปุ่มหรือเนื้อหาเมนูผู้ใช้
    const isUserButtonClick = userButtonRef.current?.contains(target);
    const isUserMenuClick = userMenuRef.current?.contains(target);

    // ปิดเมนูมือถือเฉพาะเมื่อคลิกภายนอกทั้งปุ่มและเมนู
    if (!isMobileButtonClick && !isMobileMenuClick && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }

    // ปิดเมนูผู้ใช้เฉพาะเมื่อคลิกภายนอกทั้งปุ่มและเมนู
    if (!isUserButtonClick && !isUserMenuClick && isUserMenuOpen) {
      setIsUserMenuOpen(false);
    }
  }, [isMobileMenuOpen, isUserMenuOpen]);

  // Effect สำหรับการตรวจสอบคลิกภายนอก
  useEffect(() => {
    if (!isMobileMenuOpen && !isUserMenuOpen) return;

    // ใช้ setTimeout เพื่อหลีกเลี่ยงการ trigger ทันที
    const timeoutId = setTimeout(() => {
      const events = ['mousedown', 'touchstart'] as const;
      events.forEach(event => {
        document.addEventListener(event, handleClickOutside, true);
      });
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      const events = ['mousedown', 'touchstart'] as const;
      events.forEach(event => {
        document.removeEventListener(event, handleClickOutside, true);
      });
    };
  }, [isMobileMenuOpen, isUserMenuOpen, handleClickOutside]);

  // ตัวจัดการการนำทางด้วยคีย์บอร์ด
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeAllMenus();
    }
  }, [closeAllMenus]);

  // ตัวจัดการออกจากระบบที่ปรับปรุงแล้ว
  const handleLogout = useCallback(async () => {
    closeAllMenus();
    try {
      await signOut({ redirect: true, callbackUrl: '/' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [closeAllMenus]);

  return (
    <nav
      className="fixed top-0 z-50 w-full bg-white shadow-md"
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto max-w-auto px-6">
        <div className="flex h-16 items-center justify-between">

          {/* การนำทางเดสก์ท็อป - ด้านซ้าย */}
          <div className="hidden md:flex md:space-x-6">
            {MAIN_MENU_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* ปุ่มเมนู hamburger มือถือ - ด้านขวา */}
          <div className="flex md:hidden ml-auto">
            <button
              ref={mobileButtonRef}
              type="button"
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors duration-200"
              aria-controls="mobile-menu"
              aria-label="เปิดเมนูหลัก"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={isMobileMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                  }
                />
              </svg>
            </button>
          </div>

          {/* ส่วนการยืนยันตัวตนเดสก์ท็อป - ด้านขวา */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {status === "loading" && (
              <div className="flex items-center space-x-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                <span className="text-gray-500 text-sm">Loading...</span>
              </div>
            )}

            {status === "unauthenticated" && (
              <div className="flex space-x-4">
                {AUTH_LINKS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}

            {session?.user && (
              <div ref={userMenuRef} className="relative">
                <button
                  ref={userButtonRef}
                  type="button"
                  onClick={toggleUserMenu}
                  className="flex items-center space-x-2 rounded-full bg-gray-50 px-3 py-2 text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors duration-200"
                  aria-haspopup="menu"
                  aria-controls="user-menu"
                >
                  <svg
                    className="h-8 w-8"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2a5 5 0 100 10 5 5 0 000-10zM2 18a8 8 0 1116 0H2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-medium truncate max-w-32">
                    {session.user.name}
                  </span>
                  <svg
                    className={`h-4 w-4 transition-transform duration-200 ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* เมนู Dropdown ผู้ใช้ */}
                {isUserMenuOpen && (
                  <div
                    id="user-menu"
                    role="menu"
                    className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in-95 duration-100"
                  >
                    <Link
                      href="/account/password"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-150"
                      role="menuitem"
                      onClick={closeUserMenu}
                    >
                      เปลี่ยนรหัสผ่าน
                    </Link>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 transition-colors duration-150"
                      role="menuitem"
                      onClick={handleLogout}
                    >
                      ออกจากระบบ
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* เมนูมือถือ */}
        {isMobileMenuOpen && (
          <div
            ref={mobileMenuRef}
            id="mobile-menu"
            className="md:hidden border-t border-gray-200 bg-white animate-in slide-in-from-top-5 duration-200"
          >
            <div className="space-y-1 px-2 pb-3 pt-2">

              {/* ลิงก์การยืนยันตัวตนก่อน (มือถือ) */}
              {status === "loading" && (
                <div className="flex items-center justify-center space-x-2 px-3 py-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                  <span className="text-gray-500 text-sm">กำลังโหลด...</span>
                </div>
              )}

              {status === "unauthenticated" && (
                <div className="space-y-1 border-b border-gray-200 pb-3 mb-3">
                  {AUTH_LINKS.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors duration-200"
                      onClick={closeMobileMenu}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}

              {session?.user && (
                <div className="space-y-1 border-b border-gray-200 pb-3 mb-3">
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-3">
                      <svg
                        className="h-12 w-12 text-gray-400"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 2a5 5 0 100 10 5 5 0 000-10zM2 18a8 8 0 1116 0H2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <div>
                        <div className="text-base font-medium text-gray-800">
                          {session.user.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {session.user.email}
                        </div>
                      </div>
                    </div>
                  </div>
                  <Link
                    href="/account/password"
                    className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors duration-200"
                    onClick={closeMobileMenu}
                  >
                    เปลี่ยนรหัสผ่าน
                  </Link>
                  <button
                    type="button"
                    className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-red-600 hover:bg-gray-100 transition-colors duration-200"
                    onClick={handleLogout}
                  >
                    ออกจากระบบ
                  </button>
                </div>
              )}

              {/* ลิงก์การนำทางหลัก */}
              <div className="space-y-1">
                {MAIN_MENU_ITEMS.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-600 transition-colors duration-200"
                    onClick={closeMobileMenu}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}