const express = require("express")
const router = express.Router()

const authMiddleware = require("../middleware/auth.middleware")
const roleMiddleware = require("../middleware/role.middleware")

const {createCampaign, getAllCampaigns} = require("../controllers/emailCampaign.controller")

router.post("/", authMiddleware, roleMiddleware("TPO"), createCampaign)
router.get("/", authMiddleware, roleMiddleware("TPO"), getAllCampaigns)

module.exports = router