/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Microsoft SQL Server 2008 R2 DDL, Stored Procedures & Database Backup Engine
 */

export const SQL_SERVER_2008_SCHEMA = `-- ============================================================================
-- PHARMACORE STANDALONE DESKTOP POS & AI PURCHASING SYSTEM
-- TARGET DATABASE: Microsoft SQL Server 2008 R2 (or compatible 10.50+)
-- DIALECT: Transact-SQL (T-SQL)
-- ============================================================================

USE [master];
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'PharmaCoreDB')
BEGIN
    CREATE DATABASE [PharmaCoreDB]
    COLLATE SQL_Latin1_General_CP1_CI_AS;
END
GO

USE [PharmaCoreDB];
GO

-- 1. Users Table (RBAC: Admin / Salesman)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Users](
        [UserID] [VARCHAR](50) NOT NULL,
        [Username] [NVARCHAR](50) NOT NULL UNIQUE,
        [PasswordHash] [NVARCHAR](256) NOT NULL,
        [FullName] [NVARCHAR](100) NOT NULL,
        [Role] [VARCHAR](20) NOT NULL,
        [CreatedAt] [DATETIME] NOT NULL DEFAULT(GETDATE()),
        CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED ([UserID] ASC),
        CONSTRAINT [CK_Users_Role] CHECK ([Role] IN ('Admin', 'Moderator', 'Salesman'))
    );
    CREATE NONCLUSTERED INDEX [IX_Users_Username] ON [dbo].[Users]([Username] ASC);
END
GO

-- 2. Suppliers Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Suppliers]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Suppliers](
        [SupplierID] [VARCHAR](50) NOT NULL,
        [Name] [NVARCHAR](120) NOT NULL,
        [Phone] [VARCHAR](30) NULL,
        [Address] [NVARCHAR](255) NULL,
        [DefaultDiscountPercent] [DECIMAL](5, 2) NOT NULL DEFAULT (0.00),
        [TotalDue] [DECIMAL](18, 2) NOT NULL DEFAULT (0.00),
        CONSTRAINT [PK_Suppliers] PRIMARY KEY CLUSTERED ([SupplierID] ASC)
    );
END
GO

-- 3. Customers Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Customers]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Customers](
        [CustomerID] [VARCHAR](50) NOT NULL,
        [Name] [NVARCHAR](120) NOT NULL,
        [Phone] [VARCHAR](30) NULL,
        [Address] [NVARCHAR](255) NULL,
        [TotalDue] [DECIMAL](18, 2) NOT NULL DEFAULT (0.00),
        [LoyaltyPoints] [INT] NOT NULL DEFAULT (0),
        CONSTRAINT [PK_Customers] PRIMARY KEY CLUSTERED ([CustomerID] ASC)
    );
    CREATE NONCLUSTERED INDEX [IX_Customers_Phone] ON [dbo].[Customers]([Phone] ASC);
END
GO

-- 4. Medicines Table (with Rack Locator & Generic Substitute Search support)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Medicines]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Medicines](
        [MedicineID] [VARCHAR](50) NOT NULL,
        [TradeName] [NVARCHAR](150) NOT NULL,
        [GenericName] [NVARCHAR](150) NOT NULL,
        [RackNo] [VARCHAR](50) NOT NULL,
        [Unit] [VARCHAR](30) NOT NULL,
        [DefaultDiscountPercent] [DECIMAL](5, 2) NULL,
        [ReorderLevel] [INT] NOT NULL DEFAULT (20),
        [Status] [VARCHAR](20) NOT NULL DEFAULT ('Active'),
        [SupplierID] [VARCHAR](50) NULL,
        [Barcode] [VARCHAR](50) NULL,
        CONSTRAINT [PK_Medicines] PRIMARY KEY CLUSTERED ([MedicineID] ASC),
        CONSTRAINT [FK_Medicines_Suppliers] FOREIGN KEY([SupplierID]) REFERENCES [dbo].[Suppliers] ([SupplierID])
    );
    CREATE NONCLUSTERED INDEX [IX_Medicines_TradeName] ON [dbo].[Medicines]([TradeName] ASC);
    CREATE NONCLUSTERED INDEX [IX_Medicines_GenericName] ON [dbo].[Medicines]([GenericName] ASC);
    CREATE NONCLUSTERED INDEX [IX_Medicines_Barcode] ON [dbo].[Medicines]([Barcode] ASC);
END
GO

-- 5. Batches Table (FIFO / FEFO & Strict Cost Price Engine)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Batches]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Batches](
        [BatchID] [VARCHAR](50) NOT NULL,
        [MedicineID] [VARCHAR](50) NOT NULL,
        [BatchNumber] [VARCHAR](50) NOT NULL,
        [ExpiryDate] [DATE] NOT NULL,
        [PurchasePrice] [DECIMAL](18, 2) NOT NULL,
        [TradePrice] [DECIMAL](18, 2) NOT NULL,
        [TradePriceVat] [DECIMAL](5, 2) NOT NULL DEFAULT (0.00),
        [CostPrice] [DECIMAL](18, 2) NOT NULL,
        [SellingPrice] [DECIMAL](18, 2) NOT NULL,
        [CurrentStock] [INT] NOT NULL DEFAULT (0),
        CONSTRAINT [PK_Batches] PRIMARY KEY CLUSTERED ([BatchID] ASC),
        CONSTRAINT [FK_Batches_Medicines] FOREIGN KEY([MedicineID]) REFERENCES [dbo].[Medicines] ([MedicineID]),
        CONSTRAINT [CK_Batches_Stock] CHECK ([CurrentStock] >= 0)
    );
    CREATE NONCLUSTERED INDEX [IX_Batches_FEFO] ON [dbo].[Batches]([MedicineID] ASC, [ExpiryDate] ASC, [CurrentStock] DESC);
END
GO

-- 6. Purchases & PurchaseItems
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Purchases]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Purchases](
        [PurchaseID] [VARCHAR](50) NOT NULL,
        [SupplierID] [VARCHAR](50) NOT NULL,
        [InvoiceNumber] [NVARCHAR](50) NOT NULL,
        [TotalTP] [DECIMAL](18, 2) NOT NULL,
        [TotalVAT] [DECIMAL](18, 2) NOT NULL,
        [TotalDiscount] [DECIMAL](18, 2) NOT NULL,
        [NetCostPrice] [DECIMAL](18, 2) NOT NULL,
        [PaidAmount] [DECIMAL](18, 2) NOT NULL,
        [DueAmount] [DECIMAL](18, 2) NOT NULL,
        [VerifiedBy] [NVARCHAR](100) NULL,
        [PurchaseDate] [DATETIME] NOT NULL DEFAULT(GETDATE()),
        CONSTRAINT [PK_Purchases] PRIMARY KEY CLUSTERED ([PurchaseID] ASC),
        CONSTRAINT [FK_Purchases_Suppliers] FOREIGN KEY([SupplierID]) REFERENCES [dbo].[Suppliers] ([SupplierID])
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PurchaseItems]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[PurchaseItems](
        [PurchaseItemID] [VARCHAR](50) NOT NULL,
        [PurchaseID] [VARCHAR](50) NOT NULL,
        [MedicineID] [VARCHAR](50) NOT NULL,
        [BatchNumber] [VARCHAR](50) NOT NULL,
        [ExpiryDate] [DATE] NOT NULL,
        [Quantity] [INT] NOT NULL,
        [TP] [DECIMAL](18, 2) NOT NULL,
        [VATPercent] [DECIMAL](5, 2) NOT NULL,
        [DiscountAmount] [DECIMAL](18, 2) NOT NULL,
        [CostPrice] [DECIMAL](18, 2) NOT NULL,
        CONSTRAINT [PK_PurchaseItems] PRIMARY KEY CLUSTERED ([PurchaseItemID] ASC),
        CONSTRAINT [FK_PurchaseItems_Purchases] FOREIGN KEY([PurchaseID]) REFERENCES [dbo].[Purchases] ([PurchaseID])
    );
END
GO

-- 7. Sales & SaleItems (Fast POS Execution)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Sales]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Sales](
        [SaleID] [VARCHAR](50) NOT NULL,
        [InvoiceNumber] [VARCHAR](50) NOT NULL UNIQUE,
        [CustomerID] [VARCHAR](50) NULL,
        [SalesmanID] [VARCHAR](50) NOT NULL,
        [TotalAmount] [DECIMAL](18, 2) NOT NULL,
        [DiscountAmount] [DECIMAL](18, 2) NOT NULL,
        [FinalAmount] [DECIMAL](18, 2) NOT NULL,
        [PaidAmount] [DECIMAL](18, 2) NOT NULL,
        [DueAmount] [DECIMAL](18, 2) NOT NULL,
        [SaleDate] [DATETIME] NOT NULL DEFAULT(GETDATE()),
        CONSTRAINT [PK_Sales] PRIMARY KEY CLUSTERED ([SaleID] ASC),
        CONSTRAINT [FK_Sales_Users] FOREIGN KEY([SalesmanID]) REFERENCES [dbo].[Users] ([UserID])
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SaleItems]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SaleItems](
        [SaleItemID] [VARCHAR](50) NOT NULL,
        [SaleID] [VARCHAR](50) NOT NULL,
        [MedicineID] [VARCHAR](50) NOT NULL,
        [BatchID] [VARCHAR](50) NOT NULL,
        [Quantity] [INT] NOT NULL,
        [UnitPrice] [DECIMAL](18, 2) NOT NULL,
        [CostPrice] [DECIMAL](18, 2) NOT NULL,
        [DiscountAmount] [DECIMAL](18, 2) NOT NULL,
        [TotalPrice] [DECIMAL](18, 2) NOT NULL,
        CONSTRAINT [PK_SaleItems] PRIMARY KEY CLUSTERED ([SaleItemID] ASC),
        CONSTRAINT [FK_SaleItems_Sales] FOREIGN KEY([SaleID]) REFERENCES [dbo].[Sales] ([SaleID]),
        CONSTRAINT [FK_SaleItems_Batches] FOREIGN KEY([BatchID]) REFERENCES [dbo].[Batches] ([BatchID])
    );
END
GO

-- 8. ExpireVault Table (Transfer & Supplier Reconciliation)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ExpireVault]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ExpireVault](
        [VaultID] [VARCHAR](50) NOT NULL,
        [MedicineID] [VARCHAR](50) NOT NULL,
        [BatchID] [VARCHAR](50) NOT NULL,
        [Quantity] [INT] NOT NULL,
        [TransferDate] [DATETIME] NOT NULL DEFAULT(GETDATE()),
        [ReturnStatus] [VARCHAR](30) NOT NULL DEFAULT ('InVault'),
        [ReturnDate] [DATETIME] NULL,
        [Notes] [NVARCHAR](255) NULL,
        CONSTRAINT [PK_ExpireVault] PRIMARY KEY CLUSTERED ([VaultID] ASC),
        CONSTRAINT [CK_ExpireVault_Status] CHECK ([ReturnStatus] IN ('InVault', 'ReturnedToSupplier', 'CashReceived', 'GoodMedicineReturned'))
    );
END
GO

-- 9. DueCollections Table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DueCollections]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[DueCollections](
        [CollectionID] [VARCHAR](50) NOT NULL,
        [EntityType] [VARCHAR](20) NOT NULL,
        [EntityID] [VARCHAR](50) NOT NULL,
        [Amount] [DECIMAL](18, 2) NOT NULL,
        [PaymentMethod] [VARCHAR](50) NOT NULL,
        [CollectionDate] [DATETIME] NOT NULL DEFAULT(GETDATE()),
        [ReceivedBy] [VARCHAR](50) NOT NULL,
        CONSTRAINT [PK_DueCollections] PRIMARY KEY CLUSTERED ([CollectionID] ASC),
        CONSTRAINT [CK_DueCollections_Type] CHECK ([EntityType] IN ('Customer', 'Supplier'))
    );
END
GO
-- 10. WarehouseStores Table (Regional Store Governance & ON/OFF Control)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WarehouseStores]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[WarehouseStores](
        [StoreID] [VARCHAR](50) NOT NULL,
        [StoreNumber] [INT] NOT NULL,
        [StoreCode] [VARCHAR](30) NOT NULL UNIQUE,
        [Name] [NVARCHAR](120) NOT NULL,
        [Region] [NVARCHAR](120) NOT NULL,
        [Location] [NVARCHAR](255) NOT NULL,
        [ManagerName] [NVARCHAR](120) NOT NULL,
        [ContactPhone] [VARCHAR](30) NULL,
        [IsActive] [BIT] NOT NULL DEFAULT (1),
        [LastToggledAt] [DATETIME] NOT NULL DEFAULT(GETDATE()),
        [LastToggledBy] [NVARCHAR](100) NOT NULL,
        CONSTRAINT [PK_WarehouseStores] PRIMARY KEY CLUSTERED ([StoreID] ASC)
    );
END
GO

-- 11. StoreStocks Table (Regional Warehouse Batch Ledger)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[StoreStocks]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[StoreStocks](
        [StoreStockID] [VARCHAR](50) NOT NULL,
        [StoreID] [VARCHAR](50) NOT NULL,
        [MedicineID] [VARCHAR](50) NOT NULL,
        [BatchNumber] [VARCHAR](50) NOT NULL,
        [ExpiryDate] [DATE] NOT NULL,
        [CurrentStock] [INT] NOT NULL DEFAULT (0),
        [TradePrice] [DECIMAL](18, 2) NOT NULL,
        [VATPercent] [DECIMAL](5, 2) NOT NULL DEFAULT (0.00),
        [DiscountPercent] [DECIMAL](5, 2) NOT NULL DEFAULT (0.00),
        [CostPrice] [DECIMAL](18, 2) NOT NULL,
        [SellingPrice] [DECIMAL](18, 2) NOT NULL,
        [RackLocation] [VARCHAR](50) NULL,
        [UpdatedAt] [DATETIME] NOT NULL DEFAULT(GETDATE()),
        CONSTRAINT [PK_StoreStocks] PRIMARY KEY CLUSTERED ([StoreStockID] ASC),
        CONSTRAINT [FK_StoreStocks_Stores] FOREIGN KEY([StoreID]) REFERENCES [dbo].[WarehouseStores] ([StoreID]),
        CONSTRAINT [FK_StoreStocks_Medicines] FOREIGN KEY([MedicineID]) REFERENCES [dbo].[Medicines] ([MedicineID]),
        CONSTRAINT [CK_StoreStocks_Qty] CHECK ([CurrentStock] >= 0)
    );
END
GO

-- 12. StoreTransactions Table (Auto-Generated Vouchers with Sender & Receiver)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[StoreTransactions]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[StoreTransactions](
        [TransactionID] [VARCHAR](50) NOT NULL,
        [InvoiceNumber] [VARCHAR](50) NOT NULL UNIQUE,
        [StoreID] [VARCHAR](50) NOT NULL,
        [TargetStoreID] [VARCHAR](50) NULL,
        [Type] [VARCHAR](30) NOT NULL,
        [SupplierID] [VARCHAR](50) NULL,
        [SenderName] [NVARCHAR](120) NOT NULL,
        [ReceiverName] [NVARCHAR](120) NOT NULL,
        [ReferenceNote] [NVARCHAR](255) NULL,
        [TotalQuantity] [INT] NOT NULL,
        [TotalTP] [DECIMAL](18, 2) NOT NULL,
        [TotalVAT] [DECIMAL](18, 2) NOT NULL,
        [TotalDiscount] [DECIMAL](18, 2) NOT NULL,
        [NetValuation] [DECIMAL](18, 2) NOT NULL,
        [SyncStatus] [VARCHAR](30) NOT NULL DEFAULT ('Synced'),
        [CreatedBy] [NVARCHAR](100) NOT NULL,
        [CreatedByRole] [VARCHAR](20) NOT NULL,
        [TransactionDate] [DATETIME] NOT NULL DEFAULT(GETDATE()),
        CONSTRAINT [PK_StoreTransactions] PRIMARY KEY CLUSTERED ([TransactionID] ASC),
        CONSTRAINT [FK_StoreTransactions_Stores] FOREIGN KEY([StoreID]) REFERENCES [dbo].[WarehouseStores] ([StoreID]),
        CONSTRAINT [CK_StoreTransactions_Type] CHECK ([Type] IN ('STORE_IN', 'STORE_OUT', 'STORE_INTERCHANGE'))
    );
END
GO

-- 13. StoreToggleAuditLogs Table (Compliance & Accountability Audit Trail)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[StoreToggleAuditLogs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[StoreToggleAuditLogs](
        [AuditID] [VARCHAR](50) NOT NULL,
        [StoreID] [VARCHAR](50) NOT NULL,
        [StoreCode] [VARCHAR](30) NOT NULL,
        [StoreName] [NVARCHAR](120) NOT NULL,
        [Region] [NVARCHAR](120) NOT NULL,
        [PreviousState] [BIT] NOT NULL,
        [NewState] [BIT] NOT NULL,
        [Reason] [NVARCHAR](255) NOT NULL,
        [ToggledByUserID] [VARCHAR](50) NOT NULL,
        [ToggledByName] [NVARCHAR](100) NOT NULL,
        [ToggledByRole] [VARCHAR](20) NOT NULL,
        [ActiveUnitsSnapshot] [INT] NOT NULL,
        [ValuationSnapshot] [DECIMAL](18, 2) NOT NULL,
        [SyncRefCode] [VARCHAR](60) NOT NULL,
        [Timestamp] [DATETIME] NOT NULL DEFAULT(GETDATE()),
        CONSTRAINT [PK_StoreToggleAuditLogs] PRIMARY KEY CLUSTERED ([AuditID] ASC)
    );
END
GO
`;

