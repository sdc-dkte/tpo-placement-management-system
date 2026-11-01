const pdfmake = require("pdfmake");
const path = require("path");
const fs = require("fs");

// Roboto font configuration
const fonts = {
  Roboto: {
    normal: path.join(
      __dirname,
      "../../node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff",
    ),
    bold: path.join(
      __dirname,
      "../../node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff",
    ),
    italics: path.join(
      __dirname,
      "../../node_modules/@fontsource/roboto/files/roboto-latin-400-italic.woff",
    ),
    bolditalics: path.join(
      __dirname,
      "../../node_modules/@fontsource/roboto/files/roboto-latin-700-italic.woff",
    ),
  },
};

pdfmake.addFonts(fonts);

// DKTE logo
const logoPath = path.resolve(__dirname, "../../../frontend/src/assets/dkte-logo.png");

if (!fs.existsSync(logoPath)) {
  throw new Error(`DKTE logo not found: ${logoPath}`);
}

const logoBase64 = fs.readFileSync(logoPath).toString("base64");
const logoData = `data:image/png;base64,${logoBase64}`;

const generateStudentReportPDF = async (students) => {
  // Placement calculations
  const totalStudents = students.length;

  const placedCount = students.filter((student) => student.placementStatus === "PLACED").length;

  const notPlacedCount = totalStudents - placedCount;

  const placementRate =
    totalStudents === 0 ? "0.00" : ((placedCount / totalStudents) * 100).toFixed(2);

  // Original eight database column names
  const tableBody = [
    [
      { text: "Name", style: "tableHeader" },
      { text: "PRN", style: "tableHeader" },
      { text: "Department", style: "tableHeader" },
      { text: "Batch", style: "tableHeader" },
      { text: "Status", style: "tableHeader" },
      { text: "Company", style: "tableHeader" },
      { text: "Package", style: "tableHeader" },
      { text: "Offer", style: "tableHeader" },
    ],

    ...students.map((student) => [
      student.name || "-",
      student.PRN || "-",
      student.department || "-",
      student.batch || "-",
      student.placementStatus || "-",
      student.company || "-",
      student.packageLPA != null ? `${student.packageLPA} LPA` : "-",
      student.offerStatus || "-",
    ]),
  ];

  const docDefinition = {
    pageSize: "A3",
    pageOrientation: "landscape",

    pageMargins: [35, 110, 35, 60],

    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      color: "#000000",
    },

    // Header
    header: {
      margin: [35, 20, 35, 0],

      stack: [
        {
          columns: [
            // Logo on the left
            {
              image: logoData,
              width: 95,
              fit: [95, 45],
            },

            // College name centered on the page
            {
              width: "*",
              stack: [
                {
                  text: "DKTE SOCIETY'S",
                  fontSize: 16,
                  bold: true,
                  alignment: "center",
                  color: "#000000",
                },
                {
                  text: "TEXTILE AND ENGINEERING INSTITUTE, ICHALKARANJI",
                  fontSize: 11,
                  bold: true,
                  alignment: "center",
                  color: "#000000",
                  margin: [0, 5, 0, 0],
                },
              ],
            },

            // Empty space on right to balance logo
            {
              width: 95,
              text: "",
            },
          ],
          columnGap: 10,
        },

        // Yellow line below header
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 5,
              x2: 1120,
              y2: 5,
              lineWidth: 1.5,
              lineColor: "#FFC900",
            },
          ],
          margin: [0, 12, 0, 0],
        },
      ],
    },

    content: [
      // Overall placement summary
      {
        text: "Overall Placement Summary",
        fontSize: 16,
        bold: true,
        color: "#000000",
        margin: [0, 5, 0, 12],
      },

      {
        columns: [
          {
            text: `Total Students: ${totalStudents}`,
            bold: true,
          },
          {
            text: `Placed: ${placedCount}`,
            bold: true,
          },
          {
            text: `Not Placed: ${notPlacedCount}`,
            bold: true,
          },
          {
            text: `Placement Percentage: ${placementRate}%`,
            bold: true,
          },
        ],
        fontSize: 11,
        color: "#000000",
        margin: [0, 0, 0, 25],
      },

      // Student table
      ...(students.length > 0
        ? [
            {
              table: {
                headerRows: 1,
                dontBreakRows: true,

                // All eight columns with balanced widths
                widths: [120, 130, 200, 90, 120, 170, 100, 190],

                body: tableBody,
              },

              layout: {
                fillColor: (rowIndex) => {
                  if (rowIndex === 0) return "#202938";

                  return rowIndex % 2 === 0 ? "#F2F2F2" : null;
                },

                hLineColor: () => "#CCCCCC",
                vLineColor: () => "#CCCCCC",

                hLineWidth: () => 0.6,
                vLineWidth: () => 0.6,

                paddingLeft: () => 8,
                paddingRight: () => 8,
                paddingTop: () => 10,
                paddingBottom: () => 10,
              },
            },
          ]
        : [
            {
              text: "No student records found.",
              fontSize: 11,
              alignment: "center",
              color: "#000000",
              margin: [0, 15, 0, 0],
            },
          ]),
    ],

    // Table heading style
    styles: {
      tableHeader: {
        bold: true,
        fontSize: 10,
        color: "#FFFFFF",
        alignment: "left",
      },
    },

    // Footer
    footer: (currentPage, pageCount) => ({
      margin: [35, 15, 35, 0],

      stack: [
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 1120,
              y2: 0,
              lineWidth: 0.5,
              lineColor: "#CCCCCC",
            },
          ],
        },

        {
          columns: [
            {
              text: "Training and Placement Cell | DKTE",
              alignment: "left",
            },
            {
              text: `Page ${currentPage} of ${pageCount}`,
              alignment: "right",
            },
          ],

          fontSize: 9,
          color: "#000000",
          margin: [0, 7, 0, 0],
        },
      ],
    }),
  };

  return await pdfmake.createPdf(docDefinition).getStream();
};

module.exports = { generateStudentReportPDF };
