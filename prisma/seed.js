const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    // 1️⃣ Створюємо адміністратора
    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    const admin = await prisma.user.upsert({
        where: { email: process.env.ADMIN_EMAIL },
        update: {},
        create: {
            email: process.env.ADMIN_EMAIL,
            password: adminPassword,
            role: "ADMIN",
        },
    });

    // 2️⃣ Створюємо звичайного користувача
    const userPassword = await bcrypt.hash("user123", 10);
    const user = await prisma.user.upsert({
        where: { email: "user@example.com" },
        update: {},
        create: {
            email: "user@example.com",
            password: userPassword,
            role: "USER",
        },
    });

    // 3️⃣ Створюємо інгредієнти
    const flour = await prisma.ingredient.upsert({
        where: { name: "Борошно" },
        update: {},
        create: { name: "Борошно" },
    });
    const sugar = await prisma.ingredient.upsert({
        where: { name: "Цукор" },
        update: {},
        create: { name: "Цукор" },
    });
    const chocolate = await prisma.ingredient.upsert({
        where: { name: "Шоколад" },
        update: {},
        create: { name: "Шоколад" },
    });

    // 4️⃣ Створюємо продукт (торт)
    const cake = await prisma.product.upsert({
        where: { name: "Торт Шоколадний" },
        update: {},
        create: {
            name: "Торт Шоколадний",
            description: "Смачний шоколадний торт",
            price: 150,
        },
    });

    // 5️⃣ Створюємо рецепт (які інгредієнти у торті)
    await prisma.recipe.createMany({
        data: [
            { productId: cake.id, ingredientId: flour.id, quantity: 200 },
            { productId: cake.id, ingredientId: sugar.id, quantity: 100 },
            { productId: cake.id, ingredientId: chocolate.id, quantity: 150 },
        ],
    });

    // 6️⃣ Створюємо замовлення користувача
    const order = await prisma.order.create({
        data: {
            customerId: user.id,
            totalPrice: cake.price,
            details: {
                create: [
                    { productId: cake.id, quantity: 1 }
                ],
            },
        },
        include: { details: true },
    });

    console.log("✅ Seed виконано успішно");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });