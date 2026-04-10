export const menuItems = [
  {
    id: 19286,
    name: "Lamb Köfte",
    itemNumber: "SUB68291",
    price: 12.99,
    lastModified: "2025-07-21T10:00:00Z",
    tags: ["Main Dish", "Protein"],
    isRecipeActive: true,
    chefID: "chef123",
    chefParsleyId: 456,
    isSubrecipe: false,
    type: "recipe",
  },
  {
    id: 19287,
    name: "Chicken Curry",
    itemNumber: "R-9001",
    price: 14.5,
    lastModified: "2025-07-20T08:30:00Z",
    tags: ["Main Dish", "Spicy"],
    isRecipeActive: true,
    isSubrecipe: false,
    type: "recipe",
  },
  {
    id: 19288,
    name: "Almond Paste",
    itemNumber: "SUB70100",
    lastModified: "2025-06-15T12:00:00Z",
    tags: ["Main Dish"],
    isSubrecipe: true,
    type: "subrecipe",
  },
  {
    id: 19299,
    name: "Cornmeal Blueberry Griddlecakes",
    itemNumber: "R-4420",
    price: 9.75,
    lastModified: "2025-07-18T14:00:00Z",
    tags: ["Starch", "Sides"],
    isRecipeActive: true,
    isSubrecipe: false,
    type: "recipe",
  },
  {
    id: 19264,
    name: "Apricots",
    itemNumber: "ING-300",
    lastModified: "2025-05-01T09:00:00Z",
    tags: ["Fruit"],
    isSubrecipe: false,
    type: "ingredient",
  },
];

export const menuItemDetails: Record<number, unknown> = {
  19286: {
    id: 19286,
    name: "Lamb Köfte",
    itemNumber: "SUB68291",
    subtitle: "Turkish-style spiced lamb patties",
    description:
      "Hand-formed lamb patties seasoned with cumin, paprika, and fresh herbs, grilled to perfection. Served with warm pita and tzatziki sauce.",
    photo: "https://example.com/photos/lamb-kofte.jpg",
    isSubrecipe: false,
    type: "recipe",
    supportedUnits: ["portions"],
    cost: 4.25,
    price: 12.99,
    lastModified: "2025-07-21T10:00:00Z",
    shelfLife: 3,
    tags: ["Main Dish", "Protein"],
    chefID: "chef123",
    chefParsleyId: 456,
    nutritionalInfo: {
      servingSize: { amount: 4, uom: "portions" },
      incomplete: false,
      isPackaged: false,
      nutrients: {
        "208": { value: 683, unit: "kcal", name: "Energy" },
        "203": { value: 43.84, unit: "g", name: "Protein" },
        "204": { value: 48.46, unit: "g", name: "Total Fat" },
        "205": { value: 18.73, unit: "g", name: "Carbohydrate" },
        "291": { value: 3.2, unit: "g", name: "Fiber" },
        "307": { value: 908.87, unit: "mg", name: "Sodium" },
        "601": { value: 165.56, unit: "mg", name: "Cholesterol" },
      },
      allergens: { sulphurDioxideSulphites: true, wheat: true },
      characteristics: { meat: true, pork: false, corn: false, poultry: false },
      ingredients:
        "Lamb Ground 15%, Bread Whole Wheat, Onions Brown, Eggs Large, Parsley, Garlic Fresh, Salt, Paprika, Cumin, Black Pepper, Sugar White",
      ingredientList: [
        { id: 1001, name: "Lamb Ground 15%" },
        { id: 1002, name: "Bread Whole Wheat" },
        { id: 1003, name: "Onions Brown" },
        { id: 1004, name: "Eggs Large" },
        { id: 1005, name: "Parsley" },
        { id: 1006, name: "Garlic Fresh" },
      ],
    },
  },
  19287: {
    id: 19287,
    name: "Chicken Curry",
    itemNumber: "R-9001",
    subtitle: "Aromatic coconut curry",
    description:
      "Tender chicken thighs simmered in a rich coconut curry sauce with ginger, turmeric, and fresh cilantro. Served over basmati rice.",
    isSubrecipe: false,
    type: "recipe",
    supportedUnits: ["portions", "kg"],
    cost: 3.8,
    price: 14.5,
    lastModified: "2025-07-20T08:30:00Z",
    shelfLife: 4,
    tags: ["Main Dish", "Spicy"],
    nutritionalInfo: {
      servingSize: { amount: 1, uom: "portions" },
      incomplete: false,
      isPackaged: false,
      nutrients: {
        "208": { value: 520, unit: "kcal", name: "Energy" },
        "203": { value: 35, unit: "g", name: "Protein" },
        "204": { value: 28, unit: "g", name: "Total Fat" },
        "205": { value: 32, unit: "g", name: "Carbohydrate" },
      },
      allergens: {},
      characteristics: { meat: true, pork: false, corn: false, poultry: true },
      ingredients: "Chicken Thigh, Coconut Milk, Onions, Ginger, Garlic, Turmeric, Cumin, Salt",
    },
  },
};

