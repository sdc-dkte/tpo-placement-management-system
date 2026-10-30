const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const c = require("../controllers/participation.controller");

router.get("/drives/:driveId/participations", auth, allowRoles("TPO"), c.listDriveParticipations);
router.post("/drives/:driveId/participations", auth, allowRoles("TPO"), c.addDriveParticipations);
router.get("/participations/:participationId/history", auth, allowRoles("TPO"), c.getParticipationHistory);
router.patch("/participations/:participationId/status", auth, allowRoles("TPO"), c.updateParticipationStatus);
router.get("/participations/:participationId", auth, allowRoles("TPO"), c.getParticipation);

module.exports = router;
