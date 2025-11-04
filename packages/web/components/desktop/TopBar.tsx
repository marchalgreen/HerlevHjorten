// src/components/desktop/TopBar.tsx
'use client';

import { cn } from '@/lib/utils/cn';
import { useDesktop } from '@/store/desktop';
import { useUI } from '@/store/ui';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  MagnifyingGlass,
  Plus,
  Printer,
  GearSix,
  Keyboard,
  FileText,
  Package,
  User,
  CaretUp,
  CaretDown,
  CalendarBlank,
} from '@phosphor-icons/react';
import { NotificationsBell } from '@/components/notifications/Notifications';
import { NOTIFICATIONS_MOCK } from '@/data/notifications.mock';
import { useNotifications } from '@/store/notifications';
import WidgetManager from '@/components/desktop/widgets/WidgetManager';

// New light refactor pieces
import GlassFrame from './topbar/GlassFrame';
import SplitNewButton from './topbar/SplitNewButton';
import ProfileBadge from './topbar/ProfileBadge';

/* =========================================================
   Tokens
========================================================= */

const TYPE_COLORS: Record<string, string> = {
  booking_calendar: '210 100% 56%',
  logbook: '262 83% 58%',
  // inventory: '38 92% 50%', // removed in minimal template
  hotkeys: '210 10% 46%',
  search: '210 100% 56%',
};

const EMP_NAME: Record<string, string> = {
  'soren-nichlas-frid': 'Søren Nichlas Frid',
  'lars-madsen': 'Lars Madsen',
  'dorthea-norgaard': 'Dorthea Nørgaard',
  'michelle-fridahl': 'Michelle Fridahl',
  'rasmus-frid-norgaard': 'Rasmus Frid Nørgaard',
  'mette-sorensen': 'Mette Sørensen',
};

const ICON_BTN_BASE =
  'group relative inline-flex items-center justify-center rounded-xl h-10 w-10 sm:h-[42px] sm:w-[42px] ' +
  'text-zinc-700 transition-all duration-250 ease-[cubic-bezier(.22,.7,.2,1)] ' +
  'bg-white/65 ring-1 ring-white/60 shadow-sm backdrop-blur-md ' +
  'hover:scale-[1.05] hover:bg-white/80 hover:shadow-[0_0_10px_rgba(59,130,246,0.12)] active:scale-[.96]';

/* =========================================================
   Primitives
========================================================= */

function IconButton({
  title,
  children,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={ICON_BTN_BASE}
      style={{ WebkitBackdropFilter: 'blur(10px)', backdropFilter: 'blur(10px)' }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(120% 160% at 50% 50%, rgba(59,130,246,0.15), transparent 70%)',
        }}
      />
      <span className="relative z-[1] flex items-center justify-center text-[16px] sm:text-[17px]">
        {children}
      </span>
    </button>
  );
}

/* =========================================================
   Component
========================================================= */

