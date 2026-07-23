export type CsvImportQueueData = {
  importId: string;
  scrapingJobId: string;
  requestedById: string;
};

export type CsvImportQueueResult = {
  importId: string;
  importedRows: number;
  duplicateRows: number;
  invalidRows: number;
  completedAt: string;
};

export type CsvImportJobName = "import-business-csv";
