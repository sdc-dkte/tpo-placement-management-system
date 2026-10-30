const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const c = require("../controllers/placement.controller");

router.get("/", auth, allowRoles("TPO"), c.listPlacements);
router.get("/:selectionId", auth, allowRoles("TPO"), c.getPlacement);

module.exports = router;
