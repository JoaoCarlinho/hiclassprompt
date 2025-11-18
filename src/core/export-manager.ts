/**
 * Export Manager
 * Multi-format export system for classification results
 */

import * as XLSX from 'xlsx';
import { logger } from '../utils/logger';
import type { ClassificationResult, AIProvider } from '../types';

/**
 * Export format types
 */
export type ExportFormat = 'csv' | 'json' | 'xlsx';

/**
 * Export filter options
 */
export interface ExportFilter {
  provider?: AIProvider;
  minConfidence?: number;
  category?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Export options
 */
export interface ExportOptions {
  format: ExportFormat;
  filter?: ExportFilter;
  includeMetadata?: boolean;
  filename?: string;
}

/**
 * Export metadata
 */
export interface ExportMetadata {
  exportDate: Date;
  totalResults: number;
  filteredResults: number;
  filters?: ExportFilter;
  config?: Record<string, unknown>;
}

/**
 * CSV row structure
 */
interface CSVRow {
  requestId: string;
  provider: string;
  category: string;
  confidence: number;
  confidenceLevel: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  timestamp: string;
}

/**
 * Export manager for multi-format result export
 */
export class ExportManager {
  /**
   * Export results to specified format
   * @param results - Classification results to export
   * @param options - Export options
   * @returns Exported data as string or buffer
   */
  async export(
    results: ClassificationResult[],
    options: ExportOptions
  ): Promise<string | Buffer> {
    const startTime = Date.now();

    // Apply filters
    const filteredResults = this.applyFilters(results, options.filter);

    logger.info('Exporting results', {
      format: options.format,
      totalResults: results.length,
      filteredResults: filteredResults.length,
    });

    let exported: string | Buffer;

    switch (options.format) {
      case 'csv':
        exported = this.exportToCSV(filteredResults);
        break;
      case 'json':
        exported = this.exportToJSON(filteredResults, options.includeMetadata);
        break;
      case 'xlsx':
        exported = await this.exportToExcel(filteredResults);
        break;
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }

    const duration = Date.now() - startTime;
    logger.info('Export complete', {
      format: options.format,
      resultCount: filteredResults.length,
      durationMs: duration,
    });

    return exported;
  }

