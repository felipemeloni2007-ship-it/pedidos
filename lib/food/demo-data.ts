import type { DemoOrder, Product } from "@/lib/food/types";

export const demoTenant = {
  id: "a73db9c1-a166-47d7-934a-dbe2f82a27d1",
  name: "Forno 27",
  slug: "forno-27",
};

export const demoStore = {
  id: "47c91484-0c28-497a-90ed-317d40e7a2dc",
  tenantId: demoTenant.id,
  slug: "forno-27",
  name: "Forno 27 • Centro",
  address: "Rua das Palmeiras, 27 — Centro",
  phone: "(11) 99927-2727",
  deliveryFee: 6,
  minimumOrder: 25,
  deliveryMinutes: "35–50 min",
};

const sizeGroup = {
  id: "10f959fb-d35f-4ad3-8c46-fd431d52be88",
  name: "Escolha o tamanho",
  min: 1,
  max: 1,
  required: true,
  options: [
    { id: "96310df8-d85b-4cc6-b3b8-e8c98c9c2b6d", name: "Média · 6 fatias", priceDelta: 0 },
    { id: "55d05608-f5be-4a79-8a01-a2a1c4c8bfa8", name: "Grande · 8 fatias", priceDelta: 11 },
  ],
};

const crustGroup = {
  id: "c7afc4aa-846d-41a0-a9e1-21eaf6ef7f44",
  name: "Escolha a borda",
  min: 0,
  max: 1,
  options: [
    { id: "b3e39dce-05c9-44c9-a499-39c7b2fe24a8", name: "Sem borda recheada", priceDelta: 0 },
    { id: "2d32c550-f4b1-4386-b94f-a3f2f979f860", name: "Catupiry cremoso", priceDelta: 8 },
    { id: "f91b6694-f9e3-49d0-9cbd-21e62f930309", name: "Cheddar", priceDelta: 8 },
  ],
};

const extrasGroup = {
  id: "a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e",
  name: "Adicionais · até 3",
  min: 0,
  max: 3,
  options: [
    { id: "32f47d1e-6974-42dd-8dea-b14637af31cb", name: "Bacon crocante", priceDelta: 7 },
    { id: "d3c39079-590b-4814-bd2c-e6fc609ed072", name: "Muçarela extra", priceDelta: 6 },
    { id: "e30d1469-550e-4447-a84c-dd9a7d3ca4a5", name: "Cebola caramelizada", priceDelta: 4 },
  ],
};

const burgerSizeGroup = {
  id: "3c1d5d69-b1a4-43c7-bc83-d92a6edcb59d",
  name: "Escolha sua versão",
  min: 1,
  max: 1,
  required: true,
  options: [
    { id: "834f4e92-7b2c-4266-bb64-a3efb0bf3d4a", name: "Smash simples", priceDelta: 0 },
    { id: "1f98f3dd-8d57-40c4-b1bd-c9c9f4726518", name: "Smash duplo", priceDelta: 9 },
    { id: "bf76856c-aedb-4a24-a3ba-97f631942017", name: "Smash triplo", priceDelta: 17 },
  ],
};

