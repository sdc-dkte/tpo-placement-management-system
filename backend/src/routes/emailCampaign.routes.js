const express = require("express")
const router = express.Router()

const authMiddleware = require("../middleware/auth.middleware")
const roleMiddleware = require("../middleware/role.middleware")

const {createCampaign, getAllCampaigns, getCampaignById} = require("../controllers/emailCampaign.controller")

router.post("/", authMiddleware, roleMiddleware("TPO"), createCampaign)
router.get("/", authMiddleware, roleMiddleware("TPO"), getAllCampaigns)
router.get("/:campaignId", authMiddleware, roleMiddleware("TPO"), getCampaignById)

module.exports = router