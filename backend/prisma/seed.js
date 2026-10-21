
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
    const name = process.env.TPO_NAME;
    const email = process.env.TPO_EMAIL;
    const password = process.env.TPO_PASSWORD;

    if (!name || !email || !password) {
        throw new Error(
            "Set TPO_NAME, TPO_EMAIL, and TPO_PASSWORD in your .env file."
        );
    }

    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        console.log("TPO account already exists. No changes made.");
        return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
        data: {
            name,
            email,
            passwordHash,
            role: "TPO",
        },
    });

    console.log("Initial TPO account created successfully.");
}

main()
    .catch((error) => {
        console.error("TPO seed failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
