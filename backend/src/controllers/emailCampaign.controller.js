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

module.exports = {
    createCampaign,
}