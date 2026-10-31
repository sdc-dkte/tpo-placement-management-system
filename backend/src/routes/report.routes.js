const express = require("express");
const router = express.Router();
const { getAllStudents } = require("../controllers/report.controller");

router.get("/", getAllStudents);

module.exports = router;
