# Graph Report - C:/Users/chams/Documents/GitHub/erp_external_app  (2026-05-08)

## Corpus Check
- 167 files · ~113,056 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 456 nodes · 567 edges · 93 communities (78 shown, 15 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.79)
- Token cost: 26,757 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Mobile API Client Utilities|Mobile API Client Utilities]]
- [[_COMMUNITY_Expo Mobile Route Modules|Expo Mobile Route Modules]]
- [[_COMMUNITY_Redis Notification & Push Store|Redis Notification & Push Store]]
- [[_COMMUNITY_Admin App Billing & Client UI|Admin App Billing & Client UI]]
- [[_COMMUNITY_PDFDoc Generator (BoldBorders)|PDF/Doc Generator (Bold/Borders)]]
- [[_COMMUNITY_Doc Asset Builder|Doc Asset Builder]]
- [[_COMMUNITY_Backend Test & Run Scripts|Backend Test & Run Scripts]]
- [[_COMMUNITY_Mobile Theme & Layout System|Mobile Theme & Layout System]]
- [[_COMMUNITY_Admin UI Primitives (shadcn)|Admin UI Primitives (shadcn)]]
- [[_COMMUNITY_Mobile Button Components|Mobile Button Components]]
- [[_COMMUNITY_Express Backend Core|Express Backend Core]]
- [[_COMMUNITY_Expense History Screen|Expense History Screen]]
- [[_COMMUNITY_Notifications Screen|Notifications Screen]]
- [[_COMMUNITY_Request Status Helpers|Request Status Helpers]]
- [[_COMMUNITY_API Test Scripts|API Test Scripts]]
- [[_COMMUNITY_Mobile Input Components|Mobile Input Components]]
- [[_COMMUNITY_Color Scheme  Dark Mode|Color Scheme / Dark Mode]]
- [[_COMMUNITY_Carousel Tab Navigation|Carousel Tab Navigation]]
- [[_COMMUNITY_Web Layout Shell|Web Layout Shell]]
- [[_COMMUNITY_Brand SVG Asset Builder|Brand SVG Asset Builder]]
- [[_COMMUNITY_Navigation Link Component|Navigation Link Component]]
- [[_COMMUNITY_Search Context Provider|Search Context Provider]]
- [[_COMMUNITY_Admin API Route Handlers|Admin API Route Handlers]]
- [[_COMMUNITY_Keyboard Avoidance Hook|Keyboard Avoidance Hook]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]

## God Nodes (most connected - your core abstractions)
1. `useColor()` - 45 edges
2. `getOdooClient()` - 19 edges
3. `check()` - 14 edges
4. `useSession()` - 14 edges
5. `main()` - 13 edges
6. `api()` - 12 edges
7. `section()` - 12 edges
8. `pt()` - 10 edges
9. `redisGet()` - 10 edges
10. `authHeader()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Odoo Connection Config (URL, DB, Username, Password)` --shares_data_with--> `Tenant Interface`  [INFERRED]
  backend/.env.example → admin_app/src/lib/types.ts
- `AvatarFallback()` --calls--> `useColor()`  [INFERRED]
  production-version/components/ui/avatar.tsx → production-version/hooks/useColor.ts
- `Next.js Wordmark Logo (SVG)` --conceptually_related_to--> `Next.js Agent Rules (AGENTS.md)`  [INFERRED]
  admin_app/public/next.svg → admin_app/AGENTS.md
- `Vercel Logo Triangle (SVG)` --conceptually_related_to--> `Next.js Agent Rules (AGENTS.md)`  [INFERRED]
  admin_app/public/vercel.svg → admin_app/AGENTS.md
- `Admin Devices [slug] API Route` --conceptually_related_to--> `Auth Router (/auth)`  [INFERRED]
  admin_app/src/app/api/admin/devices/[slug]/route.ts → backend/dist/index.js

## Hyperedges (group relationships)
- **Express Backend Middleware and Route Registration** — backend_index_express_app, backend_route_auth, backend_route_time_off, backend_route_expenses, backend_route_notifications, backend_rate_limiter [EXTRACTED 1.00]
- **Tenant Data Model and Related Types** — types_Tenant, types_TenantFormData, types_TenantStats, types_PlatformStats, types_HealthResult [EXTRACTED 0.95]
- **Notification Data Model** — types_NotificationEntry, types_NotificationPage, backend_route_notifications [INFERRED 0.85]
- **Odoo Integration Configuration** — backend_env_ODOO, types_Tenant, backend_index_express_app [INFERRED 0.75]

## Communities (93 total, 15 thin omitted)

### Community 0 - "Mobile API Client Utilities"
Cohesion: 0.05
Nodes (9): apiFetch(), friendlyError(), setUnauthorizedHandler(), activityColor(), activityIcon(), fetchDashboardData(), onRefresh(), SessionProvider() (+1 more)

