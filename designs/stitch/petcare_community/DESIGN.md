---
name: PetCare Community
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#3e4947'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#8c4e38'
  on-secondary: '#ffffff'
  secondary-container: '#feae92'
  on-secondary-container: '#793f2a'
  tertiary: '#893822'
  on-tertiary: '#ffffff'
  tertiary-container: '#a84f37'
  on-tertiary-container: '#ffe4de'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#ffdbcf'
  secondary-fixed-dim: '#ffb59c'
  on-secondary-fixed: '#380d01'
  on-secondary-fixed-variant: '#6f3723'
  tertiary-fixed: '#ffdbd2'
  tertiary-fixed-dim: '#ffb4a1'
  on-tertiary-fixed: '#3c0800'
  on-tertiary-fixed-variant: '#7c2e19'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

The design system is crafted for a compassionate, community-driven pet care, adoption, and mutual-aid platform. The brand values balance dependability with gentle warmth—eschewing juvenile paw prints or cartoonish motifs in favor of refined, human-centric modernism. 

Visual characteristics include:
- **Clean Structure with Tactile Softness:** White elevated surfaces resting on a quiet, warm-tinted neutral canvas (`#F8FAF9`).
- **Humanitarian Depth:** Calming deep teal (`#0F766E`) conveys veterinary authority and safety, while emotional triggers and heart-led actions (e.g., adoptions, favoriting, foster support) leverage a tailored coral accent (`#F4A58A` / `#E07A5F`).
- **Tone:** Empathetic, orderly, and accessible. Microcopy and labels are standardized in French, utilizing natural, welcoming language suited for pet owners, shelters, and volunteers.

## Colors

The palette establishes clinical competence softened by organic, warm accents.

### Core Swatches
- **Primary (`#0F766E`):** Teal 700. Serves as the bedrock brand color: primary actions, selected navigation items, key headers, and validation states.
- **Secondary Accent (`#F4A58A`):** Soft Coral. Applied to emotional micro-interactions, decorative badges, foster tags, and playful surface highlights.
- **Tertiary Accent (`#E07A5F`):** Deep Coral. Used wherever coral text, outlines, or icons must meet WCAG AA contrast standards against light backgrounds.
- **Neutral Dark (`#1F2937`):** Gray 800. Primary typography, dark icon states, high-contrast labels.
- **Neutral Subtle (`#6B7280`):** Gray 500. Subtitles, metadata, timestamps, helper text, and secondary icons.
- **Canvas (`#F8FAF9`):** Soft tinted off-white background preventing optical glare while maintaining an organic warmth.
- **Surface (`#FFFFFF`):** Pure white used for elevated cards, modaled sheets, and form fields.
- **Outline (`#E5E7EB`):** Gray 200. Used for structural dividers and subtle container borders.

### Status Tokens (French Semantics)
- **Disponible / Confirmé (Success):** `#10B981` (Surface fill: `#ECFDF5`)
- **En attente / Réservé (Warning):** `#F59E0B` (Surface fill: `#FFFBEB`)
- **Adopté (Heart/Community):** `#E07A5F` text & icon, `#F4A58A` secondary tint (Surface fill: `#FFF7F5`)
- **Refusé / Annulé / Archivé (Muted):** `#6B7280` (Surface fill: `#F3F4F6`)
- **Erreur (Critical):** `#DC2626` (Surface fill: `#FEF2F2`)

## Typography

Inter serves as the unified typographic engine, configured with tight tracking across display layers and open, comfortable leading for descriptive veterinary and adoption profiles.

- **Headlines:** Set in `font-weight: 600` and `700` with subtle negative tracking (`-0.01em` to `-0.02em`) to ground pet profiles, modal titles, and section introductions.
- **Body Text:** Uses standard weight (`400`) in `#1F2937` with generous vertical rhythm to accommodate medical notes, dietary requirements, and narrative bios.
- **Metadata and Captions:** Rendered in `label-sm` or `body-sm` using `#6B7280` to establish clean information hierarchy without visually cluttering cards.

## Layout & Spacing

The layout follows a fluid-responsive multi-column model built on an 8pt modular base:

- **Mobile Viewports (<640px):** Single-column layout with `margin: 1rem` and internal component padding using `space-md` (16px). Grids collapse to single units with card lists separated by `space-md`.
- **Tablet Viewports (640px - 1024px):** 6-column grid with `margin-md: 2rem` and `gutter: 1rem`. Pet directories reflow to 2 columns.
- **Desktop Viewports (>1024px):** 12-column grid capped at a maximum container width of `1280px`, with `margin-lg: 3rem` and `gutter-md: 1.5rem`. Pet listings scale to 3 or 4 columns.
- **Spacing Rhythm:** Internal card padding is strictly uniform at `1.25rem` to `1.5rem` (`space-lg`), producing consistent breathing room around imagery, pet statistics, and badges.

## Elevation & Depth

Surfaces maintain physical lightness through warm ambient drop-shadows combined with hairline borders, preventing cards from feeling disconnected from the `#F8FAF9` backdrop.