export const menus = [
  { id: 15642, name: "Breakfast", lastModified: "2025-07-22T16:57:36.263Z" },
  { id: 15700, name: "Lunch", lastModified: "2025-07-21T10:00:00Z" },
  { id: 15800, name: "Dinner", lastModified: "2025-07-20T14:30:00Z" },
];

export const menuDetails: Record<number, unknown> = {
  15642: {
    id: 15642,
    name: "Breakfast",
    lastModified: "2025-07-22T16:57:36.263Z",
    stations: [
      {
        name: "Grill",
        sections: [
          {
            name: "Entrees From The Grill",
            menu_items: [{ id: 19286, name: "Lamb Köfte", tags: ["Main Dish", "Protein"] }],
          },
        ],
      },
    ],
    sections: [
      {
        name: "First",
        menu_items: [
          { id: 19299, name: "Cornmeal Blueberry Griddlecakes", tags: ["Starch", "Sides"] },
          { id: 19288, name: "Almond Paste", tags: ["Main Dish"] },
        ],
      },
      {
        name: "Second",
        menu_items: [{ id: 19264, name: "Apricots", tags: ["Fruit"] }],
      },
    ],
  },
  15700: {
    id: 15700,
    name: "Lunch",
    lastModified: "2025-07-21T10:00:00Z",
    stations: [],
    sections: [
      {
        name: "Mains",
        menu_items: [
          { id: 19287, name: "Chicken Curry", tags: ["Main Dish", "Spicy"] },
          { id: 19286, name: "Lamb Köfte", tags: ["Main Dish", "Protein"] },
        ],
      },
    ],
  },
};

export const recipeDetails: Record<number, unknown> = {
  19286: {
    id: 19286,
    name: "Lamb Köfte",
    itemNumber: "SUB68291",
    subtitle: "Turkish-style spiced lamb patties",
    description:
      "Hand-formed lamb patties seasoned with cumin, paprika, and fresh herbs.",
    chefID: "chef123",
    chefParsleyId: 456,
    prepTime: 45,
    internalTemp: 160,
    shelfLife: 3,
    portionNumber: 4,
    portionName: "patties",
    portionSize: 120,
    portionSizeUnit: "gr",
    batchSize: 1,
    batched: false,
    recipeTags: ["Main Dish", "Protein"],
    cost: 4.25,
    price: 12.99,
    createdAt: "2024-01-15T10:00:00Z",
    lastModified: "2025-07-21T10:00:00Z",
    nutritionalInfo: (menuItemDetails[19286] as { nutritionalInfo: unknown }).nutritionalInfo,
    steps: [
      {
        description: "Combine lamb, breadcrumbs, eggs, and spices in a large bowl. Mix until just combined.",
        ingredients: [
          {
            quantity: { amount: 500, uom: "gr" },
            ingredient: { id: 1001, name: "Lamb Ground 15%", isIngredient: true, isEdible: true },
          },
          {
            quantity: { amount: 80, uom: "gr" },
            ingredient: { id: 1002, name: "Bread Whole Wheat", isIngredient: true, isEdible: true },
          },
          {
            quantity: { amount: 2, uom: "ea" },
            ingredient: { id: 1004, name: "Eggs Large", isIngredient: true, isEdible: true },
          },
          {
            quantity: { amount: 5, uom: "gr" },
            ingredient: { id: 1010, name: "Paprika", isIngredient: true, isEdible: true },
          },
          {
            quantity: { amount: 5, uom: "gr" },
            ingredient: { id: 1011, name: "Cumin", isIngredient: true, isEdible: true },
          },
        ],
      },
      {
        description: "Form into patties and grill over medium-high heat for 4-5 minutes per side.",
        ingredients: [],
      },
    ],
    usedInRecipes: [],
  },
};

