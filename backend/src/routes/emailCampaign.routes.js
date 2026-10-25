const express = require("express")
const router = express.Router()

const authMiddleware = require("../middleware/auth.middleware")
const roleMiddleware = require("../middleware/role.middleware")

const {createCampaign} = require("../controllers/emailCampaign.controller")

router.post("/", authMiddleware, roleMiddleware("TPO"), createCampaign)

module.exports = router