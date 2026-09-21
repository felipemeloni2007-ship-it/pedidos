export type ServiceMode = "delivery" | "pickup" | "dine_in";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "ready"
  | "awaiting_driver"
  | "out_for_delivery"
  | "delivered"
  | "canceled";

export type PaymentMethod = "pix" | "credit_card" | "cash";

export type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  description?: string;
};

export type ModifierGroup = {
  id: string;
  name: string;
  min: number;
  max: number;
  required?: boolean;
  options: ModifierOption[];
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  imagePosition?: string;
  badge?: "Mais pedido" | "Novidade" | "Oferta";
  tags?: string[];
  available: boolean;
  modifierGroups?: ModifierGroup[];
};

export type CartItem = {
  lineId: string;
  product: Product;
  quantity: number;
  selectedOptions: Record<string, string[]>;
  note?: string;
};

export type DemoOrder = {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  status: OrderStatus;
  type: ServiceMode;
  items: Array<{
    name: string;
    quantity: number;
    modifiers: string[];
    note?: string;
  }>;
  total: number;
  payment: PaymentMethod;
  elapsed: string;
};