- **Level 0 (Flat Canvas):** `#F8FAF9` with zero shadow.
- **Level 1 (Cards, List Items):** Pure `#FFFFFF` background, a structural border of `1px solid #E5E7EB`, and ambient shadow: `0px 2px 8px -2px rgba(31, 41, 55, 0.04), 0px 4px 16px -4px rgba(31, 41, 55, 0.06)`.
- **Level 2 (Hovered Cards, Dropdowns, Popovers):** `box-shadow: 0px 8px 24px -6px rgba(31, 41, 55, 0.08), 0px 4px 12px -2px rgba(31, 41, 55, 0.03)`, keeping border intact.
- **Level 3 (Modals, Slide-over Sheets):** `box-shadow: 0px 20px 40px -12px rgba(15, 118, 110, 0.12), 0px 1px 3px rgba(31, 41, 55, 0.05)`, tinted with primary teal tone for depth grounding.

## Shapes

The design system embraces an approachable, reassuring form language centered around 16px corner geometry:

- **Cards & Modules:** Explicitly shaped with `rounded-2xl` (`16px` / `1rem`), delivering a friendly, non-aggressive aesthetic while preserving structural cleanliness.
- **Form Fields & Small Interactive Blocks:** `rounded-lg` (`8px` to `10px`) for ergonomic input clarity.
- **Buttons, Badges, and Status Chips:** Full pill geometry (`rounded-full` / `9999px`) to emphasize touch-friendliness and status signifiers.
- **Pet Avatars & Media:** Photos feature `rounded-2xl` masking for card headers and `rounded-full` for user and animal thumb circulars.

## Components

### Buttons
- **Primaire (Primary):** Solid `#0F766E` fill, `#FFFFFF` text, `rounded-full`, height `44px` (touch-target compliant), `padding: 0 1.5rem`. Hover: `#115E59`.
- **Émotion / Action Clé (Emotional Action):** For adoptions, sponsorship, or favorites: Solid `#E07A5F` fill with `#FFFFFF` text, or transparent background with `#E07A5F` icon and light coral hover tint (`#FFF7F5`).
- **Secondaire (Secondary):** Outlined `1px solid #E5E7EB`, `#1F2937` label, `#FFFFFF` surface. Hover: `#F8FAF9` surface with `#0F766E` border.
- **Tertiaire (Ghost):** Transparent surface, `#0F766E` text. Hover: `#F0FDFA` surface.

### Chips & Status Badges
Rendered with `rounded-full`, `height: 28px`, `padding: 0 0.75rem`, text style `label-md`.
- **Disponible:** Background `#ECFDF5`, text `#10B981`, dot indicator `#10B981`.
- **Confirmé:** Background `#ECFDF5`, text `#047857`.
- **En attente / Réservé:** Background `#FFFBEB`, text `#B45309`.
- **Adopté:** Background `#FFF7F5`, text `#E07A5F`.
- **Refusé / Annulé:** Background `#F3F4F6`, text `#4B5563`.
- **Urgent / Soins:** Background `#FEF2F2`, text `#DC2626`.

### Cards (Fiches Animaux & Communauté)
- **Structure:** Pure white (`#FFFFFF`) surface, `rounded-2xl` (16px), bordered by `1px solid #E5E7EB`, subtle Level 1 ambient shadow.
- **Photo Area:** Aspect ratio 4:3 or 1:1, pinned to card edges or inset by `0.75rem` with `rounded-xl`. Includes an absolute-positioned floating favorite button (white pill, `#E07A5F` icon).
- **Content:** Headline-sm for pet name, row of trait tags (e.g., "Chien", "2 ans", "Sociable chats"), location indicator with secondary icon `#6B7280`.

### Form Fields & Inputs
- **Text Inputs:** Height `44px`, background `#FFFFFF`, border `1px solid #E5E7EB`, `rounded-lg` (8px). Placeholder `#9CA3AF`, active text `#1F2937`.
- **Focus State:** Border color `#0F766E`, subtle ring `0 0 0 3px rgba(15, 118, 110, 0.15)`. No raw browser outlines.
- **Helper / Error Text:** Displayed beneath input in `body-sm`. Error color `#DC2626` with border `#DC2626`.

### Checkboxes & Radio Buttons
- **Checkbox:** `20px x 20px`, `rounded-md` (4px). Inactive: `border: 1.5px solid #D1D5DB`. Active: `#0F766E` solid fill with white checkmark.
- **Radio:** `20px x 20px`, `rounded-full`. Active: `#0F766E` border with centered `#0F766E` inset dot.

### Lists & Activity Rows
- **List Items:** Horizontal card-like containers on `#FFFFFF` with `rounded-xl`, separated by `space-sm` gaps or divided by `1px solid #E5E7EB`.
- **Avatar Insets:** `48px x 48px` circular (`rounded-full`) pet or volunteer portraits, padded from title block by `space-md` (16px).