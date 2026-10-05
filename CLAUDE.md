# Frontend Design Skill & Rules

This project enforces strict modern frontend design standards to completely avoid generic AI-generated layouts, repetitive card grids, and predictable color palettes (the "AI Slop" look).

## Core Design Philosophy
- **Anti-AI Slop**: Never use purple/indigo gradients on white backgrounds, generic pastel cards with large border-radii, glowing neon accents, or repetitive 3-column feature grids.
- **Asymmetry & Intent**: Break perfect symmetry. Use intentional white space, off-center alignments, and varied section heights.
- **Typography First**: Treat typography as a core design element. Avoid using just "Inter" or "System-UI" for everything. Mix sharp/serif headers with clean sans-serif body text.
- **Authentic Colors**: Use cohesive, real-world color palettes (e.g., earthy, brutalist, high-contrast, monochrome) instead of safe corporate-blue SaaS palettes.

## Required Process Before Coding
Before generating or modifying any UI code, you MUST think step-by-step and write down a brief:
1. **Design Statement**: What is the unique vibe, aesthetic, and mood of this specific interface?
2. **Token System**: Define explicit Tailwind classes or CSS variables for typography (scales, weights), color palette (primary, background, accents), and spacing/gaps.
3. **Layout Blueprint**: Describe how the layout breaks standard generic patterns (e.g., "Left-aligned oversized header with a 2-column off-grid content layout").

## Visual Guardrails
- **Animations**: Limit entry animations to a maximum of 1-2 key elements. Never fade-in every single card or paragraph on scroll.
- **Borders & Shadows**: Avoid soft, generic box-shadows on every element. Use either crisp, sharp borders, or completely flat surfaces.
- **Copywriting**: Never use generic AI placeholder text like "Transform your workflow" or words like "modern, beautiful, professional". Write realistic, human, and contextual copy.
