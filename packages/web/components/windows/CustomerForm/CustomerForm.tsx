'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDesktop } from '@/store/desktop';
import { useShallow } from 'zustand/react/shallow';
import { toast } from 'sonner';
import { hueFromString } from '@/lib/utils/customerAccent';
import { cn } from '@/lib/utils/cn';
import type { Customer } from '@/lib/mock/customers';

// Icons / UI
import {
  CalendarCheck,
  NotePencil,
  Printer,
  ChatCircleDots,
  CurrencyDollar,
  Eyeglasses,
  Ruler,
  Wrench,
  FolderSimple,
  FloppyDisk,
  Tag,
  CaretDown,
  Notebook,
  Package,
  IdentificationBadge,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TooltipProvider } from '@/components/ui/tooltip';

// Local
import SegmentedPills from '@/components/ui/SegmentedPills';
import CustomerDetails from './CustomerDetails';
import CustomerOrders from './CustomerOrders';
import DatePopover from '@/components/ui/DatePopover';

/* ---------- helpers ---------- */

function normalizeCpr(raw: string) {
  const digits = (raw || '').replace(/\D+/g, '').slice(0, 10);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}
function toMasked(cprFull?: string) {
  if (!cprFull) return undefined;
  const n = normalizeCpr(cprFull);
  const [front] = n.split('-');
  return front ? `${front}-xxxx` : undefined;
}
function ddmmyyFromISO(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(-2);
  return `${dd}${mm}${yy}`;
}
function mergeCprFront(newFront: string, cprFull?: string, cprMasked?: string) {
  const last4 =
    (cprFull && cprFull.replace(/\D+/g, '').slice(-4)) || (cprMasked && 'xxxx') || 'xxxx';
  return `${newFront}-${last4}`;
}
function isoFromCprFront(front: string, existingBirthISO?: string) {
  if (!/^\d{6}$/.test(front)) return '';
  const dd = parseInt(front.slice(0, 2), 10);
  const mm = parseInt(front.slice(2, 4), 10);
  const yy = parseInt(front.slice(4, 6), 10);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return '';
  let century = 1900;
  if (existingBirthISO) {
    const y = new Date(existingBirthISO).getUTCFullYear();
    century = Math.floor(y / 100) * 100;
  }
  const fullY = century + yy;
  const d = new Date(Date.UTC(fullY, mm - 1, dd));
  if (d.getUTCFullYear() !== fullY || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd)
    return '';
  return d.toISOString().slice(0, 10);
}

/* ---------- main ---------- */

// ✅ allow opening in new/edit mode with scan overlay
type Props = { payload?: { customer?: Customer; openScan?: boolean } };
type Tab = 'details' | 'orders';

