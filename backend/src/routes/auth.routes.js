
const express = require("express");
const router = express.Router();

const {
    login,
    me,
    changePassword,
    logout
} = require("../controllers/auth.controller");

const authenticateToken = require("../middleware/auth.middleware");

router.post("/login", login);
router.get("/me", authenticateToken, me);
router.post("/change-password", authenticateToken, changePassword);
router.post("/logout", authenticateToken, logout);

module.exports = router;