/**
 * Generates a full downloadable .bak SQL dump containing database snapshot
 */
export function generateSqlBackupContent(state: any): string {
  const dateFormatted = new Date().toLocaleString();

  let sql = `-- ============================================================================
-- PHARMACORE DATABASE BACKUP FILE (.BAK SIMULATION)
-- CREATED: ${dateFormatted}
-- SERVER: Microsoft SQL Server 2008 R2 (10.50.1600.1)
-- COMPATIBILITY LEVEL: 100
-- ============================================================================

${SQL_SERVER_2008_SCHEMA}

-- ============================================================================
-- SNAPSHOT DATA INSERTS
-- ============================================================================
BEGIN TRANSACTION;
`;

  // Suppliers
  if (state.suppliers && state.suppliers.length > 0) {
    sql += `\n-- Insert Suppliers\n`;
    for (const s of state.suppliers) {
      sql += `INSERT INTO [dbo].[Suppliers] ([SupplierID], [Name], [Phone], [Address], [DefaultDiscountPercent], [TotalDue]) VALUES ('${s.SupplierID}', N'${s.Name.replace(/'/g, "''")}', '${s.Phone}', N'${s.Address.replace(/'/g, "''")}', ${s.DefaultDiscountPercent}, ${s.TotalDue});\n`;
    }
  }

  // Customers
  if (state.customers && state.customers.length > 0) {
    sql += `\n-- Insert Customers\n`;
    for (const c of state.customers) {
      sql += `INSERT INTO [dbo].[Customers] ([CustomerID], [Name], [Phone], [Address], [TotalDue], [LoyaltyPoints]) VALUES ('${c.CustomerID}', N'${c.Name.replace(/'/g, "''")}', '${c.Phone}', N'${c.Address.replace(/'/g, "''")}', ${c.TotalDue}, ${c.LoyaltyPoints});\n`;
    }
  }

  // Medicines
  if (state.medicines && state.medicines.length > 0) {
    sql += `\n-- Insert Medicines\n`;
    for (const m of state.medicines) {
      sql += `INSERT INTO [dbo].[Medicines] ([MedicineID], [TradeName], [GenericName], [RackNo], [Unit], [DefaultDiscountPercent], [ReorderLevel], [Status], [SupplierID], [Barcode]) VALUES ('${m.MedicineID}', N'${m.TradeName.replace(/'/g, "''")}', N'${m.GenericName.replace(/'/g, "''")}', '${m.RackNo}', '${m.Unit}', ${m.DefaultDiscountPercent || 'NULL'}, ${m.ReorderLevel}, '${m.Status}', '${m.SupplierID}', '${m.Barcode}');\n`;
    }
  }

  // Batches
  if (state.batches && state.batches.length > 0) {
    sql += `\n-- Insert Batches\n`;
    for (const b of state.batches) {
      sql += `INSERT INTO [dbo].[Batches] ([BatchID], [MedicineID], [BatchNumber], [ExpiryDate], [PurchasePrice], [TradePrice], [TradePriceVat], [CostPrice], [SellingPrice], [CurrentStock]) VALUES ('${b.BatchID}', '${b.MedicineID}', '${b.BatchNumber}', '${b.ExpiryDate}', ${b.PurchasePrice}, ${b.TradePrice}, ${b.TradePriceVat}, ${b.CostPrice}, ${b.SellingPrice}, ${b.CurrentStock});\n`;
    }
  }

  // Regional Warehouse Stores
  if (state.stores && state.stores.length > 0) {
    sql += `\n-- Insert WarehouseStores\n`;
    for (const st of state.stores) {
      sql += `INSERT INTO [dbo].[WarehouseStores] ([StoreID], [StoreNumber], [StoreCode], [Name], [Region], [Location], [ManagerName], [ContactPhone], [IsActive], [LastToggledAt], [LastToggledBy]) VALUES ('${st.StoreID}', ${st.StoreNumber}, '${st.StoreCode}', N'${st.Name.replace(/'/g, "''")}', N'${st.Region.replace(/'/g, "''")}', N'${st.Location.replace(/'/g, "''")}', N'${st.ManagerName.replace(/'/g, "''")}', '${st.ContactPhone}', ${st.IsActive ? 1 : 0}, '${st.LastToggledAt}', N'${st.LastToggledBy.replace(/'/g, "''")}');\n`;
    }
  }

  // Regional Store Stocks
  if (state.storeStocks && state.storeStocks.length > 0) {
    sql += `\n-- Insert StoreStocks\n`;
    for (const ss of state.storeStocks) {
      sql += `INSERT INTO [dbo].[StoreStocks] ([StoreStockID], [StoreID], [MedicineID], [BatchNumber], [ExpiryDate], [CurrentStock], [TradePrice], [VATPercent], [DiscountPercent], [CostPrice], [SellingPrice], [RackLocation], [UpdatedAt]) VALUES ('${ss.StoreStockID}', '${ss.StoreID}', '${ss.MedicineID}', '${ss.BatchNumber}', '${ss.ExpiryDate}', ${ss.CurrentStock}, ${ss.TradePrice}, ${ss.VATPercent}, ${ss.DiscountPercent}, ${ss.CostPrice}, ${ss.SellingPrice}, '${ss.RackLocation || ''}', '${ss.UpdatedAt}');\n`;
    }
  }

  // Store Toggle Audit Logs
  if (state.storeToggleLogs && state.storeToggleLogs.length > 0) {
    sql += `\n-- Insert StoreToggleAuditLogs\n`;
    for (const log of state.storeToggleLogs) {
      sql += `INSERT INTO [dbo].[StoreToggleAuditLogs] ([AuditID], [StoreID], [StoreCode], [StoreName], [Region], [PreviousState], [NewState], [Reason], [ToggledByUserID], [ToggledByName], [ToggledByRole], [ActiveUnitsSnapshot], [ValuationSnapshot], [SyncRefCode], [Timestamp]) VALUES ('${log.AuditID}', '${log.StoreID}', '${log.StoreCode}', N'${log.StoreName.replace(/'/g, "''")}', N'${log.Region.replace(/'/g, "''")}', ${log.PreviousState ? 1 : 0}, ${log.NewState ? 1 : 0}, N'${log.Reason.replace(/'/g, "''")}', '${log.ToggledByUserID}', N'${log.ToggledByName.replace(/'/g, "''")}', '${log.ToggledByRole}', ${log.ActiveUnitsSnapshot}, ${log.ValuationSnapshot}, '${log.SyncRefCode}', '${log.Timestamp}');\n`;
    }
  }

  sql += `\nCOMMIT TRANSACTION;\nGO\n-- BACKUP COMPLETED SUCCESSFULLY.`;
  return sql;
}