export default function CustomerForm({ payload }: Props) {
  const incoming = payload?.customer;

  // Minimal draft for new mode
  const makeDraft = (): Customer => ({
    id: `new_${Math.random().toString(36).slice(2, 7)}`,
    firstName: '',
    lastName: '',
    gender: undefined,
    birthdate: undefined,
    email: '',
    phoneMobile: '',
    phoneWork: '',
    address: { street: '', postalCode: '', city: '', country: 'Danmark' },
    tags: [],
    notes: '',
    customerNo: undefined,
    lastActivity: undefined,
    balanceDKK: undefined,
    cprMasked: undefined,
    cprFull: undefined,
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString().slice(0, 10),
    marketingConsent: true,
    preferredChannel: 'sms',
    language: 'da',
  });

  // Always have a local record (either normalized incoming or draft)
  const [local, setLocal] = useState<Customer>(() =>
    incoming
      ? {
          ...incoming,
          address: {
            street: incoming.address?.street || '',
            postalCode: incoming.address?.postalCode || '',
            city: incoming.address?.city || '',
            country: incoming.address?.country || 'Danmark',
          },
        }
      : makeDraft(),
  );

  const [showCpr, setShowCpr] = useState(false);
  const [editingCPR, setEditingCPR] = useState(false);
  const [tmpCPR, setTmpCPR] = useState<string>(normalizeCpr(local.cprFull || ''));

  const [tab, setTab] = useState<Tab>('details');
  const [dirty, setDirty] = useState(false);
  const openWin = useDesktop(useShallow((s) => s.open));

  const hue = useMemo(
    () => hueFromString(`${local.id || local.customerNo || local.email || ''}`),
    [local],
  );

  useEffect(() => {
    setTmpCPR(normalizeCpr(local.cprFull || ''));
  }, [local.cprFull]);

  // ID scan overlay removed in minimal template

  const handleSave = React.useCallback(() => {
    setDirty(false);
    toast.success('Kundekort gemt', {
      description: `${local.firstName} ${local.lastName}`.trim() || 'Ny kunde',
    });
  }, [local.firstName, local.lastName]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  const touch = (assign: (c: Customer, v: string) => void) => (v: string) => {
    setLocal((prev) => {
      const clone: Customer = { ...prev, address: { ...prev.address } };
      assign(clone, v);
      return clone;
    });
    setDirty(true);
  };

  const initials = `${local.firstName?.[0] ?? ''}${local.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <TooltipProvider delayDuration={80}>
      <div
        className="space-y-4"
        style={{ '--cust-hue': String(hue) } as React.CSSProperties & Record<'--cust-hue', string>}
      >
        {/* HEADER */}
        <div
          className="rounded-xl border border-border card-surface p-3"
          style={{ boxShadow: `inset 0 3px 0 hsl(${hue} 90% 88% / .55)` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-xl text-sm font-semibold"
              style={{
                backgroundColor: `hsl(${hue} 90% 96%)`,
                boxShadow: `inset 0 0 0 1px hsl(${hue} 40% 50% / .35)`,
              }}
            >
              {initials || 'KK'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-semibold">
                {local.firstName || local.lastName ? (
                  <>
                    {local.firstName} {local.lastName}
                  </>
                ) : (
                  'Ny kunde'
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/65">
                {/* Customer number */}
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  title="Kopiér kundenummer"
                  onClick={() => {
                    const id = String(local.customerNo ?? local.id ?? '');
                    if (!id) return;
                    navigator.clipboard?.writeText?.(id);
                    toast.success('Kundenummer kopieret', { description: `#${id}` });
                  }}
                >
                  #{local.customerNo ?? '—'}
                </button>

                <span className="inline-block h-[3px] w-[3px] rounded-full bg-foreground/40" />

                {local.address.postalCode && local.address.city ? (
                  <span>
                    {local.address.postalCode} {local.address.city}
                  </span>
                ) : (
                  <span>—</span>
                )}

                <span className="inline-block h-[3px] w-[3px] rounded-full bg-foreground/40" />

                {/* Birthdate (syncs CPR) */}
                <DatePopover
                  value={local.birthdate || ''}
                  onChange={(iso) => {
                    setLocal((prev) => {
                      const front = ddmmyyFromISO(iso);
                      const merged = mergeCprFront(front, prev.cprFull, prev.cprMasked);
                      return {
                        ...prev,
                        birthdate: iso,
                        cprFull: merged.includes('xxxx') ? undefined : merged,
                        cprMasked: merged.replace(/\d{4}$/, 'xxxx'),
                      } as Customer;
                    });
                    setDirty(true);
                  }}
                  triggerClassName="text-xs"
                  allowManualInput
                />

                <span className="inline-block h-[3px] w-[3px] rounded-full bg-foreground/40" />

                {/* CPR (syncs birthdate) */}
                {editingCPR ? (
                  <span className="inline-flex items-center gap-1">
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="ddmmåå-xxxx"
                      value={tmpCPR}
                      onChange={(e) => setTmpCPR(normalizeCpr(e.target.value))}
                      className="rounded-md border px-1 py-0.5 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const full = normalizeCpr(tmpCPR);
                          const masked = toMasked(full);
                          setLocal((prev) => ({
                            ...prev,
                            cprFull: full,
                            cprMasked: masked,
                            birthdate: (() => {
                              const front = full.replace(/\D+/g, '').slice(0, 6);
                              const iso = isoFromCprFront(front, prev.birthdate);
                              return iso || prev.birthdate;
                            })(),
                          }));
                          setDirty(true);
                          setEditingCPR(false);
                        }
                        if (e.key === 'Escape') {
                          setTmpCPR(normalizeCpr(local.cprFull || ''));
                          setEditingCPR(false);
                        }
                      }}
                      onBlur={() => {
                        const full = normalizeCpr(tmpCPR);
                        const masked = toMasked(full);
                        setLocal((prev) => ({
                          ...prev,
                          cprFull: full,
                          cprMasked: masked,
                          birthdate: (() => {
                            const front = full.replace(/\D+/g, '').slice(0, 6);
                            const iso = isoFromCprFront(front, prev.birthdate);
                            return iso || prev.birthdate;
                          })(),
                        }));
                        setDirty(true);
                        setEditingCPR(false);
                      }}
                    />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      className="hover:underline underline-offset-2"
                      title={showCpr ? 'Skjul CPR' : 'Vis CPR'}
                      onClick={() => setShowCpr((v) => !v)}
                    >
                      CPR:{' '}
                      {showCpr
                        ? local.cprFull || '—'
                        : local.cprMasked || toMasked(local.cprFull) || '—'}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border px-1 py-0.5 text-[10px] text-foreground/70 hover:bg-surface-2 transition-colors"
                      title="Rediger CPR"
                      onClick={() => setEditingCPR(true)}
                    >
                      Rediger
                    </button>
                  </span>
                )}

                {!!(local.tags?.length ?? 0) && (
                  <Badge
                    variant="secondary"
                    className="ml-1 gap-1"
                    style={{
                      backgroundColor: `hsl(${hue} 60% 92% / .6)`,
                      border: `1px solid hsl(${hue} 35% 70% / .45)`,
                      color: `hsl(${hue} 35% 32% / .95)`,
                    }}
                  >
                    <Tag size={12} /> {(local.tags || []).slice(0, 2).join(', ')}
                    {local.tags!.length > 2 ? ` +${local.tags!.length - 2}` : ''}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className={cn('chip gap-2', !dirty && 'opacity-80')}
                style={
                  dirty
                    ? {
                        background: `linear-gradient(to bottom, hsl(${hue} 95% 94% / .98), hsl(${hue} 90% 90% / .98))`,
                        borderColor: `hsl(${hue} 55% 55% / .55)`,
                        boxShadow: `0 0 0 1px hsl(${hue} 60% 60% / .35),
                           0 8px 18px hsl(${hue} 60% 40% / .18),
                           inset 0 1px 0 #fff`,
                      }
                    : undefined
                }
                disabled={!dirty}
                onClick={handleSave}
                title={dirty ? 'Gem ændringer (⌘/Ctrl+S)' : 'Ingen ændringer'}
              >
                <FloppyDisk size={16} weight="bold" />
                Gem
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" className="chip gap-2">
                    <Printer size={16} weight="bold" />
                    Udskriv
                    <CaretDown size={14} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Udskriv</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Hele kundekort</DropdownMenuItem>
                  <DropdownMenuItem>Adresseetiket</DropdownMenuItem>
                  <DropdownMenuItem>Seneste ordre</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ACTION ROW */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button variant="secondary" className="chip gap-1.5">
              <CalendarCheck size={16} weight="bold" /> Book aftale
            </Button>
            {/* SynsJournal removed in minimal template */}
            <Button variant="secondary" className="chip gap-1.5">
              <Eyeglasses size={16} weight="bold" /> Stel/glas
            </Button>
            <Button variant="secondary" className="chip gap-1.5">
              <Ruler size={16} weight="bold" /> Udmåling
            </Button>
            <Button variant="secondary" className="chip gap-1.5">
              <Wrench size={16} weight="bold" /> Værksted
            </Button>
            <Button
              variant="secondary"
              className="chip gap-1.5"
              onClick={() =>
                openWin({
                  type: 'smsComposer',
                  title: 'Send SMS',
                  payload: { customer: local },
                })
              }
            >
              <ChatCircleDots size={16} weight="bold" /> Send SMS
            </Button>
            <Button variant="secondary" className="chip gap-1.5">
              <FolderSimple size={16} weight="bold" /> Kundemappe
            </Button>
            <Button variant="secondary" className="chip gap-1.5">
              <CurrencyDollar size={16} weight="bold" /> Finans
            </Button>

            {/* ID scan removed in minimal template */}

            <div className="ml-auto" />

            {/* Segmented tabs */}
            <SegmentedPills
              items={[
                {
                  key: 'details',
                  label: 'Kundedetaljer',
                  icon: <Notebook size={14} weight="bold" />,
                },
                { key: 'orders', label: 'Ordrer', icon: <Package size={14} weight="bold" /> },
              ]}
              value={tab}
              onChange={(k) => setTab(k as Tab)}
              hue={hue}
              size="sm"
              ariaLabel="Kundekort sektioner"
            />
          </div>
        </div>

        {/* BODY */}
        {tab === 'details' ? (
          <CustomerDetails local={local} touch={touch} hue={hue} />
        ) : (
          <CustomerOrders hue={hue} />
        )}
      </div>

      {/* Scan overlay removed in minimal template */}
    </TooltipProvider>
  );
}
