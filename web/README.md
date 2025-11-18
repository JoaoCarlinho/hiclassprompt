# AI Ops Prompt IDE - Web Frontend

Modern web-based interface for the AI Ops Prompt IDE, built with Next.js 14, React, TypeScript, and Tailwind CSS.

## Features

- **Dashboard**: Real-time overview of classification activities, costs, and performance
- **Single Classification**: Upload and classify individual images with AI providers
- **Batch Processing**: Process thousands of images in parallel with progress tracking
- **Provider Comparison**: Compare multiple AI providers side-by-side
- **Cost Analytics**: Track spending, ROI, and budget status
- **Settings**: Configure providers, budgets, and preferences

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React
- **State Management**: React Hooks
- **Date Formatting**: date-fns

## Getting Started

### Prerequisites

- Node.js 20 LTS or higher
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
web/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx           # Dashboard
│   │   ├── classify/          # Single classification
│   │   ├── batch/             # Batch processing
│   │   ├── compare/           # Provider comparison
│   │   ├── costs/             # Cost analytics
│   │   └── settings/          # Settings
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── StatCard.tsx
│   │   ├── layout/            # Layout components
│   │   │   ├── Navigation.tsx
│   │   │   └── Layout.tsx
│   │   └── Dashboard/         # Page-specific components
│   │       ├── QuickStats.tsx
│   │       ├── ActiveBatches.tsx
│   │       ├── CostTrendChart.tsx
│   │       └── RecentActivity.tsx
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts
│   ├── styles/                # Global styles
│   │   └── globals.css
│   └── lib/                   # Utility functions
├── public/                    # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## Component Library

### UI Components

- **Button**: Primary, secondary, outline, ghost, and danger variants
- **Card**: Flexible card container with header, title, and content
- **ProgressBar**: Configurable progress indicator with labels
- **Badge**: Status badges with multiple variants
- **StatCard**: Dashboard statistic display with trend indicators

### Layout Components

- **Navigation**: Top navigation bar with routing
- **Layout**: Main layout wrapper with consistent spacing

### Page Components

Each page has dedicated components for its specific functionality:
- Dashboard components (QuickStats, ActiveBatches, etc.)
- Classification components
- Batch processing components
- Cost analytics components

## Styling

The application uses Tailwind CSS for styling with:
- Dark mode support
- Responsive design (mobile-first)
- Custom color palette based on primary blue theme
- Accessible color contrast
- Smooth transitions and animations

## Development

### Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Format check
npm run format:check
```

### Build

```bash
# Production build
npm run build

# Analyze bundle
npm run build && npm run analyze
```

## API Integration

The frontend is designed to work with the backend API. Update API endpoints in the configuration:

```typescript
// src/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

## Environment Variables

Create a `.env.local` file:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=your_analytics_id
```

## Key Features

### Dashboard
- Quick stats (images processed, success rate, cost, latency)
- Active batch monitoring with progress bars
- 7-day cost trend chart
- Category distribution visualization
- Provider performance comparison
- Recent activity table

### Single Classification
- Drag-and-drop image upload
- URL-based image loading
- Provider selection (auto, manual)
- Real-time classification results
- Confidence visualization
- Performance metrics display

### Batch Processing
- Folder/CSV/URL input support
- Configurable concurrency (6-15 requests)
- Real-time progress tracking
- Live statistics (success/fail/rate)
- Pause/resume functionality
- Cost estimation

### Cost Analytics
- 30-day cost trends
- Provider cost breakdown
- Budget status (daily/weekly/monthly)
- ROI analysis with savings calculation
- Annual projections
- Export to CSV/Excel/PDF

## Performance

- Server-side rendering for initial page load
- Client-side routing for instant navigation
- Optimized images and assets
- Code splitting for faster loads
- Lazy loading for charts and heavy components

## Accessibility

- Semantic HTML structure
- ARIA labels for screen readers
- Keyboard navigation support
- High contrast colors
- Focus indicators

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

MIT License - see LICENSE file for details
