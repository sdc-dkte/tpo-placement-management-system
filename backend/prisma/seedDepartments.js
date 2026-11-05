
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const departments = [
    { name: "Computer Science and Engineering", code: "CSE" },
    { name: "Artificial Intelligence and Data Science", code: "AIDS" },
    { name: "Computer Science and Engineering (AIML)", code: "AIML" },
    { name: "Electronics and Telecommunication Engineering", code: "ENTC" },
    { name: "Electrical Engineering", code: "ELEC" },
    { name: "Mechanical Engineering", code: "MECH" },
    { name: "Civil Engineering", code: "CIVIL" },
    { name: "Textile Engineering", code: "TEXTILE" },
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
