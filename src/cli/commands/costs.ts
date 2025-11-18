/**
 * Costs command handler
 * Cost dashboard, ROI analysis, and cost reporting
 */

import { writeFileSync } from 'fs';
import { CostTracker } from '../../core/cost-tracker';
import { CostComparison } from '../../core/cost-comparison';
import { logger } from '../../utils/logger';

/**
 * Costs command options
 */
interface CostsOptions {
  provider?: string;
  output?: string;
  format?: string;
  verbose?: boolean;
}

/**
 * ROI Analysis
 */
interface ROIAnalysis {
  manualCostPerImage: number;
  aiCostPerImage: number;
  savingsPerImage: number;
  savingsPercent: number;
  timePerImageManual: number; // minutes
  timePerImageAI: number; // minutes
  timeSavingsPercent: number;
  breakEvenImages: number;
  projectedAnnualSavings: number;
}

/**
 * Calculate ROI analysis
 * @param tracker - Cost tracker
 * @returns ROI analysis
 */
function calculateROI(tracker: CostTracker): ROIAnalysis {
  const stats = tracker.getStats();
  const avgCostPerImage = stats.averageCostPerRequest;

  // Assumptions for manual classification
  const manualTimePerImage = 2; // 2 minutes per image manually
  const hourlyLaborCost = 15; // $15/hour labor cost
  const manualCostPerImage = (manualTimePerImage / 60) * hourlyLaborCost; // ~$0.50 per image

  // AI processing time
  const avgLatencyMs = stats.totalRequests > 0
    ? Array.from(stats.byProvider.values()).reduce(
        (sum, p) => sum + p.averageLatencyMs * p.requests,
        0
      ) / stats.totalRequests
    : 1000;
  const aiTimePerImage = avgLatencyMs / 1000 / 60; // Convert to minutes (~0.02 minutes)

  const savingsPerImage = manualCostPerImage - avgCostPerImage;
  const savingsPercent = (savingsPerImage / manualCostPerImage) * 100;
  const timeSavingsPercent =
    ((manualTimePerImage - aiTimePerImage) / manualTimePerImage) * 100;

  // Break-even calculation (if there's setup cost)
  const setupCost = 0; // No setup cost for this system
  const breakEvenImages = setupCost / savingsPerImage;

  // Annual projections (assuming 3M images/year from PRD)
  const annualImages = 3_000_000;
  const projectedAnnualSavings = annualImages * savingsPerImage;

  return {
    manualCostPerImage,
    aiCostPerImage: avgCostPerImage,
    savingsPerImage,
    savingsPercent,
    timePerImageManual: manualTimePerImage,
    timePerImageAI: aiTimePerImage,
    timeSavingsPercent,
    breakEvenImages,
    projectedAnnualSavings,
  };
}

/**
 * Export costs to CSV
 * @param tracker - Cost tracker
 * @returns CSV string
 */
