// src/components/desktop/windowRegistry.tsx
'use client';

import type { ComponentProps, ComponentType, ReactElement } from 'react';
import { useDesktop } from '@/store/desktop';
import type { WinState } from '@/store/desktop';
import { useShallow } from 'zustand/react/shallow';
import Window from '@/components/desktop/Window';
import {
  BookOpen,
  CalendarDays,
  Keyboard,
  Search,
  UserCircle2,
} from 'lucide-react';

// Window bodies
import KundekortSearch from '@/components/windows/KundekortSearch';
import CustomerForm from '@/components/windows/CustomerForm';
import LogbookWindow from '@/components/windows/LogbookWindow';
import HotkeysHelp from '@/components/windows/HotkeysHelp';

// Calendar (singleton)
import BookingCalendar from '@/windows/BookingCalendar';

export interface WindowDef {
  id: string;
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  mount: (win: WinState) => ReactElement;
}

type CustomerFormPayload = ComponentProps<typeof CustomerForm>['payload'];
type HotkeysPayload = ComponentProps<typeof HotkeysHelp>['payload'];

const mountKundekortSearch: WindowDef['mount'] = () => <KundekortSearch />;
const mountCustomerForm: WindowDef['mount'] = ({ payload }) => (
  <CustomerForm payload={payload as CustomerFormPayload} />
);
const mountLogbook: WindowDef['mount'] = () => <LogbookWindow />;
const mountHotkeys: WindowDef['mount'] = ({ payload }) => (
  <HotkeysHelp payload={payload as HotkeysPayload} />
);
const mountBookingCalendar: WindowDef['mount'] = () => <BookingCalendar />;

// Map store `type` → window definition
const registry: Record<string, WindowDef> = {
  kundekortSearch: {
    id: 'kundekortSearch',
    title: 'Kundekort',
    icon: Search,
    mount: mountKundekortSearch,
  },
  kundekort_search: {
    id: 'kundekort_search',
    title: 'Kundekort',
    icon: Search,
    mount: mountKundekortSearch,
  },
  customerForm: {
    id: 'customerForm',
    title: 'Kundekort',
    icon: UserCircle2,
    mount: mountCustomerForm,
  },
  customer: {
    id: 'customer',
    title: 'Kundekort',
    icon: UserCircle2,
    mount: mountCustomerForm,
  },
  logbook: {
    id: 'logbook',
    title: 'Logbog',
    icon: BookOpen,
    mount: mountLogbook,
  },
  hotkeys: {
    id: 'hotkeys',
    title: 'Genveje',
    icon: Keyboard,
    mount: mountHotkeys,
  },
  hotkeys_help: {
    id: 'hotkeys_help',
    title: 'Genveje',
    icon: Keyboard,
    mount: mountHotkeys,
  },
  booking_calendar: {
    id: 'booking_calendar',
    title: 'Kalender',
    icon: CalendarDays,
    mount: mountBookingCalendar,
  },
};

export default function WindowRegistry() {
  const { order, windows } = useDesktop(
    useShallow((s) => ({ order: s.order, windows: s.windows })),
  );

  return (
    <>
      {order.map((id) => {
        const win = windows[id];
        if (!win) return null;

        const def = registry[win.type];
        if (!def) return null; // unmapped type → not rendered (still in taskbar)

        return (
          <Window key={id} win={win}>
            {def.mount(win)}
          </Window>
        );
      })}
    </>
  );
}
