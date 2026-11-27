// Export PDF du carnet de santé : chargé uniquement au clic sur « Exporter en PDF » (import dynamique),
// pour que @react-pdf/renderer n'alourdisse pas les pages.
import { Document, Font, Image, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatRecordDate, RECORD_TYPE_INFO, type HealthRecord } from "@/lib/health-records";
import { doseScheduleLabel, isActiveTreatment, latestVaccines, VACCINE_SOON_DAYS, daysBetweenIso } from "@/lib/health-summary";
import { ageLabel, SEX_INFO, speciesLine, type Pet } from "@/lib/pets";

// Pas de césure : les mots (« en retard », noms de vaccins) restent entiers.
Font.registerHyphenationCallback((word) => [word]);

const COLORS = { primary: "#0b6b5d", text: "#1b1c1c", muted: "#5b6360", line: "#d9dedc", soft: "#f1f4f3", error: "#ba1a1a" };

const s = StyleSheet.create({
  page: { padding: 36, paddingBottom: 56, fontSize: 10, fontFamily: "Helvetica", color: COLORS.text, lineHeight: 1.35 },
  header: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  photo: { width: 64, height: 64, borderRadius: 10, objectFit: "cover" },
  brand: { fontSize: 9, color: COLORS.primary, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", lineHeight: 1.2, marginVertical: 2 },
  subtitle: { color: COLORS.muted },
  section: { marginTop: 14 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: COLORS.primary, marginBottom: 6, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", marginBottom: 4 },
  label: { color: COLORS.muted, fontSize: 8, textTransform: "uppercase" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.line, paddingVertical: 4 },
  head: { flexDirection: "row", backgroundColor: COLORS.soft, paddingVertical: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: COLORS.muted, paddingHorizontal: 3 },
  td: { paddingHorizontal: 3 },
  item: { marginBottom: 6 },
  itemTitle: { fontFamily: "Helvetica-Bold" },
  empty: { color: COLORS.muted, fontStyle: "italic" },
  late: { color: COLORS.error, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, fontSize: 8, color: COLORS.muted },
});

const fmt = (iso: string | null | undefined) => (iso ? formatRecordDate(iso, { dateStyle: "medium" }) : "—");
const byDateDesc = (a: HealthRecord, b: HealthRecord) => b.date.localeCompare(a.date);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.h2} minPresenceAhead={40}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

function Table({ columns, rows }: { columns: { label: string; width: string }[]; rows: (string | { text: string; late?: boolean })[][] }) {
  return (
    <View>
      <View style={s.head} fixed>
        {columns.map((c) => (
          <Text key={c.label} style={[s.th, { width: c.width }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((cells, i) => (
        <View key={i} style={s.row} wrap={false}>
          {cells.map((cell, j) => {
            const value = typeof cell === "string" ? { text: cell } : cell;
            return (
              <Text key={j} style={[s.td, { width: columns[j].width }, value.late ? s.late : {}]}>
                {value.text || "—"}
              </Text>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/**
 * Carnet de santé d'un animal. Jamais d'e-mail ni de téléphone du propriétaire, ni les contacts de la fiche :
 * seules les coordonnées du vétérinaire référent figurent dans le document.
 */
function HealthBookPdf({ pet, records, today }: { pet: Pet; records: HealthRecord[]; today: string }) {
  const vaccines = records.filter((r) => r.type === "vaccin").sort(byDateDesc);
  const latestIds = new Set(latestVaccines(vaccines).map((r) => r.id));
  const visits = records.filter((r) => r.type === "visite" || r.type === "examen").sort(byDateDesc);
  const allergies = records.filter((r) => r.type === "allergie").sort(byDateDesc);
  const treatments = records.filter((r) => r.type === "traitement").sort(byDateDesc);
  const current = treatments.filter((r) => isActiveTreatment(r, today));
  const past = treatments.filter((r) => !isActiveTreatment(r, today));
  const photo = pet.photos[0]?.url || pet.photos[0]?.thumbnail;
  const vet = [pet.vet.name, pet.vet.clinic].filter(Boolean).join(" · ");
  const age = pet.birthDate ? ageLabel(pet.birthDate, today) : "";

  const treatmentItem = (r: HealthRecord) => (
    <View key={r.id} style={s.item} wrap={false}>
      <Text style={s.itemTitle}>{r.title}</Text>
      <Text>
        Du {fmt(r.date)}
        {r.endDate ? ` au ${fmt(r.endDate)}` : " · sans date de fin"}
        {r.veterinarian ? ` · ${r.veterinarian}` : ""}
      </Text>
      {r.dosage ? <Text>Posologie : {r.dosage}</Text> : null}
      {r.doseTimes.length ? <Text>Prises : {doseScheduleLabel(r)}</Text> : null}
      {r.notes ? <Text style={s.subtitle}>{r.notes}</Text> : null}
    </View>
  );

  return (
    <Document title={`Carnet de santé de ${pet.name}`} author="PetCare" creator="PetCare" language="fr">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer (PDF), pas une balise HTML */}
          {photo ? <Image src={photo} style={s.photo} /> : null}
          <View>
            <Text style={s.brand}>PETCARE · CARNET DE SANTÉ</Text>
            <Text style={s.title}>{pet.name}</Text>
            <Text style={s.subtitle}>{speciesLine(pet)}</Text>
          </View>
        </View>

        <Section title="Profil">
          <View style={s.grid}>
            <Field label="Espèce / race" value={speciesLine(pet)} />
            <Field label="Sexe" value={pet.sex ? SEX_INFO[pet.sex].label : ""} />
            <Field label="Naissance" value={pet.birthDate ? `${fmt(pet.birthDate)}${pet.birthDateEstimated ? " (estimée)" : ""}${age ? ` · ${age}` : ""}` : ""} />
            <Field label="Stérilisé(e)" value={pet.sterilized ? "Oui" : "Non"} />
            <Field label="N° de puce" value={pet.chipNumber} />
            <Field label="Vétérinaire référent" value={vet} />
            <Field label="Adresse du cabinet" value={pet.vet.address} />
            <Field label="Téléphone du vétérinaire" value={pet.vet.phone} />
          </View>
        </Section>

        <Section title="Vaccins et rappels">
          {vaccines.length ? (
            <Table
              columns={[
                { label: "Vaccin", width: "28%" },
                { label: "Date", width: "14%" },
                { label: "Lot", width: "14%" },
                { label: "Vétérinaire", width: "24%" },
                { label: "Prochain rappel", width: "20%" },
              ]}
              rows={vaccines.map((r) => {
                const current = latestIds.has(r.id);
                const late = current && !!r.nextDueDate && daysBetweenIso(today, r.nextDueDate) < 0;
                const soon = current && !!r.nextDueDate && !late && daysBetweenIso(today, r.nextDueDate) <= VACCINE_SOON_DAYS;
                const due = r.nextDueDate ? `${fmt(r.nextDueDate)}${late ? " (en retard)" : soon ? " (bientôt)" : current ? "" : " (refait)"}` : "";
                return [r.title, fmt(r.date), r.lotNumber, r.veterinarian, { text: due, late }];
              })}
            />
          ) : (
            <Text style={s.empty}>Aucun vaccin enregistré.</Text>
          )}
        </Section>

        <Section title="Visites et examens">
          {visits.length ? (
            visits.map((r) => (
              <View key={r.id} style={s.item} wrap={false}>
                <Text style={s.itemTitle}>
                  {fmt(r.date)} · {RECORD_TYPE_INFO[r.type].label} · {r.title}
                </Text>
                {r.veterinarian || r.clinic ? <Text>{[r.veterinarian, r.clinic].filter(Boolean).join(" · ")}</Text> : null}
                {r.notes ? <Text style={s.subtitle}>{r.notes}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={s.empty}>Aucune visite ni examen enregistré.</Text>
          )}
        </Section>

        <Section title="Allergies et vigilances">
          {allergies.length ? (
            allergies.map((r) => (
              <View key={r.id} style={s.item} wrap={false}>
                <Text style={s.itemTitle}>{r.title}</Text>
                {r.notes ? <Text style={s.subtitle}>{r.notes}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={s.empty}>Aucune allergie signalée.</Text>
          )}
        </Section>

        <Section title="Traitements en cours">
          {current.length ? current.map(treatmentItem) : <Text style={s.empty}>Aucun traitement en cours.</Text>}
        </Section>

        <Section title="Traitements passés">
          {past.length ? past.map(treatmentItem) : <Text style={s.empty}>Aucun traitement passé.</Text>}
        </Section>

        <Text style={s.footer} fixed>
          Généré le {fmt(today)} avec PetCare · document établi par le propriétaire, il ne remplace pas le carnet officiel.
        </Text>
      </Page>
    </Document>
  );
}

/** Nom du fichier : carnet-<nom>-<AAAA-MM-JJ>.pdf (sans accents ni espaces). */
export function pdfFileName(name: string, today: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `carnet-${slug || "animal"}-${today}.pdf`;
}

export async function buildHealthPdf(pet: Pet, records: HealthRecord[], today: string): Promise<File> {
  const blob = await pdf(<HealthBookPdf pet={pet} records={records} today={today} />).toBlob();
  return new File([blob], pdfFileName(pet.name, today), { type: "application/pdf" });
}
