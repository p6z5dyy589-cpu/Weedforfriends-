import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { Camera, ChevronRight, Info, MapPin, Pencil, Plus, Search } from "lucide-react";
import { LOCATION_CODE, LOCATION_LEVELS, qrPayload, type LocationLevel } from "@shared/locations";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase, useHasRole, useMe } from "@/hooks/useMe";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { Card, PageHeader, Section } from "@/components/ui/Layout";
import { CheckRow, NumberInput, TextInput } from "@/components/ui/Fields";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";

interface Loc {
  id: string;
  version: number;
  level: LocationLevel;
  parentId: string | null;
  code: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
  layoutVersion: number;
}

type LookupResult = "found" | "stale" | "inactive" | "not_found" | "invalid";

function nextLevel(level: LocationLevel | null): LocationLevel | null {
  if (level === null) return "site";
  const i = LOCATION_LEVELS.indexOf(level);
  return LOCATION_LEVELS[i + 1] ?? null;
}

/** Local warehouse map: orientation only, never stock or bookings. */
export default function WarehouseMap() {
  const { t } = useLanguage();
  const isCoordinator = useHasRole("coordinator");
  const list = trpc.locations.list.useQuery();
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [form, setForm] = useState<{ mode: "create" } | { mode: "edit"; id: string } | null>(null);

  const all = (list.data ?? []) as Loc[];
  const byId = useMemo(() => new Map(all.map((l) => [l.id, l])), [all]);
  const current = currentId ? (byId.get(currentId) ?? null) : null;
  const children = useMemo(
    () => all.filter((l) => l.parentId === (current?.id ?? null)).sort((a, b) => a.code.localeCompare(b.code)),
    [all, current],
  );
  const path = useMemo(() => {
    const p: Loc[] = [];
    let c = current;
    while (c) {
      p.unshift(c);
      c = c.parentId ? (byId.get(c.parentId) ?? null) : null;
    }
    return p;
  }, [current, byId]);

  const reveal = (id: string) => {
    const loc = byId.get(id);
    if (!loc) return;
    setCurrentId(loc.parentId);
    setHighlightId(id);
    setDetailId(id);
  };

  const enter = (id: string | null) => {
    setCurrentId(id);
    setHighlightId(null);
  };

  const createLevel = nextLevel(current?.level ?? null);
  const detail = detailId ? (byId.get(detailId) ?? null) : null;
  const editing = form?.mode === "edit" ? (byId.get(form.id) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("comms.map.title")} />
      <p className="flex items-start gap-2 rounded-xl border border-dashed border-slate-400 bg-white p-3 text-sm font-medium text-slate-700">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("comms.map.banner")}
      </p>

      <SearchBox onReveal={reveal} />

      {list.isLoading ? (
        <Loading />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <nav aria-label={t("comms.map.title")} className="flex flex-wrap items-center gap-1 text-sm">
            <button
              type="button"
              onClick={() => enter(null)}
              aria-current={current === null ? "page" : undefined}
              className="min-h-11 rounded-lg px-2 font-medium text-slate-700 hover:bg-slate-200 aria-[current=page]:font-bold aria-[current=page]:text-slate-900"
            >
              {t("comms.map.allSites")}
            </button>
            {path.map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <ChevronRight className="size-4 text-slate-400" aria-hidden />
                <button
                  type="button"
                  onClick={() => enter(p.id)}
                  aria-current={p.id === current?.id ? "page" : undefined}
                  className="min-h-11 rounded-lg px-2 font-medium text-slate-700 hover:bg-slate-200 aria-[current=page]:font-bold aria-[current=page]:text-slate-900"
                >
                  {p.code}
                </button>
              </span>
            ))}
          </nav>

          {current && (
            <Card className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-col">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(`comms.level.${current.level}`)}</span>
                <span className="font-semibold">
                  {current.code} · {current.name}
                </span>
                {!current.active && <span className="w-fit rounded border border-dashed border-slate-400 px-1.5 text-xs text-slate-600">{t("comms.map.inactive")}</span>}
              </div>
              <Button variant="secondary" onClick={() => setDetailId(current.id)}>
                {t("comms.map.details")}
              </Button>
            </Card>
          )}

          {isCoordinator && createLevel && (
            <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => setForm({ mode: "create" })}>
              {t("comms.map.create")} · {t(`comms.level.${createLevel}`)}
            </Button>
          )}

          {children.length === 0 ? (
            <EmptyState text={current ? t("comms.map.noChildren") : t("comms.map.empty")} />
          ) : (
            <>
              <Section title={t("comms.map.plan")}>
                <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-slate-300 bg-white" aria-hidden>
                  {children.map((c) => {
                    const left = Math.min(c.x, 99);
                    const top = Math.min(c.y, 99);
                    const width = Math.max(1, Math.min(c.w, 100 - left));
                    const height = Math.max(1, Math.min(c.h, 100 - top));
                    return (
                      <button
                        key={c.id}
                        type="button"
                        tabIndex={-1}
                        onClick={() => enter(c.id)}
                        style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                        className={`absolute flex min-h-11 min-w-11 flex-col items-start justify-start overflow-hidden rounded-md border-2 p-1 text-left text-xs leading-tight ${
                          c.active ? "border-slate-500 bg-slate-50 hover:bg-slate-100" : "border-dashed border-slate-400 bg-white text-slate-500"
                        } ${highlightId === c.id ? "ring-4 ring-amber-400" : ""}`}
                      >
                        <span className="font-bold">{c.code}</span>
                        <span className="truncate">{c.name}</span>
                        {!c.active && <span className="italic">{t("comms.map.inactive")}</span>}
                      </button>
                    );
                  })}
                </div>
              </Section>
              <Section title={t("comms.map.list")}>
                <ul className="flex flex-col gap-2">
                  {children.map((c) => (
                    <li key={c.id} className={`flex items-stretch gap-2 rounded-2xl bg-white shadow-sm ${highlightId === c.id ? "ring-4 ring-amber-400" : ""}`}>
                      <button type="button" onClick={() => enter(c.id)} className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl p-3 text-left hover:bg-slate-50">
                        <MapPin className="size-5 shrink-0 text-slate-500" aria-hidden />
                        <span className="flex min-w-0 flex-col">
                          <span className="font-semibold">
                            {c.code} · {c.name}
                          </span>
                          <span className="text-sm text-slate-600">
                            {t(`comms.level.${c.level}`)}
                            {!c.active && <> · <span className="rounded border border-dashed border-slate-400 px-1">{t("comms.map.inactive")}</span></>}
                          </span>
                        </span>
                        <ChevronRight className="ml-auto size-5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetailId(c.id)}
                        aria-label={t("comms.map.detailsOf", { code: c.code })}
                        className="flex min-h-12 w-12 shrink-0 items-center justify-center rounded-2xl hover:bg-slate-50"
                      >
                        <Info className="size-5 text-slate-600" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            </>
          )}
        </>
      )}

      <Sheet open={detail !== null} onOpenChange={(o) => !o && setDetailId(null)} title={detail ? `${detail.code} · ${detail.name}` : t("comms.map.details")}>
        {detail && (
          <LocationDetail
            loc={detail}
            canEdit={isCoordinator}
            onEdit={() => {
              setDetailId(null);
              setForm({ mode: "edit", id: detail.id });
            }}
          />
        )}
      </Sheet>

      <Sheet
        open={form !== null}
        onOpenChange={(o) => !o && setForm(null)}
        title={form?.mode === "edit" ? t("comms.map.edit") : createLevel ? t("comms.map.createLevel", { level: t(`comms.level.${createLevel}`) }) : t("comms.map.create")}
      >
        {form?.mode === "create" && createLevel && (
          <LocationForm key={`new-${current?.id ?? "root"}`} create={{ level: createLevel, parentId: current?.id ?? null }} onDone={() => setForm(null)} />
        )}
        {form?.mode === "edit" && editing && <LocationForm key={`edit-${editing.id}-${editing.version}`} edit={editing} onDone={() => setForm(null)} />}
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search / scan

interface DetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts?: { formats?: string[] }) => DetectorLike;

