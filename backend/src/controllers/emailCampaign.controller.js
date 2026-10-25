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
                "COMPLETED",
                "COMPLETED_WITH_FAILURES",
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

const getCampaignById = async (req, res) => {
    try {
        const campaignId = Number(req.params.campaignId);

        //validate campaign ID
        if(!Number.isInteger(campaignId) || campaignId <= 0){
            return res.status(400).json({
                success: false,
                message: "campaignId must be a positive integer",
            })
        }

        //fetch campaign details
        const campaign = await prisma.emailCampaign.findUnique({
            where: {
                id: campaignId,
            },
            include: {
                recipients: {
                    select: {
                        status: true,
                    },
                },
            },
        })

        //check whether campaign exists
        if(!campaign){
            return res.status(404).json({
                success: false,
                message: "email campaign not found",
            })
        }

        //calculate recipient statistics
        const recipientCount = campaign.recipients.length

        const sentCount = campaign.recipients.filter(
            (recipient) => recipient.status === "SENT"
        ).length
        const failedCount = campaign.recipients.filter(
            (recipient) => recipient.status === "FAILED"
        ).length

        const { recipients, ...campaignDetails } = campaign

        return res.status(200).json({
            success: true,
            data: {
                ...campaignDetails,
                recipientCount,
                sentCount,
                failedCount,
            },
        })
    }
    catch(error){
        // console.error("Get email campaign error:", error)

        return res.status(500).json({
            success: false,
            message: "failed to retrieve email campaign",
        })
    }
}

const updateCampaign = async (req, res) => {
    try {
        const campaignId = Number(req.params.campaignId)
        const { subject, body } = req.body

        //validate campaign ID
        if(!Number.isInteger(campaignId) || campaignId <= 0){
            return res.status(400).json({
                success: false,
                message: "campaignId must be a positive integer",
            })
        }

        //validate that at least one field is provided
        if(subject === undefined && body === undefined){
            return res.status(400).json({
                success: false,
                message: "at least one of subject or body must be provided",
            })
        }

        const data = {};

        //validate subject if provided
        if(subject !== undefined){
            if(typeof subject !== "string" || !subject.trim()){
                return res.status(422).json({
                    success: false,
                    message: "subject should be present",
                })
            }

            data.subject = subject.trim()
        }

        //validate body if provided
        if(body !== undefined){
            if(typeof body !== "string" || !body.trim()){
                return res.status(422).json({
                    success: false,
                    message: "email body cannot be empty",
                })
            }

            data.body = body.trim()
        }

        //update only if the campaign exists and is still a DRAFT
        const result = await prisma.emailCampaign.updateMany({
            where: {
                id: campaignId,
                status: "DRAFT",
            },
            data,
        });

        //if no campaign was updated then determine the reason
        if(result.count === 0){

            //check that campaign exists
            const campaign = await prisma.emailCampaign.findUnique({
                where: { id: campaignId },
                select: {
                    id: true,
                    status: true,
                },
            })
            if(!campaign){
                return res.status(404).json({
                    success: false,
                    message: "email campaign not found",
                })
            }
            return res.status(409).json({
                success: false,
                message: "only draft campaigns can be edited",
            })
        }

        //fetch updated campaign
        const updatedCampaign = await prisma.emailCampaign.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                driveId: true,
                subject: true,
                body: true,
                status: true,
                createdAt: true,
            },
        })

        return res.status(200).json({
            success: true,
            data: updatedCampaign,
        })
    }
    catch(error){
        // console.error("Update email campaign error:", error)

        return res.status(500).json({
            success: false,
            message: "failed to update email campaign",
        })
    }
}

const cancelCampaign = async (req, res) => {
  try {
    const campaignId = Number(req.params.campaignId)
    const { reason } = req.body

    //validate campaign ID
    if(!Number.isInteger(campaignId) || campaignId <= 0){
      return res.status(400).json({
        success: false,
        message: "invalid campaign ID",
      })
    }

    //validate cancellation reason
    if(typeof reason !== "string" || reason.trim().length === 0){
      return res.status(400).json({
        success: false,
        message: "cancellation reason is required",
      })
    }

    //cancel only DRAFT or QUEUED campaigns
    const result = await prisma.emailCampaign.updateMany({
      where: {
        id: campaignId,
        status: {
          in: ["DRAFT", "QUEUED"],
        },
      },
      data: {
        status: "CANCELLED",
        cancellationReason: reason.trim(),
      },
    })

    //if no campaign was updated, determine why
    if(result.count === 0){
      const campaign = await prisma.emailCampaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          status: true,
        },
      })

      if(!campaign){
        return res.status(404).json({
          success: false,
          message: "email campaign not found",
        })
      }

      return res.status(409).json({
        success: false,
        message: `campaign cannot be cancelled because its status is ${campaign.status}`,
      })
    }

    //fetch the updated campaign
    const cancelledCampaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        driveId: true,
        subject: true,
        status: true,
        cancellationReason: true,
        createdAt: true,
      },
    })

    return res.status(200).json({
      success: true,
      message: "email campaign cancelled successfully",
      data: cancelledCampaign,
    })
  } 
  catch(error){
    // console.error("Error cancelling email campaign:", error)

    return res.status(500).json({
      success: false,
      message: "internal server error",
    })
  }
}

module.exports = {
    createCampaign,
    getAllCampaigns,
    getCampaignById,
    updateCampaign,
    cancelCampaign,
}