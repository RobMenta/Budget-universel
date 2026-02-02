# Mon Budget (PWA)

Petite application web **simple** pour gérer son budget mensuel :
- **Charges fixes** (avec case “payé”)
- **Enveloppes budget** (ex: Courses, Sorties…) : tu définis un plafond et chaque dépense le déduit
- **Modules cumulatifs** (ex: Essence, Parking…) : un total qui s’additionne au fil des entrées
- Fonctionne **hors-ligne** après le premier chargement (PWA)

✅ **100% local** : aucune donnée n’est envoyée sur internet.  
Les données sont stockées dans le navigateur via `localStorage`.

---

## Utilisation

1. Renseigne ton **salaire**
2. Ajoute tes **charges fixes** (loyer, assurances, abonnements…)
3. Ajoute des **enveloppes** (budgets plafonds : courses, sorties…)
4. Ajoute des **modules cumulatifs** (essence, parking…)
5. Au fur et à mesure du mois, saisis tes dépenses

Tu peux naviguer entre les mois avec **◀ / ▶**.

---

## Explication des indicateurs

- **Total fixe** = charges fixes + budgets (enveloppes)
- **Fixes payés** = charges fixes cochées + dépenses des enveloppes
- **Fixes restants** = charges non cochées + budgets restants (enveloppes)
- **Reste sur salaire** = Salaire − Total fixe − (modules cumulatifs)
- **Reste actuel** = Salaire − (fixes cochés + dépenses saisies)

---

## Reset du mois

Le bouton **“Reset mois”** :
- décoche toutes les charges fixes
- remet à zéro les dépenses des enveloppes et modules cumulatifs
- **ne supprime pas** les enveloppes / modules / charges (tu peux les garder d’un mois à l’autre)

---

## Lancer en local

Option 1 (simple) : double-clique `index.html`  
> Certaines fonctionnalités PWA/offline sont plus fiables via un serveur local.

Option 2 (recommandé) : serveur local

### Avec Python
```bash
python -m http.server 8000
