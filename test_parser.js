
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim())
    const result = []

    for (const line of lines) {
        const row = []
        let currentField = ''
        let insideQuotes = false

        for (let i = 0; i < line.length; i++) {
            const char = line[i]
            const nextChar = line[i + 1]

            if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                    // Escaped quote
                    currentField += '"'
                    i++ // Skip next quote
                } else {
                    // Toggle quote state
                    insideQuotes = !insideQuotes
                }
            } else if (char === ',' && !insideQuotes) {
                // End of field
                row.push(currentField.trim())
                currentField = ''
            } else {
                currentField += char
            }
        }

        // Add last field
        row.push(currentField.trim())
        result.push(row)
    }

    return result
}

const csvContent = `firstName,lastName,email,phone,company
John,Doe,john.doe.test@example.com,555-0101,Acme Corp
Jane,Smith,jane.smith.test@example.com,555-0102,"Beta, Inc"
`;

console.log("Testing Normal CSV:");
try {
    const rows = parseCSV(csvContent);
    console.log("Rows found:", rows.length);
    console.log("Headers:", JSON.stringify(rows[0]));
    console.log("Row 1:", JSON.stringify(rows[1]));
    console.log("Row 2:", JSON.stringify(rows[2]));
} catch (e) {
    console.error(e);
}

const csvContentWindows = "firstName,lastName,email\r\nTest,User,test@example.com\r\n";
console.log("\nTesting Windows CSV (\\r\\n):");
try {
    const rows = parseCSV(csvContentWindows);
    console.log("Rows found:", rows.length);
    console.log("Headers:", JSON.stringify(rows[0]));
    console.log("Row 1:", JSON.stringify(rows[1]));
} catch (e) {
    console.error(e);
}
