/**
 * Export Utility Functions
 * Provides functions for exporting data in various formats
 */

/**
 * Export data as JSON file
 */
export function exportAsJSON(data: any, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, filename);
}

/**
 * Export comparison data as CSV file
 */
export function exportAsCSV(data: any, filename: string): void {
  const rows: string[][] = [];

  // Header row
  rows.push([
    'Provider',
    'Model',
    'Avg Latency (ms)',
    'Total Cost (USD)',
    'Total Tokens',
    'Avg Confidence (%)',
    'Success Rate (%)',
  ]);

  // Data rows
  data.results.forEach((result: any) => {
    rows.push([
      result.provider,
      result.model,
      result.aggregates.averageLatency.toFixed(2),
      result.aggregates.totalCost.toFixed(6),
      result.aggregates.totalTokens.toString(),
      (result.aggregates.averageConfidence * 100).toFixed(2),
      (result.aggregates.successRate * 100).toFixed(2),
    ]);
  });

  // Add summary statistics
  rows.push([]);
  rows.push(['Summary Statistics']);
  rows.push(['Fastest Provider', data.statistics.fastest.provider]);
  rows.push(['Cheapest Provider', data.statistics.cheapest.provider]);
  rows.push(['Most Confident', data.statistics.mostConfident.provider]);
  rows.push(['Total Cost', `$${data.statistics.totalCost.toFixed(6)}`]);
  rows.push(['Total Tokens', data.statistics.totalTokens.toString()]);

  // Add consensus analysis
  rows.push([]);
  rows.push(['Consensus Analysis']);
  rows.push(['Agreement Level', `${data.consensus.agreementLevel}%`]);
  rows.push(['Majority Category', data.consensus.majorityCategory || 'N/A']);
  rows.push(['Agreement Count', data.consensus.agreementCount.toString()]);

  const csvString = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csvString], { type: 'text/csv' });
  downloadBlob(blob, filename);
}

/**
 * Trigger download of a blob
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
