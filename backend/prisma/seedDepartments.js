
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const departments = [
    { name: "Computer Science and Engineering", code: "CSE" },
    { name: "Information Technology", code: "IT" },
    { name: "Electronics and Telecommunication", code: "ENTC" },
    { name: "Mechanical Engineering", code: "MECH" },
    { name: "Civil Engineering", code: "CIVIL" },
];

async function main() {
    for (const dept of departments) {
        await prisma.department.upsert({
            where: { code: dept.code },
            update: {},
            create: dept,
        });
    }

    console.log("Departments seeded successfully.");
}

main()
    .catch((e) => {
        console.error("Department seed failed:", e.message);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
