---
title: Accessibility
description: What the components do for keyboard, screen reader and low-vision users, and what's still yours to do.
order: 6
---
# Accessibility

## Built in

- **Keyboard:** every control works without a mouse and follows the WAI-ARIA patterns. Buttons respond to Enter and Space, menus and selects to arrows, Home/End and type-to-find, and tabs to arrow keys with roving focus.
- **Screen readers:** roles and states go through ElementInternals and are mirrored as attributes, so testing tools see them too. Labels connect automatically inside `<kl-field>`, and amounts say "Received ₦850,000.00" rather than leaning on colour or "+".
- **Contrast:** every style is checked in light and dark: 4.5:1 for text, 7:1 for body text, 3:1 for controls, borders and the focus ring.
- **Focus:** a visible ring on every interactive element; dialogs trap focus and return it.
- **Motion:** follows the OS reduced-motion setting, and `data-kl-motion` overrides it.
- **Forms:** errors show inline after the user leaves a field or tries to submit, are announced, and are linked with `aria-describedby`.

## Still yours

- Write real labels: every icon-only button needs `aria-label`.
- Don't put essential information only in tooltips or colour.
- Check your own brand colour's contrast (the [theming](../theming/) page shows it live).
- Test with a keyboard and a screen reader on your real pages.
