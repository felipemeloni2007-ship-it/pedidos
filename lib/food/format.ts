import type { CartItem, ModifierGroup, Product } from "@/lib/food/types";

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getSelectedModifiers(
  product: Product,
  selections: Record<string, string[]>,
) {
  const groups = product.modifierGroups ?? [];

  return groups.flatMap((group: ModifierGroup) =>
    group.options.filter((option) => selections[group.id]?.includes(option.id)),
  );
}

export function getLineUnitPrice(
  product: Product,
  selections: Record<string, string[]>,
) {
  return roundMoney(
    product.price +
    getSelectedModifiers(product, selections).reduce(
      (total, option) => total + option.priceDelta,
      0,
    ),
  );
}

export function getCartSubtotal(items: CartItem[]) {
  return roundMoney(items.reduce(
    (total, item) =>
      total + getLineUnitPrice(item.product, item.selectedOptions) * item.quantity,
    0,
  ));
}

export function describeSelections(
  product: Product,
  selections: Record<string, string[]>,
) {
  return getSelectedModifiers(product, selections).map((option) => option.name);
}
