const ExcelJS = require("exceljs");

// Prevent spreadsheet formula injection
const safeExcelText = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  const text = String(value);

  // Escape values that begin with formula-triggering characters
  if (/^[\s]*[=+\-@]/.test(text)) {
    return `'${text}`;
  }

  return text;
};

const generateStudentReportExcel = async (students, filters = {}) => {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "DKTE Training and Placement Cell";
  workbook.subject = "Student Placement Report";
  workbook.title = "Student Placement Report";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Placement Report");

  // Report generation date and time
  const generatedOn = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  // Applied filters
  const filterLabels = {
    search: "Search",
    department: "Department",
    batch: "Batch",
    company: "Company",
    placementStatus: "Placement Status",
  };

  const appliedFilters = Object.entries(filterLabels)
    .filter(([key]) => typeof filters[key] === "string" && filters[key].trim())
    .map(([key, label]) => `${label}: ${filters[key].trim()}`);

  const filterText = appliedFilters.length > 0 ? appliedFilters.join(" | ") : "None";

  // Calculate placement summary
  const totalStudents = students.length;

  const placedCount = students.filter((student) => student.placementStatus === "PLACED").length;

  const notPlacedCount = totalStudents - placedCount;

  const placementRate = totalStudents === 0 ? 0 : (placedCount / totalStudents) * 100;

  // Column widths
  worksheet.columns = [
    { key: "name", width: 25 },
    { key: "PRN", width: 20 },
    { key: "department", width: 40 },
    { key: "batch", width: 15 },
    { key: "placementStatus", width: 18 },
    { key: "company", width: 25 },
    { key: "packageLPA", width: 15 },
    { key: "offerStatus", width: 22 },
  ];

  // Institute heading
  worksheet.mergeCells("A1:H1");

  const instituteTitle = worksheet.getCell("A1");
  instituteTitle.value = "DKTE SOCIETY'S";
  instituteTitle.font = {
    name: "Arial",
    size: 16,
    bold: true,
    color: { argb: "FF000000" },
  };
  instituteTitle.alignment = { horizontal: "center" };

  worksheet.mergeCells("A2:H2");

  const instituteName = worksheet.getCell("A2");
  instituteName.value = "TEXTILE AND ENGINEERING INSTITUTE, ICHALKARANJI";

  instituteName.font = {
    name: "Arial",
    size: 12,
    bold: true,
    color: { argb: "FF000000" },
  };
  instituteName.alignment = { horizontal: "center" };

  worksheet.mergeCells("A3:H3");

  const reportTitle = worksheet.getCell("A3");
  reportTitle.value = "STUDENT PLACEMENT REPORT";

  reportTitle.font = {
    name: "Arial",
    size: 14,
    bold: true,
    color: { argb: "FF000000" },
  };
  reportTitle.alignment = { horizontal: "center" };

  // Yellow separator
  worksheet.mergeCells("A4:H4");

  worksheet.getCell("A4").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFC900" },
  };

  worksheet.getRow(4).height = 3;

  // Report metadata
  worksheet.mergeCells("A5:H5");
  worksheet.getCell("A5").value = `Generated On: ${generatedOn}`;
  worksheet.getCell("A5").font = {
    name: "Arial",
    size: 10,
    color: { argb: "FF555555" },
  };

  worksheet.mergeCells("A6:H6");
  worksheet.getCell("A6").value = `Applied Filters: ${filterText}`;
  worksheet.getCell("A6").font = {
    name: "Arial",
    size: 10,
    color: { argb: "FF555555" },
  };

  // Placement summary
  worksheet.getCell("A8").value = "Overall Placement Summary";

  worksheet.getCell("A8").font = {
    size: 13,
    bold: true,
    color: { argb: "FF000000" },
  };

  const summary = [
    ["Total Students", totalStudents],
    ["Placed", placedCount],
    ["Not Placed", notPlacedCount],
    ["Placement Percentage", `${placementRate.toFixed(2)}%`],
  ];

  summary.forEach(([label, value], index) => {
    const column = index * 2 + 1;

    const labelCell = worksheet.getCell(9, column);
    const valueCell = worksheet.getCell(9, column + 1);

    labelCell.value = label;
    valueCell.value = value;

    labelCell.font = { bold: true, size: 10 };
    valueCell.font = { bold: true, size: 10 };
  });

  // Table heading
  const headerRowNumber = 11;

  const headers = ["Name", "PRN", "Department", "Batch", "Status", "Company", "Package", "Offer"];

  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = headers;
  headerRow.height = 25;

  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Arial",
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF202938" },
    };

    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };

    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  });

  // Student records
  if (students.length === 0) {
    worksheet.mergeCells("A12:H12");
    const emptyMessage = worksheet.getCell("A12");
    emptyMessage.value = "No student records found.";

    emptyMessage.font = {
      name: "Arial",
      size: 12,
      italic: true,
      color: { argb: "FF666666" },
    };

    emptyMessage.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getRow(12).height = 30;
  } else {
    students.forEach((student, index) => {
      const row = worksheet.addRow([
        safeExcelText(student.name),
        safeExcelText(student.PRN),
        safeExcelText(student.department),
        safeExcelText(student.batch),
        safeExcelText(student.placementStatus),
        safeExcelText(student.company),
        student.packageLPA != null ? `${student.packageLPA} LPA` : "-",
        safeExcelText(student.offerStatus),
      ]);
      row.height = 22;

      row.eachCell((cell) => {
        cell.font = {
          name: "Arial",
          size: 10,
          color: { argb: "FF000000" },
        };

        cell.alignment = {
          vertical: "middle",
          horizontal: "left",
          wrapText: true,
        };

        cell.border = {
          top: { style: "thin", color: { argb: "FFDDDDDD" } },
          bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
          left: { style: "thin", color: { argb: "FFDDDDDD" } },
          right: { style: "thin", color: { argb: "FFDDDDDD" } },
        };

        if (index % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF2F2F2" },
          };
        }
      });
    });
  }

  // Enable filters for all eight columns
  const lastRow = Math.max(headerRowNumber, worksheet.rowCount);

  worksheet.autoFilter = {
    from: `A${headerRowNumber}`,
    to: `H${lastRow}`,
  };

  // Freeze rows above the student table
  worksheet.views = [
    {
      state: "frozen",
      ySplit: headerRowNumber,
      topLeftCell: `A${headerRowNumber + 1}`,
      activeCell: `A${headerRowNumber + 1}`,
    },
  ];

  // Print settings
  worksheet.pageSetup = {
    paperSize: 8, // A3
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };

  worksheet.headerFooter.oddFooter = "&LTraining and Placement Cell | DKTE&RPage &P of &N";

  return workbook;
};

module.exports = { generateStudentReportExcel };
