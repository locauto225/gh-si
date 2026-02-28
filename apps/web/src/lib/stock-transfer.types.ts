// apps/web/src/lib/stock-transfer.types.ts

export type ISODateString = string;

export type WarehouseKind = "DEPOT" | "STORE";

export type Warehouse = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
  kind: WarehouseKind;
  // utile si l'API l'expose (masquer TRANSIT côté UX)
  isSystem?: boolean;
};

export type StockTransferStatus =
  | "DRAFT"
  | "SHIPPED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED"
  | "DISPUTED";

export type StockTransferPurpose =
  | "STORE_REPLENISH"
  | "REBALANCE"
  | "INTERNAL_DELIVERY"
  | "OTHER";

export type ProductLite = {
  id: string;
  sku: string;
  name: string;
  unit?: string | null;
};

export type StockTransferLine = {
  id: string;
  productId: string;
  qty: number;
  qtyReceived: number;
  note?: string | null;
  product?: ProductLite | null;
};

export type StockTransfer = {
  id: string;
  status: StockTransferStatus;
  purpose?: StockTransferPurpose; // l'API peut ne pas encore l'exposer partout
  journeyId?: string | null;

  note?: string | null;

  number?: string | null;

  shippedAt?: ISODateString | null;
  receivedAt?: ISODateString | null;

  createdAt: ISODateString;
  updatedAt?: ISODateString;

  fromWarehouse: Warehouse;
  toWarehouse: Warehouse;

  // lien BL éventuel (si tu ajoutes au contrat)
  deliveryId?: string | null;

  lines: StockTransferLine[];
};

export type TransferJourney = {
  journeyId: string;
  // dans A+ on a souvent 2 transferts : DEPOT->TRANSIT et TRANSIT->STORE
  transfers: StockTransfer[];
  createdAt?: ISODateString;
};