function SearchBox({ onReveal }: { onReveal: (id: string) => void }) {
  const { t } = useLanguage();
  const utils = trpc.useUtils();
  const [raw, setRaw] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hasDetector = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices?.getUserMedia;

  const run = async (value: string) => {
    const v = value.trim();
    if (!v) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const r = await utils.locations.lookup.fetch({ raw: v.slice(0, 120) });
      setResult(r.result);
      if ("id" in r && r.id) onReveal(r.id);
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };

  const stopScan = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setScanning(false);
  };

  useEffect(() => () => streamRef.current?.getTracks().forEach((tr) => tr.stop()), []);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let timer: number | undefined;
    (async () => {
      try {
        const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
        const detector = new Ctor({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const tick = async () => {
          if (cancelled) return;
          try {
            const codes = await detector.detect(video);
            const hit = codes[0]?.rawValue;
            if (hit) {
              setRaw(hit);
              stopScan();
              void run(hit);
              return;
            }
          } catch {
            // ignore single frame errors
          }
          timer = window.setTimeout(tick, 300);
        };
        void tick();
      } catch {
        // Camera unavailable or denied: fall back silently to text input.
        if (!cancelled) stopScan();
      }
    })();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const resultText: Record<LookupResult, string> = {
    found: t("comms.map.result.found"),
    stale: t("comms.map.result.stale"),
    inactive: t("comms.map.result.inactive"),
    not_found: t("comms.map.result.not_found"),
    invalid: t("comms.map.result.invalid"),
  };

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run(raw);
      }}
    >
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextInput
            label={t("comms.map.searchLabel")}
            hint={t("comms.map.searchHint")}
            value={raw}
            maxLength={120}
            autoCapitalize="characters"
            autoComplete="off"
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>
        <Button type="submit" loading={pending} disabled={!raw.trim()} icon={<Search className="size-5" aria-hidden />}>
          {t("comms.map.search")}
        </Button>
      </div>
      {hasDetector && (
        <Button variant="secondary" icon={<Camera className="size-5" aria-hidden />} onClick={() => (scanning ? stopScan() : setScanning(true))}>
          {scanning ? t("comms.map.scanStop") : t("comms.map.scan")}
        </Button>
      )}
      {scanning && <video ref={videoRef} muted playsInline className="aspect-video w-full rounded-xl bg-black object-cover" />}
      <InlineError error={error} />
      {result && (
        <p
          role="status"
          className={`rounded-lg p-3 text-sm font-medium ${result === "found" ? "bg-emerald-50 text-emerald-800" : result === "stale" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-stop"}`}
        >
          {resultText[result]}
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Detail

function LocationDetail({ loc, canEdit, onEdit }: { loc: Loc; canEdit: boolean; onEdit: () => void }) {
  const { t } = useLanguage();
  const me = useMe();
  const [qr, setQr] = useState<string | null>(null);
  const payload = qrPayload(me.activeCompanyId, loc.code, loc.layoutVersion);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    QRCode.toDataURL(payload, { margin: 1, width: 240, errorCorrectionLevel: "M" })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const rows: [string, string][] = [
    [t("comms.map.code"), loc.code],
    [t("comms.map.name"), loc.name],
    [t("comms.map.kind"), t(`comms.level.${loc.level}`)],
    [t("comms.map.state"), loc.active ? t("comms.map.active") : t("comms.map.inactive")],
  ];

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-sm text-slate-600">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-center">
        {qr ? (
          <img src={qr} alt={t("comms.map.qrAlt", { code: loc.code })} width={240} height={240} className="rounded-lg border border-slate-200" />
        ) : (
          <div className="size-60 rounded-lg bg-slate-100" aria-hidden />
        )}
      </div>
      {canEdit && (
        <Button variant="secondary" icon={<Pencil className="size-5" aria-hidden />} onClick={onEdit}>
          {t("comms.map.edit")}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / edit (coordinators)

function LocationForm({ create, edit, onDone }: { create?: { level: LocationLevel; parentId: string | null }; edit?: Loc; onDone: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const utils = trpc.useUtils();
  const base = useBase();
  const [code, setCode] = useState(edit?.code ?? "");
  const [name, setName] = useState(edit?.name ?? "");
  const [x, setX] = useState<number | null>(edit?.x ?? 0);
  const [y, setY] = useState<number | null>(edit?.y ?? 0);
  const [w, setW] = useState<number | null>(edit?.w ?? 20);
  const [h, setH] = useState<number | null>(edit?.h ?? 20);
  const [active, setActive] = useState(edit?.active ?? true);

  const onSuccess = () => {
    base.reset();
    void utils.locations.list.invalidate();
    toast(t("app.saved"));
    onDone();
  };
  const createM = trpc.locations.create.useMutation({ onSuccess });
  const updateM = trpc.locations.update.useMutation({
    onSuccess,
    onError: () => void utils.locations.list.invalidate(),
  });

  const isInt = (v: number | null, min: number, max: number): v is number => v !== null && Number.isInteger(v) && v >= min && v <= max;
  const valid =
    LOCATION_CODE.test(code) && name.trim().length >= 1 && name.trim().length <= 80 && isInt(x, 0, 99) && isInt(y, 0, 99) && isInt(w, 1, 100) && isInt(h, 1, 100);
  const pending = createM.isPending || updateM.isPending;

  const submit = () => {
    if (!valid) return;
    const fields = { code, name: name.trim(), x: x!, y: y!, w: w!, h: h! };
    if (edit) updateM.mutate(base({ id: edit.id, version: edit.version, active, ...fields }));
    else if (create) createM.mutate(base({ level: create.level, parentId: create.parentId, ...fields }));
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <TextInput
        label={t("comms.map.code")}
        hint={t("comms.map.codeHint")}
        value={code}
        maxLength={32}
        autoCapitalize="characters"
        autoComplete="off"
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
      />
      <TextInput label={t("comms.map.name")} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label={t("comms.map.x")} hint={t("comms.map.posHint")} value={x} onChange={setX} min={0} max={99} step={1} inputMode="numeric" />
        <NumberInput label={t("comms.map.y")} hint={t("comms.map.posHint")} value={y} onChange={setY} min={0} max={99} step={1} inputMode="numeric" />
        <NumberInput label={t("comms.map.w")} hint={t("comms.map.sizeHint")} value={w} onChange={setW} min={1} max={100} step={1} inputMode="numeric" />
        <NumberInput label={t("comms.map.h")} hint={t("comms.map.sizeHint")} value={h} onChange={setH} min={1} max={100} step={1} inputMode="numeric" />
      </div>
      {edit && <CheckRow label={t("comms.map.isActive")} checked={active} onChange={setActive} />}
      <InlineError error={createM.error ?? updateM.error} />
      <Button type="submit" block disabled={!valid} loading={pending}>
        {t("app.save")}
      </Button>
    </form>
  );
}
