import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

interface ExportConfig {
  userId: string;
  name: string;
  query: any;
  format: string;
  scheduleCron: string;
}

export class ExportService {
  async exportToCSV(data: any[], columns: string[]): Promise<Buffer> {
    const csvData = stringify(data, {
      header: true,
      columns: columns
    });
    return Buffer.from(csvData);
  }

  async exportToExcel(data: any[], sheetName: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    // Add header row
    if (data.length > 0) {
      worksheet.columns = Object.keys(data[0]).map(key => ({
        header: key,
        key: key,
        width: 20
      }));

      // Add data rows
      data.forEach(row => worksheet.addRow(row));

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      };
    }

    return await workbook.xlsx.writeBuffer() as Buffer;
  }

  async exportToPDF(data: any[], title: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument();

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(20).text(title, { align: 'center' });
      doc.moveDown();

      // Add data
      if (data.length > 0) {
        const headers = Object.keys(data[0]);

        // Table header
        doc.fontSize(10);
        let yPosition = doc.y;
        headers.forEach((header, i) => {
          doc.text(header, 50 + i * 100, yPosition, { width: 90 });
        });
        doc.moveDown();

        // Table data
        data.forEach(row => {
          yPosition = doc.y;
          headers.forEach((header, i) => {
            const value = String(row[header] || '');
            doc.text(value.substring(0, 20), 50 + i * 100, yPosition, { width: 90 });
          });
          doc.moveDown(0.5);
        });
      }

      doc.end();
    });
  }

  async saveToS3(buffer: Buffer, filename: string, contentType: string): Promise<string> {
    const key = `exports/${new Date().toISOString().split('T')[0]}/${filename}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || 'hiclassprompt-exports',
      Key: key,
      Body: buffer,
      ContentType: contentType
    }));

    return key;
  }

  async scheduleExport(config: ExportConfig): Promise<void> {
    // Store export config in database for cron job processing
    console.log('Export scheduled:', config);
    // Implementation would use a job queue or cron service
  }
}

export const exportService = new ExportService();