### Community 1 - "Expo Mobile Route Modules"
Cohesion: 0.08
Nodes (10): getCache(), getOdooClient(), authHeader(), makeMockOdooClient(), signToken(), formatDatetime(), getLeaveTypeField(), leavePayload() (+2 more)

### Community 2 - "Redis Notification & Push Store"
Cohesion: 0.16
Nodes (14): readAll(), REDIS_KEY(), writeAll(), sendPushNotification(), redisCommand(), redisDel(), redisGet(), redisScan() (+6 more)

### Community 3 - "Admin App Billing & Client UI"
Cohesion: 0.11
Nodes (7): createTenantAction(), deleteTenantAction(), toggleEnabledAction(), updateStatusAction(), updateTenantAction(), Btn(), DSCard()

### Community 4 - "PDF/Doc Generator (Bold/Borders)"
Cohesion: 0.15
Nodes (15): bold(), borders(), bullet(), callout(), cellBorders(), checkbox(), code(), codeBlock() (+7 more)

### Community 5 - "Doc Asset Builder"
Cohesion: 0.2
Nodes (13): body(), border(), bullet(), caption(), featureTable(), h1(), h2(), h3() (+5 more)

### Community 6 - "Backend Test & Run Scripts"
Cohesion: 0.43
Nodes (17): api(), check(), fail(), main(), pass(), section(), step10_pushToken(), step11_adminApi() (+9 more)

### Community 7 - "Mobile Theme & Layout System"
Cohesion: 0.17
Nodes (5): useColor(), AnimatedCard(), Badge(), DatePicker(), Progress()

### Community 9 - "Mobile Button Components"
Cohesion: 0.19
Nodes (6): getFlexFromStyle(), getPressableStyle(), handlePress(), handlePressIn(), handleTouchablePress(), triggerHapticFeedback()

### Community 10 - "Express Backend Core"
Cohesion: 0.14
Nodes (14): JWT Secret Config, Express Application Entry Point, Shadow Portal Middleware, Rate Limiter (100 req / 15 min), Auth Router (/auth), Expenses Router (/expenses), Notifications Router (/notifications), Time Off Router (/time-off) (+6 more)

### Community 11 - "Expense History Screen"
Cohesion: 0.24
Nodes (4): fetchHistory(), handleSubmit(), handleTabChange(), onRefresh()

### Community 12 - "Notifications Screen"
Cohesion: 0.31
Nodes (6): fetchNotifications(), getNotificationColor(), getNotificationIcon(), handlePress(), markAsRead(), onRefresh()

### Community 14 - "API Test Scripts"
Cohesion: 0.46
Nodes (7): fail(), get(), getEmployeesDirectly(), pass(), post(), printSummary(), runTests()

### Community 16 - "Color Scheme / Dark Mode"
Cohesion: 0.29
Nodes (4): useColorScheme(), useModeToggle(), ThemeProvider(), ModeToggle()

### Community 19 - "Brand SVG Asset Builder"
Cohesion: 0.53
Nodes (4): buildFgSVG(), buildIconSVG(), buildLogoSVG(), portalMark()

### Community 21 - "Navigation Link Component"
Cohesion: 0.6
Nodes (3): getHrefString(), handlePress(), isNativeAppUrl()

### Community 32 - "Community 32"
Cohesion: 0.5
Nodes (4): Breaking Changes Warning for Next.js, Next.js Agent Rules (AGENTS.md), Next.js Wordmark Logo (SVG), Vercel Logo Triangle (SVG)

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (3): Odoo Connection Config (URL, DB, Username, Password), Tenant Interface, TenantFormData Type

## Knowledge Gaps
- **19 isolated node(s):** `Breaking Changes Warning for Next.js`, `api.getDevices() Call`, `PlatformStats Interface`, `TenantStats Interface`, `HealthResult Interface` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useColor()` connect `Mobile Theme & Layout System` to `Mobile API Client Utilities`, `Mobile Button Components`, `Expense History Screen`, `Notifications Screen`, `Request Status Helpers`, `Mobile Input Components`, `Color Scheme / Dark Mode`, `Carousel Tab Navigation`, `Web Layout Shell`, `Card UI Components`, `Search Context Provider`, `Bottom Sheet Component`, `Image Component`, `Attachment Picker`, `Community 30`, `Community 31`?**
  _High betweenness centrality (0.125) - this node is a cross-community bridge._
- **Why does `useSession()` connect `Mobile API Client Utilities` to `Expense History Screen`, `Notifications Screen`, `Request Status Helpers`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `cn()` connect `Admin UI Primitives (shadcn)` to `Web Layout Shell`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `useColor()` (e.g. with `AnimatedCard()` and `AvatarFallback()`) actually correct?**
  _`useColor()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Breaking Changes Warning for Next.js`, `api.getDevices() Call`, `PlatformStats Interface` to the rest of the system?**
  _19 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Mobile API Client Utilities` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Expo Mobile Route Modules` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._