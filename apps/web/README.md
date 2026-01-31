# DLN Volume Analytics Dashboard

Modern, real-time analytics dashboard for DLN (Decentralized Liquidity Network) order volumes built with Nuxt 3.

## Features

- 📊 **Interactive Volume Charts** - Visualize created vs fulfilled volumes with ECharts
- 📅 **Date Range Filtering** - Flexible date range selection with quick presets
- 📈 **Real-time Statistics** - Track total volume, orders, and fulfillment rates
- 📋 **Detailed Data Tables** - Sortable, exportable volume data tables
- 🎨 **Modern UI** - Built with custom component library (@incur-data/ui)
- 🔄 **State Management** - Composables for typed API calls
- 💪 **TypeScript** - Full type safety with shared DTOs
- 🎯 **Error Handling** - Comprehensive loading, empty, and error states

## Architecture

### Component Structure

```
pages/
  index.vue                    # Main dashboard page
components/
  dashboard/
    DashboardFilters.vue       # Filter form with date range picker
    VolumeChart.vue           # ECharts visualization component
    VolumeTable.vue           # Data table with sorting and export
composables/
  useAnalyticsApi.ts          # Typed API calls composable
```

### Key Components

#### DashboardFilters
Form component with:
- Date range picker with presets (Last 7/30/90 days, This/Last month)
- Event type filter (Created/Fulfilled)
- Chain ID filters
- Form validation
- Reset functionality

#### VolumeChart
Chart component featuring:
- Dual-line area chart (Created vs Fulfilled)
- Interactive tooltips
- Data zoom controls
- Summary metrics
- Loading and empty states

#### VolumeTable
Table component with:
- Sortable columns
- CSV export functionality
- Color-coded fulfillment rates
- Responsive design
- Loading and empty states

## Tech Stack

- **Framework**: Nuxt 3
- **Language**: TypeScript
- **UI Components**: @incur-data/ui (custom library)
- **Charts**: ECharts + vue-echarts
- **Validation**: Zod (via @incur-data/dtos)
- **Styling**: Scoped CSS with CSS variables

## Setup

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 8.0.0

### Installation

```bash
# Install dependencies (from monorepo root)
pnpm install

# Build UI package first
cd packages/ui
pnpm build

# Return to web app
cd ../../apps/web
```

### Environment Variables

Create a `.env` file:

```env
WEB_API_URL=http://localhost:3000
```

### Development

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Type checking
pnpm type-check
```

The dashboard will be available at `http://localhost:3000`

## Usage

### API Integration

The dashboard fetches data from the analytics API:

```typescript
GET /api/v1/analytics/daily-volume-summary
```

Query parameters:
- `fromDate` - Start date (YYYY-MM-DD)
- `toDate` - End date (YYYY-MM-DD)
- `eventType` - Filter by created/fulfilled (optional)
- `giveChainId` - Source chain filter (optional)
- `takeChainId` - Destination chain filter (optional)

### Composables

#### useDailyVolumeSummary

```typescript
import { useDailyVolumeSummary } from '~/composables/useAnalyticsApi';

const filters = ref({ fromDate: '2024-01-01', toDate: '2024-01-31' });
const { data, loading, error, execute, refresh } = useDailyVolumeSummary(filters);

// Execute the query
await execute();
```

#### getDatePresets

```typescript
import { getDatePresets } from '~/composables/useAnalyticsApi';

const presets = getDatePresets();
// Returns: Last 7/30/90 days, This month, Last month
```

## Component Library

The dashboard uses `@incur-data/ui` for all UI components:

```vue
<script setup>
import { Card, Button, Input, DateRangePicker } from '@incur-data/ui';
</script>
```

See `packages/ui/README.md` for component documentation.

## Features in Detail

### Date Range Filtering
- Quick presets for common ranges
- Custom date selection
- Validation (max 365 days)
- Automatic refresh on apply

### Volume Visualization
- Dual-line chart showing created vs fulfilled volumes
- Area fills for better visibility
- Interactive tooltips with detailed metrics
- Zoom and pan controls
- Summary statistics below chart

### Data Export
- Export filtered data to CSV
- Includes all visible columns
- Automatic filename with date

### Error Handling
- Network error recovery
- Empty state messaging
- Validation feedback
- Retry mechanisms

### Responsive Design
- Mobile-optimized layout
- Collapsible sidebar on small screens
- Responsive tables
- Touch-friendly controls

## Performance

- **SSR Disabled** - Client-side only for real-time data
- **Code Splitting** - Lazy-loaded components
- **Optimized Deps** - ECharts tree-shaking
- **Request Caching** - Smart refetch logic

## Type Safety

All API responses are validated using Zod schemas from `@incur-data/dtos`:

```typescript
import type { 
  DailyVolumeSummaryResultDto,
  VolumeQueryFiltersDto 
} from '@incur-data/dtos';
```

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## Contributing

1. Follow the project's TypeScript and ESLint config
2. Use the UI component library for consistency
3. Add proper error handling for all API calls
4. Include loading states for async operations
5. Write responsive, accessible components

## License

MIT