  /**
   * Export results to CSV format
   * @param results - Classification results
   * @returns CSV string
   */
  exportToCSV(results: ClassificationResult[]): string {
    const rows: string[][] = [];

    // Add headers
    rows.push([
      'requestId',
      'provider',
      'category',
      'confidence',
      'confidenceLevel',
      'inputTokens',
      'outputTokens',
      'totalTokens',
      'costUsd',
      'latencyMs',
      'timestamp',
    ]);

    // Add data rows
    for (const result of results) {
      const row: CSVRow = {
        requestId: result.requestId,
        provider: result.provider,
        category: result.primaryCategory.category,
        confidence: result.primaryCategory.confidence,
        confidenceLevel: result.primaryCategory.confidenceLevel,
        inputTokens: result.tokens.input,
        outputTokens: result.tokens.output,
        totalTokens: result.tokens.total,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
        timestamp: result.timestamp.toISOString(),
      };

      rows.push([
        row.requestId,
        row.provider,
        row.category,
        row.confidence.toString(),
        row.confidenceLevel,
        row.inputTokens.toString(),
        row.outputTokens.toString(),
        row.totalTokens.toString(),
        row.costUsd.toFixed(6),
        row.latencyMs.toString(),
        row.timestamp,
      ]);
    }

    // Convert to CSV format (properly escape values)
    return rows
      .map((row) =>
        row
          .map((cell) => {
            const escaped = cell.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\n');
  }

  /**
   * Export results to JSON format
   * @param results - Classification results
   * @param includeMetadata - Include export metadata
   * @returns JSON string
   */
  exportToJSON(results: ClassificationResult[], includeMetadata = true): string {
    const data: {
      metadata?: ExportMetadata;
      results: ClassificationResult[];
    } = {
      results,
    };

    if (includeMetadata) {
      data.metadata = {
        exportDate: new Date(),
        totalResults: results.length,
        filteredResults: results.length,
      };
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export results to Excel format
   * @param results - Classification results
   * @returns Excel file buffer
   */
  async exportToExcel(results: ClassificationResult[]): Promise<Buffer> {
    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = this.generateSummaryData(results);
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Results sheet
    const resultsData = this.generateResultsSheetData(results);
    const resultsSheet = XLSX.utils.aoa_to_sheet(resultsData);
    XLSX.utils.book_append_sheet(workbook, resultsSheet, 'Results');

    // By provider sheet
    const byProviderData = this.generateByProviderData(results);
    const byProviderSheet = XLSX.utils.aoa_to_sheet(byProviderData);
    XLSX.utils.book_append_sheet(workbook, byProviderSheet, 'By Provider');

    // Write to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return buffer as Buffer;
  }

  /**
   * Apply filters to results
   * @param results - Classification results
   * @param filter - Filter options
   * @returns Filtered results
   */
  private applyFilters(
    results: ClassificationResult[],
    filter?: ExportFilter
  ): ClassificationResult[] {
    if (!filter) {
      return results;
    }

    return results.filter((result) => {
      // Filter by provider
      if (filter.provider && result.provider !== filter.provider) {
        return false;
      }

      // Filter by minimum confidence
      if (
        filter.minConfidence !== undefined &&
        result.primaryCategory.confidence < filter.minConfidence
      ) {
        return false;
      }

      // Filter by category
      if (
        filter.category &&
        result.primaryCategory.category !== filter.category
      ) {
        return false;
      }

      // Filter by date range
      if (filter.startDate && result.timestamp < filter.startDate) {
        return false;
      }

      if (filter.endDate && result.timestamp > filter.endDate) {
        return false;
      }

      return true;
    });
  }

  /**
   * Generate summary data for Excel
   * @param results - Classification results
   * @returns Summary data array
   */
  private generateSummaryData(results: ClassificationResult[]): unknown[][] {
    const totalResults = results.length;
    const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.tokens.total, 0);
    const avgLatency =
      results.reduce((sum, r) => sum + r.latencyMs, 0) / totalResults;

    const providerCounts = new Map<AIProvider, number>();
    results.forEach((r) => {
      providerCounts.set(r.provider, (providerCounts.get(r.provider) || 0) + 1);
    });

    const data: unknown[][] = [
      ['Classification Results Summary'],
      [''],
      ['Metric', 'Value'],
      ['Total Results', totalResults],
      ['Total Cost (USD)', totalCost.toFixed(6)],
      ['Total Tokens', totalTokens],
      ['Average Latency (ms)', avgLatency.toFixed(2)],
      ['Average Cost/Result', (totalCost / totalResults).toFixed(6)],
      [''],
      ['By Provider'],
    ];

    for (const [provider, count] of providerCounts) {
      data.push([provider, count]);
    }

    return data;
  }

  /**
   * Generate results sheet data for Excel
   * @param results - Classification results
   * @returns Results data array
   */
  private generateResultsSheetData(results: ClassificationResult[]): unknown[][] {
    const data: unknown[][] = [
      [
        'Request ID',
        'Provider',
        'Category',
        'Confidence',
        'Confidence Level',
        'Input Tokens',
        'Output Tokens',
        'Total Tokens',
        'Cost (USD)',
        'Latency (ms)',
        'Timestamp',
      ],
    ];

    for (const result of results) {
      data.push([
        result.requestId,
        result.provider,
        result.primaryCategory.category,
        result.primaryCategory.confidence,
        result.primaryCategory.confidenceLevel,
        result.tokens.input,
        result.tokens.output,
        result.tokens.total,
        result.costUsd,
        result.latencyMs,
        result.timestamp.toISOString(),
      ]);
    }

    return data;
  }

  /**
   * Generate by-provider data for Excel
   * @param results - Classification results
   * @returns By-provider data array
   */
  private generateByProviderData(results: ClassificationResult[]): unknown[][] {
    const byProvider = new Map<
      AIProvider,
      {
        count: number;
        totalCost: number;
        totalTokens: number;
        avgLatency: number;
      }
    >();

    results.forEach((result) => {
      const stats = byProvider.get(result.provider) || {
        count: 0,
        totalCost: 0,
        totalTokens: 0,
        avgLatency: 0,
      };

      stats.count++;
      stats.totalCost += result.costUsd;
      stats.totalTokens += result.tokens.total;
      stats.avgLatency =
        (stats.avgLatency * (stats.count - 1) + result.latencyMs) / stats.count;

      byProvider.set(result.provider, stats);
    });

    const data: unknown[][] = [
      [
        'Provider',
        'Count',
        'Total Cost (USD)',
        'Avg Cost/Request',
        'Total Tokens',
        'Avg Latency (ms)',
      ],
    ];

    for (const [provider, stats] of byProvider) {
      data.push([
        provider,
        stats.count,
        stats.totalCost.toFixed(6),
        (stats.totalCost / stats.count).toFixed(6),
        stats.totalTokens,
        stats.avgLatency.toFixed(2),
      ]);
    }

    return data;
  }

  /**
   * Stream large export to file
   * @param results - Classification results
   * @param options - Export options
   * @param outputPath - Output file path
   */
  async exportToFile(
    results: ClassificationResult[],
    options: ExportOptions,
    outputPath: string
  ): Promise<void> {
    const { writeFileSync } = await import('fs');
    const data = await this.export(results, options);

    writeFileSync(outputPath, data);

    logger.info('Export saved to file', {
      path: outputPath,
      format: options.format,
      resultCount: results.length,
    });
  }
}
