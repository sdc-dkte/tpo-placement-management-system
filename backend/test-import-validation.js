const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:5000/api/v1/import/students";
const TOKEN = process.env.TPO_TOKEN;

const headers = [
  "PRN", "name", "email", "departmentCode", "graduationYear",
  "academicPathway", "CGPA", "tenthPercentage", "twelfthPercentage",
  "diplomaPercentage", "activeBacklogs"
];

const validRow = [
  "VALTEST001", "Validation Test", "validation.test@example.com",
  "CSE", "2027", "HSC", "8.5", "85", "80", "", "0"
];

const csv = (h, rows) =>
  [h.join(","), ...rows.map(r => r.join(","))].join("\n");

async function upload(name, content, filename = "test.csv", mime = "text/csv") {
  const form = new FormData();
  form.append("file", new Blob([content], { type: mime }), filename);

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN },
    body: form
  });

  let body;
  try { body = await response.json(); }
  catch { body = {}; }

  console.log("\n" + name);
  console.log("HTTP:", response.status);
  console.log("Response:", JSON.stringify(body, null, 2));
  return { status: response.status, body };
}

async function main() {
  if (!TOKEN) {
    console.error("TPO_TOKEN is missing. Set it in this terminal first.");
    process.exitCode = 1;
    return;
  }

  const tests = [
    {
      name: "Malformed CSV",
      content: 'PRN,name,email\n"VAL1,Test,test@example.com',
      expected: 400,
      check: r => String(r.body.message || "").startsWith("Invalid CSV file:")
    },
    {
      name: "Missing required header",
      content: csv(headers.filter(h => h !== "PRN"), [
        validRow.filter((_, i) => i !== 0)
      ]),
      expected: 400,
      check: r => Array.isArray(r.body.missingHeaders) &&
                  r.body.missingHeaders.includes("PRN")
    },
    {
      name: "Headers only, no data rows",
      content: headers.join(","),
      expected: 400,
      check: r => r.body.message === "The CSV file has no data rows."
    },
    {
      name: "Invalid CGPA row",
      content: csv(headers, [[
        "VALCGPA001", "CGPA Validation", "validation.cgpa@example.com",
        "CSE", "2027", "HSC", "15", "85", "80", "", "0"
      ]]),
      expected: 200,
      check: r => r.body.failedRows === 1 && r.body.successfulRows === 0
    }
  ];

  let passed = 0;

  for (const test of tests) {
    try {
      const result = await upload(test.name, test.content);
      const ok = result.status === test.expected && test.check(result);
      console.log(ok ? "PASS" : "FAIL");
      if (ok) passed++;
    } catch (error) {
      console.log("ERROR:", error.message);
    }
  }

  console.log("\nRESULT:", passed + "/" + tests.length, "tests passed");
  if (passed !== tests.length) process.exitCode = 1;
}

main();