export default function TopBar() {
  // Seed notifications once
  useEffect(() => {
    useNotifications.getState().seedIfEmpty(NOTIFICATIONS_MOCK);
  }, []);

  const open = useDesktop((s) => s.open);
  const windows = useDesktop((s) => s.windows);
  const { openSearch, searchOpen } = useUI();

  const isOpen = useMemo(
    () => (type: string) => Object.values(windows).some((w) => w.type === type && !w.minimized),
    [windows],
  );

  const [employee, setEmployee] = useState<{ slug: string; name: string } | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  // Close settings when clicking outside
  useEffect(() => {
    if (!settingsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!settingsRef.current) return;
      if (!settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [settingsOpen]);

  const [scanOpen, setScanOpen] = useState(false);
  // Robust open hook: listen on both window & document, and expose a callable
  // ID scan overlay removed in minimal template

  useEffect(() => {
    const set = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : null);
    set();
    window.addEventListener('online', set);
    window.addEventListener('offline', set);
    return () => {
      window.removeEventListener('online', set);
      window.removeEventListener('offline', set);
    };
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const j = await res.json();
      const slug: string | undefined = j?.employee?.slug;
      if (slug) {
        const name =
          EMP_NAME[slug] ||
          slug
            .split('-')
            .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ');
        setEmployee({ slug, name });
        setAvatarError(false);
      } else {
        setEmployee(null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    window.addEventListener('emp:transition:login', fetchMe);
    return () => window.removeEventListener('emp:transition:login', fetchMe);
  }, [fetchMe]);

  const [hidden, setHidden] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('topbar:hidden') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      if (hidden) localStorage.setItem('topbar:hidden', '1');
      else localStorage.removeItem('topbar:hidden');
    } catch {}
    window.dispatchEvent(new Event('resize'));
  }, [hidden]);

  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
    const onScroll = () => setCompact(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [perfDrag, setPerfDrag] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setPerfDrag(el.getAttribute('data-dragging') === '1');
    const mo = new MutationObserver(update);
    mo.observe(el, { attributes: true, attributeFilter: ['data-dragging'] });
    update();
    return () => mo.disconnect();
  }, []);

  const activeTintHsl = useMemo(() => {
    if (searchOpen) return TYPE_COLORS['search'];
    const order = ['booking_calendar', 'logbook', 'hotkeys'];
    const found = order.find((t) => isOpen(t));
    return found ? TYPE_COLORS[found] : null;
  }, [searchOpen, isOpen]);

  // Create actions
  type CreateAction = 'customer' | 'booking';
  const lastCreateRef = useRef<CreateAction>('customer');
  useEffect(() => {
    try {
      const s = localStorage.getItem('create:last') as CreateAction | null;
      if (s) lastCreateRef.current = s;
    } catch {}
  }, []);
  const persistCreate = (a: CreateAction) => {
    lastCreateRef.current = a;
    try {
      localStorage.setItem('create:last', a);
    } catch {}
  };
  const launchCreate = (a: CreateAction) => {
    persistCreate(a);
    if (a === 'customer') {
      open({ type: 'customer', title: 'Kundekort', payload: { fromEl: 'launcher-customer-top' } });
    } else if (a === 'booking') {
      open({
        type: 'booking_calendar',
        title: 'Kalender',
        payload: { fromEl: 'launcher-booking-top', intent: 'new_booking' },
      });
    }
  };

  return (
    <>
      {/* Pull-down handle (when hidden) */}
      {hidden && (
        <button
          type="button"
          title="Vis værktøjslinje"
          onClick={() => setHidden(false)}
          className={cn(
            'fixed left-1/2 top-2 z-[65] -translate-x-1/2',
            'rounded-full px-2.5 py-1.5 text-[12px] font-medium',
            'bg-white/80 ring-1 ring-white/70 shadow-md',
            'text-zinc-700 hover:bg-white/90 active:bg-white',
          )}
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
        >
          <div className="flex items-center gap-1.5">
            <CaretDown className="h-4 w-4" />
            <span>Vis menu</span>
          </div>
        </button>
      )}

      <header
        data-topbar
        className={cn(
          'fixed inset-x-0 top-0 z-[60] mx-auto max-w-[1400px] px-4 sm:px-6',
          'transition-transform duration-200 ease-out',
          hidden ? '-translate-y-[140%]' : 'translate-y-0',
        )}
      >
        <div className={cn('relative', compact ? 'mt-1' : 'mt-2', 'rounded-[14px]')}>
          <GlassFrame tintHsl={activeTintHsl} compact={compact} perfDrag={perfDrag} />
          <div
            className={cn(
              'relative flex items-center justify-between gap-3 px-3 flex-nowrap',
              compact ? 'py-1.5' : 'py-2',
            )}
          >
            {/* Left: brand + chips */}
            <div className="flex items-center flex-shrink gap-2 md:gap-2.5 min-w-0">
              <img
                src="/branding/Clairity_purple_text.svg"
                alt="Clairity"
                className={cn('mr-1.5 w-auto select-none', compact ? 'h-4' : 'h-5')}
              />
              <div
                className={cn(
                  'hidden sm:flex items-center gap-2',
                  'flex-nowrap overflow-x-auto min-w-0',
                  '[-ms-overflow-style:none] [scrollbar-width:none]',
                )}
                style={{
                  WebkitOverflowScrolling: 'touch',
                  WebkitMaskImage:
                    'linear-gradient(to right, rgba(0,0,0,1) 85%, rgba(0,0,0,.6) 92%, rgba(0,0,0,0) 100%)',
                  maskImage:
                    'linear-gradient(to right, rgba(0,0,0,1) 85%, rgba(0,0,0,.6) 92%, rgba(0,0,0,0) 100%)',
                }}
              >
                <Chip
                  id="launcher-customer-top"
                  label="Kundekort"
                  icon={User}
                  active={!!searchOpen}
                  onClick={() => openSearch()}
                  tintHsl={TYPE_COLORS['search']}
                />
                <Chip
                  id="launcher-booking-top"
                  label="Booking"
                  icon={CalendarBlank}
                  active={isOpen('booking_calendar')}
                  onClick={() =>
                    open({
                      type: 'booking_calendar',
                      title: 'Kalender',
                      payload: { fromEl: 'launcher-booking-top' },
                    })
                  }
                  tintHsl={TYPE_COLORS['booking_calendar']}
                />
                <Chip
                  id="launcher-logbook-top"
                  label="Logbog"
                  icon={FileText}
                  active={isOpen('logbook')}
                  onClick={() =>
                    open({
                      type: 'logbook',
                      title: 'Logbog',
                      payload: { fromEl: 'launcher-logbook-top' },
                    })
                  }
                  tintHsl={TYPE_COLORS['logbook']}
                />
                {/* Inventory removed in minimal template */}
                <Chip
                  id="launcher-hotkeys-top"
                  label="Genveje"
                  icon={Keyboard}
                  active={isOpen('hotkeys')}
                  onClick={() =>
                    open({
                      type: 'hotkeys',
                      title: 'Keyboard Shortcuts',
                      payload: { fromEl: 'launcher-hotkeys-top' },
                    })
                  }
                  tintHsl={TYPE_COLORS['hotkeys']}
                />
              </div>
            </div>

            {/* Middle: separator + search */}
            <div className="flex items-center flex-1 basis-[260px] max-w-[520px] gap-2 min-w-0">
              <div className="hidden md:block h-6 w-px bg-gradient-to-b from-transparent via-white/60 to-transparent opacity-70" />
              <div className="relative flex-1 min-w-[200px]">
                <input
                  placeholder="Søg kunder, varer, ordrer…"
                  onFocus={() => openSearch()}
                  onClick={() => openSearch()}
                  readOnly
                  className={cn(
                    'h-[38px] w-full rounded-lg pl-8 pr-8 text-[13px] font-medium',
                    'bg-white/70 ring-1 ring-white/60 focus:ring-2 focus:ring-sky-400/60',
                    'placeholder:text-zinc-500 text-zinc-900 outline-none transition-all duration-200 ease-[cubic-bezier(.22,.7,.2,1)]',
                  )}
                  style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
                />
                <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <kbd
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-white/70 bg-white/70 px-1.5 py-0.5 text-[10px] text-zinc-600 shadow-sm"
                  title="Tryk / for at søge"
                >
                  /
                </kbd>
              </div>
            </div>

            {/* Right: actions + profile */}
            <div className="flex items-center justify-end gap-1.5 flex-shrink-0">
              <SplitNewButton
                onPrimary={() =>
                  window.dispatchEvent(
                    new CustomEvent('open-command-palette', { detail: { intent: 'new_customer' } }),
                  )
                }
                onNewCustomer={() => launchCreate('customer')}
                onNewBooking={() => launchCreate('booking')}
                onNewOrder={() => { /* inventory removed */ }}
                tints={{
                  customer: TYPE_COLORS.search,
                  booking: TYPE_COLORS.booking_calendar,
                  order: TYPE_COLORS.search,
                }}
              />

              <IconButton title="Udskriv">
                <Printer className="h-4 w-4" />
              </IconButton>

              <NotificationsBell initialItems={NOTIFICATIONS_MOCK} className={ICON_BTN_BASE} />

              {/* Settings dropdown (Tahoe glass) */}
              <div className="relative" ref={settingsRef}>
                <IconButton title="Indstillinger" onClick={() => setSettingsOpen((v) => !v)}>
                  <GearSix className="h-4 w-4" />
                </IconButton>

                {settingsOpen && (
                  <div
                    className={cn(
                      'absolute right-0 mt-2 w-56 rounded-xl border border-white/60 bg-white/80 backdrop-blur-lg shadow-lg',
                      'py-1 text-[13px] z-[70]',
                    )}
                  >
                    <button
                      className="block w-full text-left px-3 py-2 hover:bg-white/70"
                      onClick={() => {
                        setManagerOpen(true);
                        setSettingsOpen(false);
                      }}
                    >
                      Widgets…
                    </button>

                    <div className="my-1 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />

                    <button
                      className="block w-full text-left px-3 py-2 hover:bg-white/70"
                      onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
                    >
                      Kommandoer…
                    </button>
                    <button
                      className="block w-full text-left px-3 py-2 hover:bg-white/70"
                      onClick={() => setHidden(true)}
                    >
                      Skjul menu
                    </button>
                  </div>
                )}
              </div>

              <ProfileBadge
                employee={employee}
                online={online}
                onErrorAvatar={() => setAvatarError(true)}
              />

              <IconButton title="Skjul menu" onClick={() => setHidden(true)}>
                <CaretUp className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>
      </header>
      <WidgetManager open={managerOpen} onClose={() => setManagerOpen(false)} />

      {/* IDScanOverlay removed in minimal template */}
    </>
  );
}

