// Quick test: does pdf-parse v2 work?
import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

async function test() {
    try {
        const pdfPath = path.resolve(process.cwd(), "..", "Placement_Assistance_RAG_System.pdf");
        console.log("Path:", pdfPath);
        console.log("Exists:", fs.existsSync(pdfPath));

        const buf = fs.readFileSync(pdfPath);
        console.log("Buffer size:", buf.length);

        const parser = new PDFParse({ data: buf });
        console.log("PDFParse instance created");

        const result = await parser.getText();
        await parser.destroy();

        console.log("Parsed OK!");
        console.log("Text length:", result.text.length);
        console.log("First 300 chars:", result.text.slice(0, 300));
    } catch (err: any) {
        console.error("ERROR:", err.message);
        console.error("STACK:", err.stack);
    }
}

test();
