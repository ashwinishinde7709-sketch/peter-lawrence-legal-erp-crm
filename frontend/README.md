# Peter Lawrence Legal ERP & CRM — Frontend Only

This package contains the React + Vite frontend only. The existing visual design, theme, colors, responsive layouts, navigation, dashboards, pages, forms, tables, cards, and modal surfaces are preserved.

## Run

```bash
npm install
npm run dev
```

Build and preview:

```bash
npm run build
npm run preview
```

## Data boundary

There is intentionally no backend, Express server, MongoDB integration, authentication backend, API route, seeded data, demo user, mock database, or sample business record in this package. All collection reads and form writes are routed through `src/services/placeholderService.js`, which returns empty collections and presentation-only responses. Replace that file with your own service adapter when connecting a backend.

Every module starts empty and exposes its existing empty states. Creation buttons open the existing forms/modals and show the existing toast feedback without persisting records.
