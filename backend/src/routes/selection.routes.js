const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth.middleware");
const allowRoles = require("../middleware/role.middleware");
const c = require("../controllers/selection.controller");

router.post("/", auth, allowRoles("TPO"), c.createSelection);
router.get("/:selectionId", auth, allowRoles("TPO"), c.getSelection);
router.patch("/:selectionId/status", auth, allowRoles("TPO"), c.updateSelectionStatus);

module.exports = router;
