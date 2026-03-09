require("dotenv").config();
const { getSheetsInstance } = require("./services/googleSheetsService");

async function run() {
    console.log("Starting sheet formatting update...");
    const instance = getSheetsInstance();
    if (!instance) {
        console.error("Failed to get Google Sheets instance. Check auth or sheet ID.");
        return;
    }

    const { sheets, spreadsheetId } = instance;

    const spreadsheetData = await sheets.spreadsheets.get({ spreadsheetId });
    // Look for "March 2026"
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const d = new Date();
    const currentMonth = monthNames[d.getMonth()];
    const currentYear = d.getFullYear(); // Should be 2026
    const sheetTitle = `${currentMonth} ${currentYear}`;

    const sheet = spreadsheetData.data.sheets.find(s => s.properties.title === sheetTitle);

    if (!sheet) {
        console.log(`Sheet ${sheetTitle} not found. Searching for 'March 2026' explicitly just in case...`);
        // Fallback
        const fallbackSheet = spreadsheetData.data.sheets.find(s => s.properties.title === "March 2026");
        if (!fallbackSheet) {
            console.error("Could not find the current month's sheet.");
            return;
        }
        sheetId = fallbackSheet.properties.sheetId;
    } else {
        sheetId = sheet.properties.sheetId;
    }

    const requests = [
        {
            // Update wrap strategy and vertical alignment for all rows after header
            repeatCell: {
                range: { sheetId: sheetId, startRowIndex: 1 },
                cell: {
                    userEnteredFormat: {
                        wrapStrategy: "WRAP",
                        verticalAlignment: "TOP"
                    }
                },
                // Only modify these fields so we don't overwrite the row colors!
                fields: "userEnteredFormat(wrapStrategy,verticalAlignment)"
            }
        },
        {
            // Increase column widths for all date columns (starting from index 2, i.e., column C onwards)
            updateDimensionProperties: {
                range: { sheetId: sheetId, dimension: "COLUMNS", startIndex: 2 },
                properties: { pixelSize: 200 },
                fields: "pixelSize"
            }
        },
        {
            // Auto resize rows so they expand naturally
            autoResizeDimensions: {
                dimensions: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: 1 // all rows after header
                }
            }
        }
    ];

    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests }
        });
        console.log("Successfully updated existing sheet formatting on Google Sheets!");
    } catch (e) {
        console.error("Error updating sheet formatting:", e);
    }
}

run();
