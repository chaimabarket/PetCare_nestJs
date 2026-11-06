import {
  ageLabel,
  formatChip,
  formatDay,
  formatKg,
  SEX_INFO,
  shareText,
  speciesLine,
  type Pet,
  type PetWeight,
} from "@/lib/pets";

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Exporte la fiche complète (usage personnel : puce, notes et contacts compris) dans une page imprimable :
 * la fenêtre d'impression du navigateur permet aussi de l'enregistrer en PDF.
 */
export function exportPetSheet(pet: Pet, weights: PetWeight[], today: string): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  const row = (label: string, value: string) =>
    value ? `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>` : "";
  const age = ageLabel(pet.birthDate, today);
  const vet = [pet.vet.name, pet.vet.clinic, pet.vet.address, pet.vet.phone].filter(Boolean).join(" · ");
  const photo = pet.photos[0]?.url;

  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Fiche de ${escape(pet.name)} — PetCare</title>
<style>
  body { font-family: system-ui, sans-serif; color: #1b1c1c; margin: 32px; }
  header { display: flex; gap: 24px; align-items: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; }
  header img { width: 120px; height: 120px; object-fit: cover; border-radius: 16px; }
  h1 { margin: 0; font-size: 28px; } h2 { color: #0f766e; font-size: 18px; margin-top: 28px; }
  table { border-collapse: collapse; width: 100%; } th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  th { width: 34%; color: #555; font-weight: 600; } footer { margin-top: 32px; color: #777; font-size: 12px; }
</style></head><body>
<header>${photo ? `<img src="${photo}" alt="">` : ""}<div><h1>${escape(pet.name)}</h1><p>${escape(shareText(pet, today))}</p></div></header>
<h2>Identité</h2><table>
${row("Espèce / race", speciesLine(pet))}
${row("Sexe", pet.sex ? SEX_INFO[pet.sex].label : "")}
${row("Naissance", pet.birthDate ? `${formatDay(pet.birthDate)}${pet.birthDateEstimated ? " (estimée)" : ""}${age ? ` — ${age}` : ""}` : "")}
${row("Stérilisé", pet.sterilized ? "Oui" : "Non")}
${row("Puce", pet.chipNumber ? formatChip(pet.chipNumber) : "")}
${row("Statut", pet.status === "archived" ? "Archivé" : pet.status === "draft" ? "Brouillon" : "Actif")}
</table>
${pet.notes ? `<h2>Notes</h2><p>${escape(pet.notes).replace(/\n/g, "<br>")}</p>` : ""}
${vet ? `<h2>Vétérinaire référent</h2><p>${escape(vet)}</p>` : ""}
${
  pet.contacts.length
    ? `<h2>Contacts</h2><table>${pet.contacts
        .map((c) => row(`${c.name}${c.emergency ? " (urgence)" : ""}`, [c.detail, c.phone].filter(Boolean).join(" · ")))
        .join("")}</table>`
    : ""
}
${
  weights.length
    ? `<h2>Poids</h2><table>${weights
        .map((w) => row(formatDay(w.day), `${formatKg(w.weightKg)}${w.note ? ` — ${w.note}` : ""}`))
        .join("")}</table>`
    : ""
}
<footer>Exporté depuis PetCare le ${escape(formatDay(today))}. Document personnel : il contient la puce et les notes.</footer>
<script>window.onload = () => window.print();</script>
</body></html>`);
  win.document.close();
  return true;
}
