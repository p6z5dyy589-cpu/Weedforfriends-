import { useState } from "react";
import { Building2, CircleOff, Pencil, UserPlus } from "lucide-react";
import { ROLES, type Role } from "@shared/roles";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBase } from "@/hooks/useMe";
import { PageHeader } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { CheckRow, TextInput } from "@/components/ui/Fields";
import { EmptyState, ErrorState, InlineError, Loading } from "@/components/ui/States";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";

const PIN_OK = /^\d{4,8}$/;
const LOGIN_OK = /^[a-zA-Z0-9._-]{2,32}$/;

interface Person {
  id: number;
  loginName: string;
  displayName: string;
  active: boolean;
  roles: Role[];
  otherCompanies: boolean;
}

function RoleChecks({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
  const { t } = useLanguage();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-slate-700">{t("admin.people.roles")}</legend>
      {ROLES.map((r) => (
        <CheckRow key={r} label={t(`admin.role.${r}`)} checked={value.includes(r)} onChange={(on) => onChange(on ? [...value, r] : value.filter((x) => x !== r))} />
      ))}
    </fieldset>
  );
}

function PinInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { t } = useLanguage();
  return (
    <TextInput
      label={label}
      hint={t("admin.people.pinHint")}
      type="password"
      inputMode="numeric"
      autoComplete="new-password"
      maxLength={8}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
    />
  );
}

function useRefreshPeople() {
  const utils = trpc.useUtils();
  return () => {
    void utils.people.adminList.invalidate();
    void utils.people.directory.invalidate();
  };
}

function CreateSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const base = useBase();
  const refresh = useRefreshPeople();
  const [displayName, setDisplayName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [pin, setPin] = useState("");
  const [roles, setRoles] = useState<Role[]>(["production"]);
  const reset = () => {
    setDisplayName("");
    setLoginName("");
    setPin("");
    setRoles(["production"]);
  };
  const create = trpc.people.create.useMutation({
    onSuccess: () => {
      base.reset();
      reset();
      toast(t("admin.people.created"));
      refresh();
      onOpenChange(false);
    },
  });
  const valid = displayName.trim().length > 0 && LOGIN_OK.test(loginName.trim()) && PIN_OK.test(pin);
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setPin("");
        onOpenChange(o);
      }}
      title={t("admin.people.add")}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) create.mutate(base({ displayName: displayName.trim(), loginName: loginName.trim(), pin, roles }));
        }}
      >
        <TextInput label={t("admin.people.name")} value={displayName} maxLength={64} onChange={(e) => setDisplayName(e.target.value)} autoComplete="off" />
        <TextInput
          label={t("login.loginName")}
          hint={t("admin.people.loginHint")}
          value={loginName}
          maxLength={32}
          autoCapitalize="none"
          autoComplete="off"
          onChange={(e) => setLoginName(e.target.value)}
        />
        <PinInput label={t("login.pin")} value={pin} onChange={setPin} />
        <RoleChecks value={roles} onChange={setRoles} />
        <InlineError error={create.error} />
        <Button type="submit" block disabled={!valid} loading={create.isPending}>
          {t("admin.people.add")}
        </Button>
      </form>
    </Sheet>
  );
}

