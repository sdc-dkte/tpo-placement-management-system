const prisma = require("../prismaClient")

const createCampaign = async (req, res) => {
    try {
        const { driveId, subject, body } = req.body

        //validate required fields
        if(driveId === undefined || subject === undefined || body === undefined){
            return res.status(400).json({
                success: false,
                message: "driveId, subject, and body are required.",
            })
        }

        //validate driveId
        const parsedDriveId = Number(driveId)

        if(!Number.isInteger(parsedDriveId) || parsedDriveId <= 0){
            return res.status(400).json({
                success: false,
                message: "driveId must be a positive integer.",
            })
        }

        //validate subject and body
        if(typeof subject !== "string" || !subject.trim()){
            return res.status(422).json({
                success: false,
                message: "subject is compulsory",
            })
        }
        if(typeof body !== "string" || !body.trim()){
            return res.status(422).json({
                success: false,
                message: "email body is compulsory",
            })
        }

        //verify that the drive exists
        const drive = await prisma.placementDrive.findUnique({
            where: {
                id: parsedDriveId
            },
            select:{
                id: true
            },
        })

        if(!drive){
            return res.status(404).json({
                success: false,
                message: "placement drive not found.",
            })
        }

        //create a draft campaign
        const campaign = await prisma.emailCampaign.create({
            data: {
                driveId: parsedDriveId,
                createdByUserId: req.user.id,
                subject: subject.trim(),
                body: body.trim(),
                status: "DRAFT",
            },
            select: {
                id: true,
                driveId: true,
                subject: true,
                body: true,
                status: true,
                createdAt: true,
            },
        })

        return res.status(201).json({
            success: true,
            data: campaign,
        })

    }
    catch(error){
        // console.error("Create email campaign error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create email campaign.",
        })
    }
}

const getAllCampaigns = async (req, res) => {
    try {
        const page = Number.parseInt(req.query.page, 10) || 1
        const limit = Number.parseInt(req.query.limit, 10) || 20
        const { driveId, status } = req.query

        //validate pagination
        if(!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100){
            return res.status(400).json({
                success: false,
                message: "page must be positive and limit must be between 1 and 100",
            })
        }

        //build filters
        const where = {};

        if(driveId !== undefined){
            const parsedDriveId = Number(driveId);
            if(!Number.isInteger(parsedDriveId) || parsedDriveId <= 0){
                return res.status(400).json({
                    success: false,
                    message: "driveId must be a positive integer",
                })
            }

            where.driveId = parsedDriveId;
        }
        if(status !== undefined){
            const allowedStatuses = [
                "DRAFT",
                "QUEUED",
                "SENDING",
                "SENT",
                "FAILED",
                "CANCELLED",
            ]
            if(!allowedStatuses.includes(status)){
                return res.status(400).json({
                    success: false,
                    message: "invalid campaign status",
                })
            }

            where.status = status;
        }

        const skip = (page - 1) * limit;

        //fetch campaigns and total count
        const [campaigns, total] = await Promise.all([
            prisma.emailCampaign.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    recipients: {
                        select: {
                            status: true,
                        },
                    },
                },
            }),
            prisma.emailCampaign.count({ where }),
        ])

        //calculate recipient stats
        const data = campaigns.map((campaign) => {
            const recipientCount = campaign.recipients.length
            const sentCount = campaign.recipients.filter(
                (recipient) => recipient.status === "SENT"
            ).length
            const failedCount = campaign.recipients.filter(
                (recipient) => recipient.status === "FAILED"
            ).length

            const { recipients, ...campaignDetails } = campaign

            return {
                ...campaignDetails,
                recipientCount,
                sentCount,
                failedCount,
            }
        })

        return res.status(200).json({
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        })
    } 
    catch(error){
        // console.error("Get email campaigns error:", error)

        return res.status(500).json({
            success: false,
            message: "failed to retrieve email campaigns",
        })
    }
}

module.exports = {
    createCampaign,
    getAllCampaigns,
}