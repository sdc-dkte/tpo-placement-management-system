
const prisma = require("../prismaClient");

const getHealth = async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        return res.status(200).json({
            success: true,
            message: "TPO Placement Management API is running",
            data: {
                server: "OK",
                database: "Connected",
            },
        });
    } catch (error) {
        console.error("Health check failed:", error.message);

        return res.status(503).json({
            success: false,
            message: "Health check failed",
            data: {
                server: "Running",
                database: "Disconnected",
            },
        });
    }
};

module.exports = { getHealth };