function exportToCSV(tracker: CostTracker): string {
  const records = tracker.getRecords();

  const headers = [
    'Request ID',
    'Provider',
    'Timestamp',
    'Input Tokens',
    'Output Tokens',
    'Total Tokens',
    'Cost USD',
    'Latency Ms',
    'Model',
  ];

  const rows = records.map((r) => [
    r.requestId,
    r.provider,
    r.timestamp.toISOString(),
    r.inputTokens.toString(),
    r.outputTokens.toString(),
    r.totalTokens.toString(),
    r.costUsd.toFixed(6),
    r.latencyMs.toString(),
    r.model || '',
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Export costs to JSON
 * @param tracker - Cost tracker
 * @returns JSON string
 */
function exportToJSON(tracker: CostTracker): string {
  const stats = tracker.getStats();
  const records = tracker.getRecords();

  return JSON.stringify(
    {
      summary: {
        totalRequests: stats.totalRequests,
        totalCostUsd: stats.totalCostUsd,
        totalTokens: stats.totalTokens,
        averageCostPerRequest: stats.averageCostPerRequest,
        sessionDuration: tracker.getSessionDuration(),
      },
      byProvider: Object.fromEntries(stats.byProvider),
      records,
    },
    null,
    2
  );
}

/**
 * Costs command handler
 * @param options - Command options
 */
export function costsCommand(options: CostsOptions): void {
  try {
    if (options.verbose) {
      logger.setLevel('debug');
    }

    // Note: In a real implementation, this would load from persistent storage
    // For now, we'll create a demo tracker with sample data
    const tracker = new CostTracker();

    // Get statistics
    const stats = tracker.getStats();

    if (stats.totalRequests === 0) {
      // eslint-disable-next-line no-console
      console.log('\n⚠️  No cost data available. Process some images first.\n');
      process.exit(0);
    }

    // Display cost dashboard
    // eslint-disable-next-line no-console
    console.log('\n=== Cost Dashboard ===\n');

    // eslint-disable-next-line no-console
    console.log('Overall Statistics:');
    // eslint-disable-next-line no-console
    console.log(`  Total Requests: ${stats.totalRequests.toLocaleString()}`);
    // eslint-disable-next-line no-console
    console.log(`  Total Cost: $${stats.totalCostUsd.toFixed(2)}`);
    // eslint-disable-next-line no-console
    console.log(`  Average Cost/Request: $${stats.averageCostPerRequest.toFixed(6)}`);
    // eslint-disable-next-line no-console
    console.log(`  Total Tokens: ${stats.totalTokens.toLocaleString()}`);
    // eslint-disable-next-line no-console
    console.log(`  Session Duration: ${Math.round(tracker.getSessionDuration())}s\n`);

    // Provider comparison
    if (stats.byProvider.size > 1) {
      // eslint-disable-next-line no-console
      console.log('Provider Comparison:');
      const comparisons = CostComparison.compareProviders(tracker);
      // eslint-disable-next-line no-console
      console.log(CostComparison.generateComparisonTable(comparisons));
      // eslint-disable-next-line no-console
      console.log();
    }

    // By provider breakdown
    if (stats.byProvider.size > 0) {
      // eslint-disable-next-line no-console
      console.log('By Provider:');
      for (const [provider, providerStats] of stats.byProvider) {
        // eslint-disable-next-line no-console
        console.log(`\n  ${provider.toUpperCase()}:`);
        // eslint-disable-next-line no-console
        console.log(`    Requests: ${providerStats.requests.toLocaleString()}`);
        // eslint-disable-next-line no-console
        console.log(`    Total Cost: $${providerStats.costUsd.toFixed(2)}`);
        // eslint-disable-next-line no-console
        console.log(`    Avg Cost/Request: $${providerStats.averageCostPerRequest.toFixed(6)}`);
        // eslint-disable-next-line no-console
        console.log(`    Avg Latency: ${Math.round(providerStats.averageLatencyMs)}ms`);
      }
      // eslint-disable-next-line no-console
      console.log();
    }

    // ROI Analysis
    const roi = calculateROI(tracker);
    // eslint-disable-next-line no-console
    console.log('=== ROI Analysis ===\n');
    // eslint-disable-next-line no-console
    console.log('Cost Comparison:');
    // eslint-disable-next-line no-console
    console.log(`  Manual Classification: $${roi.manualCostPerImage.toFixed(4)}/image`);
    // eslint-disable-next-line no-console
    console.log(`  AI Classification: $${roi.aiCostPerImage.toFixed(6)}/image`);
    // eslint-disable-next-line no-console
    console.log(`  Savings: $${roi.savingsPerImage.toFixed(4)}/image (${roi.savingsPercent.toFixed(1)}%)\n`);

    // eslint-disable-next-line no-console
    console.log('Time Savings:');
    // eslint-disable-next-line no-console
    console.log(`  Manual: ${roi.timePerImageManual} min/image`);
    // eslint-disable-next-line no-console
    console.log(
      `  AI: ${roi.timePerImageAI.toFixed(4)} min/image (${roi.timeSavingsPercent.toFixed(1)}% faster)\n`
    );

    // eslint-disable-next-line no-console
    console.log('Projections:');
    // eslint-disable-next-line no-console
    console.log(`  Annual Savings (3M images): $${roi.projectedAnnualSavings.toLocaleString()}`);
    // eslint-disable-next-line no-console
    console.log();

    // Export if requested
    if (options.output) {
      const format = options.format || 'json';
      let content: string;

      if (format === 'csv') {
        content = exportToCSV(tracker);
      } else {
        content = exportToJSON(tracker);
      }

      writeFileSync(options.output, content);
      // eslint-disable-next-line no-console
      console.log(`Cost data exported to: ${options.output}\n`);
    }

    process.exit(0);
  } catch (error) {
    const err = error as Error;
    logger.error('Costs command failed', { error: err.message });
    // eslint-disable-next-line no-console
    console.error(`\nError: ${err.message}`);
    process.exit(1);
  }
}
