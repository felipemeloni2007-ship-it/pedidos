"use client";

import { useEffect } from "react";

import { demoProducts } from "@/lib/food/demo-data";
import type { CartItem, Product } from "@/lib/food/types";

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

type WebMcpContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

type WebMcpDocument = Document & {
  modelContext?: WebMcpContext;
};

function readObject(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("A entrada precisa ser um objeto.");
  }

  return input as Record<string, unknown>;
}

function defaultSelections(product: Product) {
  return Object.fromEntries(
    (product.modifierGroups ?? []).map((group) => [
      group.id,
      group.required && group.options[0] ? [group.options[0].id] : [],
    ]),
  );
}

export function useStorefrontWebMcp({
  addItem,
  startCheckout,
}: {
  addItem: (item: CartItem) => void;
  startCheckout: () => void;
}) {
  useEffect(() => {
    const context = (document as WebMcpDocument).modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();

    const findMenuItems: WebMcpTool = {
      name: "find_menu_items",
      title: "Buscar itens do cardápio",
      description:
        "Encontra itens disponíveis no cardápio público do Forno 27 sem alterar o pedido.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 1, maxLength: 80 } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const value = readObject(input);
        const query = typeof value.query === "string" ? value.query.trim() : "";
        if (!query) throw new Error("Informe um termo de busca.");

        const normalized = query.toLocaleLowerCase("pt-BR");
        return demoProducts
          .filter((product) =>
            [product.name, product.description, product.shortDescription, product.category]
              .join(" ")
              .toLocaleLowerCase("pt-BR")
              .includes(normalized),
          )
          .slice(0, 8)
          .map((product) => ({
            id: product.id,
            name: product.name,
            category: product.category,
            price: product.price,
            configurable: Boolean(product.modifierGroups?.length),
          }));
      },
    };

    const addMenuItem: WebMcpTool = {
      name: "add_menu_item_to_cart",
      title: "Adicionar item ao pedido",
      description:
        "Adiciona uma quantidade de um item disponível ao carrinho visível, usando as escolhas padrão do produto quando houver opções obrigatórias.",
      inputSchema: {
        type: "object",
        properties: {
          productId: { type: "string", format: "uuid" },
          quantity: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["productId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const value = readObject(input);
        const productId = typeof value.productId === "string" ? value.productId : "";
        const quantity = value.quantity === undefined ? 1 : value.quantity;
        if (
          typeof quantity !== "number" ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 10
        ) {
          throw new Error("A quantidade deve ser um número inteiro entre 1 e 10.");
        }

        const product = demoProducts.find((item) => item.id === productId);
        if (!product || !product.available) throw new Error("Produto indisponível.");

        addItem({
          lineId: crypto.randomUUID(),
          product,
          quantity,
          selectedOptions: defaultSelections(product),
        });

        return {
          productId: product.id,
          productName: product.name,
          quantity,
          status: "added_to_cart",
        };
      },
    };

    const openCheckout: WebMcpTool = {
      name: "start_food_order_checkout",
      title: "Iniciar checkout do pedido",
      description:
        "Abre o checkout visível para concluir os itens já colocados no carrinho. Não confirma nem cobra o pedido.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        readObject(input);
        startCheckout();
        return { status: "checkout_opened" };
      },
    };

    try {
      void Promise.all([
        context.registerTool(findMenuItems, { signal: lifecycle.signal }),
        context.registerTool(addMenuItem, { signal: lifecycle.signal }),
        context.registerTool(openCheckout, { signal: lifecycle.signal }),
      ]).catch(() => undefined);
    } catch {
      // WebMCP is optional; the customer storefront stays fully usable without it.
    }

    return () => lifecycle.abort();
  }, [addItem, startCheckout]);
}
