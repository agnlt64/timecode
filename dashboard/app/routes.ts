import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/dashboard-layout.tsx", [
    index("routes/overview.tsx"),
    route("projects", "routes/projects.tsx"),
    route("languages", "routes/languages.tsx"),
    route("weekdays", "routes/weekdays.tsx"),
    route("settings", "routes/settings.tsx")
  ])
] satisfies RouteConfig;
