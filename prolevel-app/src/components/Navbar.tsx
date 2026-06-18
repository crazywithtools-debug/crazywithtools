"use client";

import { useState, useEffect, memo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ChevronUp, ChevronDown } from 'lucide-react';
import { themeColorMix, themeBoxShadow, THEME_COLOR, ACTIVE_COLOR } from '@/lib/utils';
// Removed motion/react to avoid extra dependency; using simple CSS transitions.

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/customize', label: 'Customize' },
  { path: '/prolevel', label: 'Pro Level' },
  { path: '/about', label: 'About' },
];

function Navbar(): JSX.Element {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(true);
  const pathname = usePathname() || '/';

  useEffect(() => {
    const onScroll = () => setShowScrollDown(window.scrollY < 120);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Apply saved site customization on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('site_customization');
      if (saved) {
        const parsed = JSON.parse(saved);
        const root = document.documentElement;
        root.style.setProperty('--text-color', parsed.textColor || '#ffffff');
        root.style.setProperty('--active-color', parsed.activeColor || '#ffffff');
          root.style.setProperty('--button-bg-color', parsed.buttonBgColor || '#10B981');
          root.style.setProperty('--button-text-color', parsed.buttonTextColor || '#000000');
        root.style.setProperty('--theme-color', parsed.themeColor || '#ffffff');
        if (parsed.backgroundImage) {
          root.style.setProperty('--bg-image', `url(${parsed.backgroundImage})`);
          document.body.style.backgroundImage = `url(${parsed.backgroundImage})`;
          document.body.style.backgroundSize = 'cover';
          document.body.style.backgroundPosition = 'center';
        }
      }
    } catch (e) {
      // ignore
    }
  }, []);

  return (
    <div className="no-print sticky top-[15px] left-0 right-0 z-[1000] flex justify-center font-poppins px-2 sm:px-4">
      <div className="w-full lg:w-3/5 mx-auto">
        <div className="w-full h-[45px] md:h-[50px] flex items-center justify-between gap-3 md:gap-4">
          <div className="flex-1 h-full flex items-center justify-end">
            <div className="w-full h-full border rounded-full px-3 md:px-6 flex items-center justify-between shadow-2xl" style={{
              borderColor: themeColorMix(90),
              background: 'rgba(255, 255, 255, 0.007)',
              backdropFilter: 'blur(2.5px)',
              WebkitBackdropFilter: 'blur(6px)'
            }}>
              <Link href="/" className="flex items-center gap-2 group shrink-0">
                <span className="font-black text-lg md:text-xl uppercase tracking-tighter" style={{ color: THEME_COLOR }}>Crazy</span>
              </Link>

              {/* Desktop Links */}
              <div className="hidden md:flex ml-auto items-center gap-6 lg:gap-8 h-full justify-end">
                {navLinks.map((link) => {
                  const isActive = pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      href={link.path}
                      className="relative text-[11px] md:text-[12px] font-bold uppercase tracking-widest transition-all h-full flex items-center group min-h-[44px]"
                        style={{ color: THEME_COLOR }}
                    >
                      <span className={isActive ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}>{link.label}</span>
                      <div
                        className={`absolute bottom-2 left-0 right-0 h-[2px] rounded-full transition-all origin-left ${isActive ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0'}`}
                        style={{ backgroundColor: ACTIVE_COLOR }}
                      />
                    </Link>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 md:gap-4">
                {/* Mobile Menu Toggle */}
                <button
                  className="md:hidden min-h-[44px] min-w-[44px] p-2 rounded-lg transition-colors flex items-center justify-center hover:bg-white/5"
                    style={{ color: THEME_COLOR }}
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  aria-label="Toggle menu"
                  aria-expanded={isMobileMenuOpen}
                >
                  {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>
            </div>
            </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-x-2 sm:inset-x-4 top-[65px] md:top-[75px] mx-auto bg-zinc-900/95 backdrop-blur-2xl border md:hidden flex flex-col p-3 md:p-4 gap-1 shadow-2xl rounded-2xl z-[1000]"
          style={{ borderColor: themeColorMix(80), transformOrigin: 'top center', maxWidth: '720px' }}
        >
          {navLinks.map((link) => {
            const isActive = pathname === link.path;
            return (
                <Link
                key={link.path}
                href={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className="relative font-bold uppercase tracking-widest text-xs md:text-sm py-3 px-4 rounded-xl transition-all min-h-[44px] flex items-center"
                style={{ color: THEME_COLOR, backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent' }}
              >
                {link.label}
                {isActive && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full"
                    style={{ backgroundColor: ACTIVE_COLOR }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(Navbar);
