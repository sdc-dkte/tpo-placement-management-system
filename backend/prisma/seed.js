require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

const departments = [
    { name: "Computer Science and Engineering", code: "CSE" },
    { name: "Information Technology", code: "IT" },
    { name: "Electronics and Telecommunication", code: "ENTC" },
    { name: "Mechanical Engineering", code: "MECH" },
    { name: "Civil Engineering", code: "CIVIL" },
];

async function main() {
    // 1. Seed Departments
    for (const dept of departments) {
        await prisma.department.upsert({
            where: { code: dept.code },
            update: {},
            create: dept,
        });
    }
    console.log("Departments seeded successfully.");

    const cseDept = await prisma.department.findUnique({
        where: { code: "CSE" },
    });

    // 2. Seed TPO Account
    const tpoName = process.env.TPO_NAME || "TPO Administrator";
    const tpoEmail = process.env.TPO_EMAIL || "tpo@dkte.ac.in";
    const tpoPassword = process.env.TPO_PASSWORD || "Admin@1234";

    const existingTpo = await prisma.user.findUnique({
        where: { email: tpoEmail.toLowerCase() },
    });

    if (!existingTpo) {
        const passwordHash = await bcrypt.hash(tpoPassword, 12);
        await prisma.user.create({
            data: {
                name: tpoName,
                email: tpoEmail.toLowerCase(),
                passwordHash,
                role: "TPO",
            },
        });
        console.log(`Initial TPO account created: ${tpoEmail}`);
    } else {
        console.log("TPO account already exists. No changes made.");
    }

    // 3. Seed Demo Student Account
    const studentEmail = "student@dkte.ac.in";
    const studentPRN = "2023CSE001";
    const studentPassword = studentPRN; // PRN as default password
    const studentPasswordHash = await bcrypt.hash(studentPassword, 12);

    const existingStudent = await prisma.user.findUnique({
        where: { email: studentEmail },
    });

    if (!existingStudent && cseDept) {
        const studentUser = await prisma.user.create({
            data: {
                name: "Rahul Patil",
                email: studentEmail,
                passwordHash: studentPasswordHash,
                role: "STUDENT",
            },
        });

        await prisma.student.create({
            data: {
                userId: studentUser.id,
                PRN: studentPRN,
                departmentId: cseDept.id,
                graduationYear: 2026,
                academicPathway: "HSC",
                CGPA: 8.85,
                tenthPercentage: 88.5,
                twelfthPercentage: 86.0,
                activeBacklogs: 0,
            },
        });
        console.log(`Demo Student account created: ${studentEmail} (Password: ${studentPassword})`);
    } else if (existingStudent) {
        await prisma.user.update({
            where: { id: existingStudent.id },
            data: { passwordHash: studentPasswordHash },
        });
        console.log(`Demo Student password updated to PRN: ${studentPassword}`);
    }
}

main()
    .catch((error) => {
        console.error("Seed failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
