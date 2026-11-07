"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { useAuth } from "@/components/auth/AuthProvider";
import { Breadcrumb, carnetHref, PageLoading, pageClass } from "@/components/sante/ui";
import { Button } from "@/components/ui/Button";
import { Alert, Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { formatRecordDate } from "@/lib/health-records";
import { listMyPets, listPetsWithRecords, SPECIES_LABELS } from "@/lib/health-records-api";

type PetRow = { petId: string; name: string; subtitle?: string; count: number; lastDate?: string };

export default function CarnetsPage() {
  return (
    <RequireAuth>
      <Carnets />
    </RequireAuth>
  );
}

/** Choix de l'animal dont on ouvre le carnet de santé. */
function Carnets() {
  const { user } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<PetRow[] | null>(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([listMyPets(user.uid), listPetsWithRecords()])
      .then(([firestorePets, withRecords]) => {
        if (!active) return;
        const rows = new Map<string, PetRow>();
        for (const p of firestorePets) {
          rows.set(p.id, {
            petId: p.id,
            name: p.name,
            subtitle: [p.species ? SPECIES_LABELS[p.species] : null, p.breed].filter(Boolean).join(" · "),
            count: 0,
          });
        }
        for (const p of withRecords) {
          const row = rows.get(p.petId);
          rows.set(p.petId, { ...row, petId: p.petId, name: row?.name || p.petName || "Animal", count: p.count, lastDate: p.lastDate });
        }
        setPets([...rows.values()].sort((a, b) => a.name.localeCompare(b.name, "fr")));
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Chargement impossible.");
        setPets([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  function startNew(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return setNameError("Le nom de l'animal est obligatoire.");
    if (name.length > 60) return setNameError("60 caractères maximum.");
    router.push(carnetHref(crypto.randomUUID(), name));
  }

  return (
    <div className={pageClass}>
      <Breadcrumb items={[{ label: "Carnets de santé" }]} />
      <div className="flex flex-col gap-space-xs mb-space-xl max-w-2xl">
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Carnets de santé</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">
          Vaccins, consultations, traitements et allergies de vos compagnons, au même endroit.
        </p>
      </div>

      {error && (
        <div className="mb-space-lg">
          <Alert>{error}</Alert>
        </div>
      )}

      {pets === null ? (
        <PageLoading label="Chargement de vos animaux…" />
      ) : (
        <div className="grid gap-space-lg md:grid-cols-2 lg:grid-cols-3">
          {pets.map((pet) => (
            <Link key={pet.petId} href={carnetHref(pet.petId, pet.name)} className="group">
              <Card className="h-full flex items-center gap-space-md transition-shadow group-hover:shadow-md">
                <span className="w-14 h-14 shrink-0 rounded-2xl bg-primary-fixed/50 text-primary flex items-center justify-center">
                  <Icon name="pets" filled className="text-[28px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-headline-sm text-headline-sm text-on-surface truncate">{pet.name}</p>
                  {pet.subtitle && <p className="font-body-sm text-body-sm text-on-surface-variant truncate">{pet.subtitle}</p>}
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    {pet.count ? `${pet.count} acte${pet.count > 1 ? "s" : ""}` : "Carnet vide"}
                    {pet.lastDate && ` · dernier le ${formatRecordDate(pet.lastDate, { dateStyle: "medium" })}`}
                  </p>
                </div>
                <Icon name="chevron_right" className="text-outline transition-transform group-hover:translate-x-1" />
              </Card>
            </Link>
          ))}

          <Card className="flex flex-col gap-space-md bg-surface-container-low shadow-none">
            <div className="flex items-center gap-space-sm">
              <Icon name="add_circle" className="text-primary" />
              <h2 className="font-headline-sm text-headline-sm">Nouveau carnet</h2>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {pets.length === 0
                ? "Aucun animal trouvé. En attendant le module « Mes animaux », créez un carnet en indiquant le nom de votre animal."
                : "Votre animal n'apparaît pas ? Créez son carnet en indiquant son nom."}
            </p>
            <form onSubmit={startNew} className="flex flex-col gap-space-sm" noValidate>
              <TextField
                label="Nom de l'animal"
                icon="pets"
                placeholder="Ex. Milo"
                value={newName}
                maxLength={60}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNameError("");
                }}
                error={nameError}
              />
              <Button type="submit" icon="arrow_forward">
                Ouvrir le carnet
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