function EditSheet({ person, onClose }: { person: Person; onClose: () => void }) {
  const { t } = useLanguage();
  const toast = useToast();
  const refresh = useRefreshPeople();
  const updateBase = useBase();
  const pinBase = useBase();
  const removeBase = useBase();
  const [displayName, setDisplayName] = useState(person.displayName);
  const [roles, setRoles] = useState<Role[]>(person.roles);
  const [pin, setPin] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const update = trpc.people.update.useMutation({
    onSuccess: () => {
      updateBase.reset();
      toast(t("app.saved"));
      refresh();
      onClose();
    },
  });
  const resetPin = trpc.people.resetPin.useMutation({
    onSuccess: () => {
      pinBase.reset();
      setPin("");
      toast(t("admin.people.pinChanged"));
    },
  });
  const remove = trpc.people.removeFromCompany.useMutation({
    onSuccess: () => {
      removeBase.reset();
      toast(t("admin.people.removed"));
      refresh();
      onClose();
    },
  });
  const busy = update.isPending || resetPin.isPending || remove.isPending;

  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) {
          setPin("");
          onClose();
        }
      }}
      title={t("admin.people.editTitle", { name: person.displayName })}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (displayName.trim()) update.mutate(updateBase({ userId: person.id, displayName: displayName.trim(), roles }));
        }}
      >
        <TextInput label={t("admin.people.name")} value={displayName} maxLength={64} onChange={(e) => setDisplayName(e.target.value)} />
        <p className="text-sm text-slate-600">
          {t("login.loginName")}: {person.loginName}
        </p>
        <RoleChecks value={roles} onChange={setRoles} />
        <InlineError error={update.error} />
        <Button type="submit" block disabled={!displayName.trim() || busy} loading={update.isPending}>
          {t("app.save")}
        </Button>
      </form>

      <form
        className="flex flex-col gap-3 border-t border-slate-200 pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (PIN_OK.test(pin)) resetPin.mutate(pinBase({ userId: person.id, pin }));
        }}
      >
        <h3 className="font-semibold">{t("admin.people.resetPin")}</h3>
        <PinInput label={t("admin.people.newPin")} value={pin} onChange={setPin} />
        <p className="text-sm text-slate-600">{t("admin.people.resetPinHint")}</p>
        <InlineError error={resetPin.error} />
        <Button type="submit" variant="secondary" block disabled={!PIN_OK.test(pin) || busy} loading={resetPin.isPending}>
          {t("admin.people.resetPin")}
        </Button>
      </form>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
        <p className="text-sm">{t("admin.people.removeExplain", { name: person.displayName })}</p>
        {!confirmRemove ? (
          <Button variant="stop" block disabled={busy} onClick={() => setConfirmRemove(true)}>
            {t("admin.people.remove")}
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button variant="danger" block loading={remove.isPending} disabled={busy} onClick={() => remove.mutate(removeBase({ userId: person.id }))}>
              {t("admin.people.removeConfirm")}
            </Button>
            <Button variant="ghost" block disabled={remove.isPending} onClick={() => setConfirmRemove(false)}>
              {t("app.cancel")}
            </Button>
          </div>
        )}
        <InlineError error={remove.error} />
      </div>
    </Sheet>
  );
}

/** Personen: people of the active company, roles per company. PINs are never shown. */
export default function People() {
  const { t } = useLanguage();
  const list = trpc.people.adminList.useQuery();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("nav.item.people")} coordination>
        <Button icon={<UserPlus className="size-5" aria-hidden />} onClick={() => setCreating(true)}>
          {t("admin.people.add")}
        </Button>
      </PageHeader>

      {list.isLoading ? (
        <Loading />
      ) : list.error || !list.data ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState text={t("admin.people.empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.map((p) => (
            <li key={p.id} className={`flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm ${p.active ? "" : "opacity-75"}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-lg font-semibold leading-tight">{p.displayName}</p>
                <p className="text-sm text-slate-600">
                  {t("login.loginName")}: {p.loginName}
                </p>
                <div className="flex flex-wrap gap-1">
                  {p.roles.length === 0 ? (
                    <span className="text-sm text-slate-500">{t("admin.people.noRoles")}</span>
                  ) : (
                    p.roles.map((r) => (
                      <span key={r} className="rounded-full bg-slate-100 px-2 py-0.5 text-sm font-medium text-slate-800">
                        {t(`admin.role.${r}`)}
                      </span>
                    ))
                  )}
                </div>
                {!p.active && (
                  <span className="inline-flex w-fit items-center gap-1 rounded-md border border-slate-400 px-2 py-0.5 text-sm font-medium text-slate-700">
                    <CircleOff className="size-4" aria-hidden />
                    {t("admin.people.inactive")}
                  </span>
                )}
                {p.otherCompanies && (
                  <span className="inline-flex w-fit items-center gap-1 text-sm text-slate-600">
                    <Building2 className="size-4" aria-hidden />
                    {t("admin.people.otherCompanies")}
                  </span>
                )}
              </div>
              <Button variant="secondary" className="px-3" icon={<Pencil className="size-5" aria-hidden />} onClick={() => setEditing(p)}>
                {t("admin.people.edit")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CreateSheet open={creating} onOpenChange={setCreating} />
      {editing && <EditSheet key={editing.id} person={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