export const demoProducts: Product[] = [
  {
    id: "f4aa27e8-954b-4bf3-bceb-9ccdf1eb6d32",
    slug: "pizza-margherita",
    name: "Pizza Margherita",
    shortDescription: "Molho italiano, fior di latte e manjericão.",
    description:
      "Nossa massa de fermentação longa recebe molho de tomate italiano, fior di latte e folhas frescas de manjericão.",
    category: "Pizzas",
    price: 48.9,
    compareAtPrice: 55.9,
    image: "/images/forno27-margherita.png",
    imagePosition: "center",
    badge: "Mais pedido",
    tags: ["Vegetariano"],
    available: true,
    modifierGroups: [sizeGroup, crustGroup, extrasGroup],
  },
  {
    id: "e7f8a13e-77cc-4196-bd03-1f89c5e3d9a1",
    slug: "pizza-calabresa",
    name: "Pizza Calabresa",
    shortDescription: "Calabresa artesanal, cebola e muçarela.",
    description:
      "Calabresa fatiada artesanalmente, cebola roxa, muçarela e nosso molho de tomate assado.",
    category: "Pizzas",
    price: 52.9,
    image: "/images/forno27-margherita.png",
    imagePosition: "54% center",
    badge: "Mais pedido",
    available: true,
    modifierGroups: [sizeGroup, crustGroup, extrasGroup],
  },
  {
    id: "bdf8147d-3fb8-4f77-bb28-2c60b2775de9",
    slug: "pizza-portuguesa",
    name: "Pizza Portuguesa",
    shortDescription: "Presunto, ovos, cebola, azeitonas e ervilha.",
    description:
      "Uma portuguesa generosa com ingredientes frescos, muçarela e azeitonas pretas.",
    category: "Pizzas",
    price: 56.9,
    image: "/images/forno27-margherita.png",
    imagePosition: "right center",
    available: true,
    modifierGroups: [sizeGroup, crustGroup, extrasGroup],
  },
  {
    id: "c9d7ca2f-33d3-49ac-b7e0-d37a1c33208e",
    slug: "smash-bacon",
    name: "Smash Bacon",
    shortDescription: "Dois smash burgers, cheddar e bacon crocante.",
    description:
      "Blend de carne prensado na chapa, cheddar cremoso, bacon crocante, maionese da casa e pão brioche.",
    category: "Hambúrgueres",
    price: 35.9,
    image: "/images/forno27-smash-bacon.png",
    badge: "Mais pedido",
    available: true,
    modifierGroups: [burgerSizeGroup, extrasGroup],
  },
  {
    id: "09f1da3b-b8e0-4d09-89bc-b4b643b93b41",
    slug: "cheddar-burger",
    name: "Cheddar Burger",
    shortDescription: "Smash, cheddar inglês e cebola caramelizada.",
    description:
      "Um clássico direto ao ponto: smash burger, cheddar inglês, cebola caramelizada e pão brioche.",
    category: "Hambúrgueres",
    price: 32.9,
    image: "/images/forno27-smash-bacon.png",
    imagePosition: "center 60%",
    badge: "Novidade",
    available: true,
    modifierGroups: [burgerSizeGroup, extrasGroup],
  },
  {
    id: "bbfd1110-7b25-464e-8c4c-8c89125f5bd5",
    slug: "batata-cheddar",
    name: "Batata com Cheddar",
    shortDescription: "Crocante por fora, cremosa por cima.",
    description:
      "Batatas fritas sequinhas, cheddar cremoso e toque de pimenta-do-reino.",
    category: "Porções",
    price: 18.9,
    image: "/images/forno27-spread.png",
    imagePosition: "72% 27%",
    badge: "Oferta",
    available: true,
    modifierGroups: [extrasGroup],
  },
  {
    id: "45fe7f2e-6eb4-48f0-ad38-b7a07aac4a6d",
    slug: "coca-cola",
    name: "Refrigerante lata",
    shortDescription: "Coca-Cola ou Guaraná, bem gelado.",
    description:
      "Escolha seu refrigerante em lata. Servido gelado e pronto para acompanhar.",
    category: "Bebidas",
    price: 8,
    image: "/images/forno27-spread.png",
    imagePosition: "79% 77%",
    available: true,
    modifierGroups: [
      {
        id: "4e7e4eb6-d627-4e92-8d14-8c4db2a34975",
        name: "Escolha o sabor",
        min: 1,
        max: 1,
        required: true,
        options: [
          { id: "16c72ad2-282b-4ce5-84a2-1fb2cc171d21", name: "Coca-Cola", priceDelta: 0 },
          { id: "e589cf71-0b6e-4482-8f4e-af2c08b64a31", name: "Guaraná", priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: "197c80e8-27cc-4e4a-b443-31e4ef7f8b75",
    slug: "brownie",
    name: "Brownie intenso",
    shortDescription: "Chocolate 70%, casquinha fina e centro macio.",
    description:
      "Brownie de chocolate 70% com textura densa, casquinha delicada e centro macio.",
    category: "Sobremesas",
    price: 12,
    image: "/images/forno27-spread.png",
    imagePosition: "23% 74%",
    available: true,
  },
];

export const demoOrders: DemoOrder[] = [
  {
    id: "e153a894-9b80-4072-a4f5-39565f4dd1ea",
    number: 1042,
    customerName: "Ana Martins",
    customerPhone: "(11) 99811-0042",
    createdAt: "19:08",
    status: "new",
    type: "delivery",
    payment: "pix",
    elapsed: "2 min",
    total: 74.8,
    items: [
      {
        name: "Pizza Margherita · Grande",
        quantity: 1,
        modifiers: ["Borda de Catupiry", "Bacon crocante"],
        note: "Pouco molho, por favor.",
      },
      { name: "Refrigerante lata · Coca-Cola", quantity: 1, modifiers: [] },
    ],
  },
  {
    id: "a29b7312-6e78-4fb9-bf55-7097e88f5c39",
    number: 1041,
    customerName: "Rafael Lima",
    customerPhone: "(11) 99722-1870",
    createdAt: "18:56",
    status: "preparing",
    type: "pickup",
    payment: "credit_card",
    elapsed: "14 min",
    total: 71.7,
    items: [
      {
        name: "Smash Bacon · Duplo",
        quantity: 2,
        modifiers: ["Cebola caramelizada"],
      },
      { name: "Batata com Cheddar", quantity: 1, modifiers: [] },
    ],
  },
  {
    id: "5bfdbfab-ca65-47b7-8c89-9cbec3b791ad",
    number: 1040,
    customerName: "Bia Torres",
    customerPhone: "(11) 99444-0130",
    createdAt: "18:47",
    status: "ready",
    type: "delivery",
    payment: "pix",
    elapsed: "23 min",
    total: 60.9,
    items: [
      {
        name: "Pizza Calabresa · Média",
        quantity: 1,
        modifiers: ["Sem borda recheada"],
      },
      { name: "Brownie intenso", quantity: 1, modifiers: [] },
    ],
  },
  {
    id: "4b7971dc-1a93-49b4-9d5c-b197ad9e4da0",
    number: 1039,
    customerName: "Matheus Costa",
    customerPhone: "(11) 99338-3211",
    createdAt: "18:31",
    status: "out_for_delivery",
    type: "delivery",
    payment: "cash",
    elapsed: "37 min",
    total: 49.9,
    items: [
      {
        name: "Cheddar Burger · Duplo",
        quantity: 1,
        modifiers: ["Bacon crocante"],
      },
      { name: "Refrigerante lata · Guaraná", quantity: 1, modifiers: [] },
    ],
  },
];

export const categories = [
  "Todos",
  "Pizzas",
  "Hambúrgueres",
  "Porções",
  "Bebidas",
  "Sobremesas",
];