/** Chip kept local to avoid churn */
function Chip({
  label,
  icon: Icon,
  onClick,
  active = false,
  id,
  tintHsl,
}: {
  label: string;
  icon: any;
  onClick: () => void;
  active?: boolean;
  id?: string;
  tintHsl?: string | null;
}) {
  const tint = tintHsl || '210 100% 56%';
  return (
    <button
      id={id}
      onClick={onClick}
      title={label}
      className={cn(
        'group relative inline-flex h-9 items-center gap-2 rounded-full px-3 shrink-0',
        'ring-1 shadow-sm transition-all duration-300 ease-[cubic-bezier(.22,.7,.2,1)]',
        active ? 'text-sky-800' : 'bg-white/70 hover:bg-white/85 ring-white/60 text-zinc-700',
      )}
      style={
        active
          ? {
              background: `linear-gradient(to bottom, hsla(${tint} / .12), hsla(${tint} / .08))`,
              borderColor: `hsla(${tint} / .5)`,
              boxShadow: `0 0 8px hsla(${tint} / .45), inset 0 0 6px hsla(${tint} / .12)`,
              color: `hsl(${tint.split(' ')[0]} 70% 25%)`,
            }
          : {}
      }
    >
      <span
        className="absolute inset-0 rounded-full opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-[1.01]"
        style={{
          background: `radial-gradient(120% 140% at 50% 50%, hsla(${tint} / .22), transparent 70%)`,
        }}
        aria-hidden
      />
      <Icon
        className={cn(
          'relative z-[1] h-4 w-4 transition-all duration-300',
          active ? '' : 'text-zinc-600 group-hover:text-zinc-800',
        )}
        style={
          active
            ? { color: `hsl(${tint})`, filter: `drop-shadow(0 0 6px hsla(${tint} / .6))` }
            : { color: `hsl(${tint.split(' ')[0]} 20% 45%)` }
        }
        weight={active ? 'fill' : 'regular'}
      />
      <span className="relative z-[1] font-medium text-[13px]">{label}</span>
    </button>
  );
}