export const ingredients = [
  { id: 1001, name: "Lamb Ground 15%", isSubRecipe: false, usedByRecipe: true, isEdible: true },
  { id: 1002, name: "Bread Whole Wheat", isSubRecipe: false, usedByRecipe: true, isEdible: true },
  { id: 1003, name: "Onions Brown", isSubRecipe: false, usedByRecipe: true, isEdible: true },
  { id: 1004, name: "Eggs Large", isSubRecipe: false, usedByRecipe: true, isEdible: true },
  { id: 1005, name: "Parsley", isSubRecipe: false, usedByRecipe: true, isEdible: true },
  { id: 1006, name: "Garlic Fresh", isSubRecipe: false, usedByRecipe: true, isEdible: true },
  { id: 1007, name: "Coconut Milk", isSubRecipe: false, usedByRecipe: true, isEdible: true },
  { id: 1008, name: "Chicken Thigh", isSubRecipe: false, usedByRecipe: true, isEdible: true },
  { id: 604, parentId: undefined, name: "Acorn Squash", isSubRecipe: false, usedByRecipe: true, labelName: "Green Acorn Squash", isEdible: true },
];

export const ingredientDetails: Record<number, unknown> = {
  1001: {
    id: 1001,
    name: "Lamb Ground 15%",
    isSubRecipe: false,
    usedByRecipe: true,
    isEdible: true,
    supportedUnits: ["kg", "lb", "gr", "oz"],
    conversions: [
      { input: { amount: 1, uom: "lb", measure: "weight" }, output: { amount: 0.4536, uom: "kg", measure: "weight" } },
    ],
    supplyOptions: {
      useForCosting: {
        supplier: "Valley Meats",
        sku: "VM-LMB-15",
        supplierIngredientName: "Ground Lamb 15% Fat",
        packaged: true,
        packageSize: 2.5,
        measure: "weight",
        unit: "kg",
        costPer: "package",
        cost: 18.5,
      },
      others: [],
    },
    preparations: [{ name: "Raw", yield: 100 }, { name: "Cooked", yield: 75 }],
  },
};

export const events = [
  {
    id: 101,
    name: "Monday Brunch",
    type: "standard",
    date: "2025-07-21",
    startTime: "09:00",
    endTime: "14:00",
    menu: 15642,
    description: "Weekly Monday brunch service",
    isRepeatingEvent: true,
    private: false,
  },
  {
    id: 102,
    name: "Catering - Johnson Wedding",
    type: "standard",
    date: "2025-07-25",
    startTime: "17:00",
    endTime: "23:00",
    menu: 15800,
    description: "150 guests, outdoor reception",
    isRepeatingEvent: false,
    private: true,
  },
  {
    id: 103,
    name: "Cafe Hot Bar",
    type: "cafe-hot-bar",
    date: "2025-07-22",
    startTime: "11:00",
    endTime: "15:00",
    menu: 15700,
    isRepeatingEvent: true,
    private: false,
  },
];

export const eventDetails: Record<number, unknown> = {
  101: {
    id: 101,
    name: "Monday Brunch",
    type: "standard",
    date: "2025-07-21",
    startTime: "09:00",
    endTime: "14:00",
    menu: 15642,
    description: "Weekly Monday brunch service",
    lineItems: [
      { menuItem: 19299, amount: 40, uom: "portions", station: "Grill" },
      { menuItem: 19286, amount: 25, uom: "portions", station: "Grill" },
      { menuItem: 19264, amount: 10, uom: "kg" },
    ],
  },
};

export const servingStations = [
  { id: 1, name: "Grill Station" },
  { id: 2, name: "Salad Bar" },
  { id: 3, name: "Dessert Counter" },
  { id: 4, name: "Beverage Station" },
];

export const chefTags = [
  { id: 100, name: "Culinary" },
  { id: 101, name: "Pastry" },
  { id: 102, name: "Garde Manger" },
];

export const chefUsers = [
  {
    id: 192,
    email: "chef.marco@example.com",
    joinedAt: "2024-01-15T10:00:00Z",
    isActive: true,
    permissionLevel: "independent-chef",
    chefId: 100,
    chefName: "Culinary",
  },
  {
    id: 193,
    email: "pastry.anna@example.com",
    joinedAt: "2024-03-20T14:30:00Z",
    isActive: true,
    permissionLevel: "chef-read-only",
    chefId: 101,
    chefName: "Pastry",
  },
];
