# Design System Strategy: Clinical Kineticism

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Sentient Laboratory."** 

We are moving away from the "SaaS Dashboard" trope and toward a high-end, medical-grade interface that feels alive yet disciplined. The goal is to balance the cold precision of clinical data with the fluid, organic nature of human neurobiology. By utilizing **intentional asymmetry** and **tonal layering**, we create a sense of deep focus. This is not just a logging tool; it is a premium diagnostic environment.

The system breaks the "template" look by treating the screen as a 3D space. Components don't just sit on a grid—they float within a pressurized, dark-matter void, using "glow-mapping" to draw the eye to critical biometric fluctuations.

---

## 2. Colors & Surface Philosophy
The palette is rooted in deep space and electric pulses. The primary objective is "Visual Quiet" punctuated by "Luminous Data."

### The "No-Line" Rule
Prohibit 1px solid borders for sectioning. Traditional borders are "clutter." Instead, define boundaries through:
- **Background Shifts:** Use `surface-container-low` (#1a1a2b) against `surface` (#121222) to imply a change in context.
- **Tonal Transitions:** Rely on the shift between `surface-container` tiers to create structure.

### Surface Hierarchy & Nesting
Treat the UI as stacked sheets of "Smart Glass." 
1. **Base Layer:** `surface-container-lowest` (#0c0c1d) for the absolute background.
2. **Main Content Areas:** `surface-container` (#1e1e2f).
3. **Interactive Elements:** `surface-container-high` (#29283a) to "lift" them toward the user.

### The "Glass & Gradient" Rule
To achieve a "signature" look, every card must utilize `backdrop-filter: blur(12px)`. Apply a subtle linear gradient to main surfaces: from `primary-container` (#8781ff) at 5% opacity to `surface-container` at 100%. This creates a "sheen" that feels expensive and bespoke.

---

## 3. Typography: The Editorial Contrast
We use a "Technological/Humanist" pairing to convey both authority and legibility.

- **Display & Headlines (Space Grotesk):** This is our "Technological" voice. The geometric quirks of Space Grotesk suggest precision engineering. Use `display-lg` for biometric summaries to create an editorial, high-impact feel.
- **Body & Labels (Inter):** This is our "Humanist" voice. Inter is used for clinical data points and logs because of its high x-height and exceptional readability under stress.

**Hierarchy Strategy:** 
Use extreme scale contrast. A `display-md` metric (e.g., "BPM 142") should sit next to a `label-sm` ("90th Percentile") to create a clear informational hierarchy that feels like a premium medical journal.

---

## 4. Elevation & Depth
Depth in this system is a product of light, not physics.

- **The Layering Principle:** Achieve lift by placing `surface-container-highest` elements on top of `surface-dim`. This creates a soft, natural focal point without heavy shadows.
- **Ambient Glows:** Standard black shadows are forbidden. Instead, use "Accent Glows." If a high-stress alert card is active, use a `box-shadow` with the `error` color (#ffb4ab) at 15% opacity and a 40px blur. This simulates a warning light reflecting off the "glass" UI.
- **The "Ghost Border" Fallback:** If a divider is mandatory, use the `outline-variant` token (#464555) at 15% opacity. It should be felt, not seen.

---

## 5. Components

### Cards & Data Modules
*   **Style:** `rounded-xl` (1.5rem), `surface-container-low` background, `backdrop-blur`.
*   **Rule:** Forbid divider lines. Use `body-sm` spacing to separate metrics. Every card should have a 1px "Ghost Border" top-edge highlight to catch the "light."

### Buttons (Kinetic Triggers)
*   **Primary:** `primary` (#c4c0ff) background with `on-primary` (#2000a4) text. No border. Subtle `primary` glow on hover.
*   **Secondary:** `surface-container-high` background with `primary` text. This looks like "etched glass."
*   **Tertiary:** Ghost style. No background, `secondary` text, underlined only on hover.

### Inputs & Biometric Logs
*   **Fields:** Use `surface-container-lowest` for the input well to create a "recessed" look. 
*   **Focus State:** The border doesn't just change color; it glows with a 10px `primary` outer-glow to signal the "Active Diagnostic" state.

### Biometric Status Chips
*   **High (Stress):** `error-container` background, `error` text.
*   **Low (Recovery):** `on-secondary-container` background, `secondary` text.
*   **Interaction:** Chips should be pill-shaped (`rounded-full`) to contrast against the `xl` corners of the containers.

### Additional Relevant Component: The "Pulse Timeline"
A custom component for this system: A horizontal scrollable list of biometric events where the connector line is a subtle gradient glow rather than a solid line, emphasizing the fluid nature of time and stress.

---

## 6. Do's and Don'ts

### Do:
*   **Use Asymmetry:** Place high-level metrics off-center to create a dynamic, modern layout.
*   **Embrace Negative Space:** Allow the `background` (#121222) to breathe. Deep black space conveys "calm," which is essential for a stress-logging app.
*   **Color as Data:** Only use `primary` and `secondary` for interactive or critical data. Use `on-surface-variant` (#c7c4d8) for everything else.

### Don't:
*   **Don't use 100% White:** Never use #FFFFFF. It will break the dark-room clinical aesthetic. Use `on-background` (#e3e0f8) for maximum brightness.
*   **Don't use Solid Grids:** Avoid boxing everything into equal-sized squares. It looks like a spreadsheet; we are building a "medical instrument."
*   **Don't use Default Lucide Weights:** Set Lucide icon stroke-widths to 1.5px to match the sophisticated weight of Inter. Standard 2px is too heavy for this system.