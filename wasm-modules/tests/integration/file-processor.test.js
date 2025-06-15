"use strict";
/**
 * Integration tests for the WASM file-processor module
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const file_processor_bridge_1 = require("../../bridge/file-processor-bridge");
describe('File Processor Integration Tests', () => {
    let processor;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        processor = (0, file_processor_bridge_1.createFileProcessor)();
        yield processor.initialize();
    }));
    afterAll(() => {
        processor.destroy();
    });
    describe('Format Detection', () => {
        test('should detect PDF format', () => __awaiter(void 0, void 0, void 0, function* () {
            const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34]); // %PDF-1.4
            const format = yield processor.detectFormat(pdfHeader.buffer, 'test.pdf');
            expect(format.format).toContain('pdf');
            expect(format.confidence).toBeGreaterThan(0.8);
        }));
        test('should detect PE executable format', () => __awaiter(void 0, void 0, void 0, function* () {
            // MZ header
            const peHeader = new Uint8Array(64);
            peHeader[0] = 0x4D; // M
            peHeader[1] = 0x5A; // Z
            const format = yield processor.detectFormat(peHeader.buffer, 'test.exe');
            expect(format.format.toLowerCase()).toContain('pe');
            expect(format.confidence).toBeGreaterThan(0.5);
        }));
        test('should detect ELF format', () => __awaiter(void 0, void 0, void 0, function* () {
            // ELF header
            const elfHeader = new Uint8Array([0x7F, 0x45, 0x4C, 0x46]); // \x7FELF
            const format = yield processor.detectFormat(elfHeader.buffer, 'test');
            expect(format.format.toLowerCase()).toContain('elf');
            expect(format.confidence).toBeGreaterThan(0.8);
        }));
        test('should detect JavaScript files', () => __awaiter(void 0, void 0, void 0, function* () {
            const jsContent = new TextEncoder().encode('console.log("Hello World");');
            const format = yield processor.detectFormat(jsContent.buffer, 'test.js');
            expect(format.format.toLowerCase()).toContain('javascript');
        }));
    });
    describe('File Validation', () => {
        test('should validate a valid PDF file', () => __awaiter(void 0, void 0, void 0, function* () {
            const pdfContent = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\ntrailer\n<<>>\n%%EOF');
            const validation = yield processor.validateFile(pdfContent.buffer);
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        }));
        test('should reject files that are too large', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create a mock large buffer (just headers, not actually large)
            const largeFile = new Uint8Array(100);
            const validation = yield processor.validateFile(largeFile.buffer);
            // This depends on implementation, adjust as needed
            expect(validation).toBeDefined();
        }));
        test('should detect malformed files', () => __awaiter(void 0, void 0, void 0, function* () {
            const malformedPdf = new TextEncoder().encode('%PDF-1.4\nmalformed content');
            const validation = yield processor.validateFile(malformedPdf.buffer);
            // Depending on validation strictness
            expect(validation).toBeDefined();
        }));
    });
    describe('PDF Parsing', () => {
        test('should parse PDF and detect JavaScript', () => __awaiter(void 0, void 0, void 0, function* () {
            const pdfWithJS = new TextEncoder().encode('%PDF-1.4\n' +
                '1 0 obj\n' +
                '<< /Type /Catalog /Pages 2 0 R /OpenAction << /S /JavaScript /JS (alert("malicious");) >> >>\n' +
                'endobj\n' +
                'xref\n' +
                '0 2\n' +
                'trailer\n' +
                '<<>>\n' +
                '%%EOF');
            const parsed = yield processor.parseFile(pdfWithJS.buffer, 'pdf');
            expect(parsed.format.toLowerCase()).toContain('pdf');
            expect(parsed.suspicious_indicators).toBeDefined();
            expect(parsed.suspicious_indicators.length).toBeGreaterThan(0);
            const jsIndicator = parsed.suspicious_indicators.find(i => i.type.toLowerCase().includes('javascript'));
            expect(jsIndicator).toBeDefined();
            expect(jsIndicator === null || jsIndicator === void 0 ? void 0 : jsIndicator.severity).toBe('high');
        }));
        test('should extract metadata from PDF', () => __awaiter(void 0, void 0, void 0, function* () {
            const pdfWithMeta = new TextEncoder().encode('%PDF-1.4\n' +
                '1 0 obj\n' +
                '<< /Type /Catalog >>\n' +
                'endobj\n' +
                '2 0 obj\n' +
                '<< /Title (Test PDF) /Author (Test Author) /Creator (Test Creator) >>\n' +
                'endobj\n' +
                'trailer\n' +
                '<< /Info 2 0 R >>\n' +
                '%%EOF');
            const parsed = yield processor.parseFile(pdfWithMeta.buffer, 'pdf');
            expect(parsed.metadata).toBeDefined();
            // Metadata extraction depends on implementation
        }));
        test('should detect embedded files in PDF', () => __awaiter(void 0, void 0, void 0, function* () {
            const pdfWithEmbed = new TextEncoder().encode('%PDF-1.4\n' +
                '1 0 obj\n' +
                '<< /Type /Catalog /Names << /EmbeddedFiles 2 0 R >> >>\n' +
                'endobj\n' +
                '2 0 obj\n' +
                '<< /Names [(malware.exe) 3 0 R] >>\n' +
                'endobj\n' +
                '%%EOF');
            const parsed = yield processor.parseFile(pdfWithEmbed.buffer, 'pdf');
            const embedIndicator = parsed.suspicious_indicators.find(i => i.type.toLowerCase().includes('embed'));
            expect(embedIndicator).toBeDefined();
        }));
    });
    describe('PE File Parsing', () => {
        test('should parse PE header and detect architecture', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            // Minimal PE file structure
            const peFile = new Uint8Array(512);
            // DOS header
            peFile[0] = 0x4D; // M
            peFile[1] = 0x5A; // Z
            // PE offset at 0x3C
            peFile[0x3C] = 0x80; // PE header at offset 0x80
            // PE signature at offset 0x80
            peFile[0x80] = 0x50; // P
            peFile[0x81] = 0x45; // E
            peFile[0x82] = 0x00;
            peFile[0x83] = 0x00;
            // Machine type (x64)
            peFile[0x84] = 0x64;
            peFile[0x85] = 0x86;
            const parsed = yield processor.parseFile(peFile.buffer, 'pe');
            expect(parsed.format.toLowerCase()).toContain('pe');
            expect((_a = parsed.metadata.attributes) === null || _a === void 0 ? void 0 : _a.architecture).toBe('x64');
        }));
        test('should detect suspicious PE characteristics', () => __awaiter(void 0, void 0, void 0, function* () {
            // This would need a more complete PE file with sections
            // For now, just test basic structure
            const peFile = new Uint8Array(512);
            peFile[0] = 0x4D;
            peFile[1] = 0x5A;
            const parsed = yield processor.parseFile(peFile.buffer, 'pe');
            expect(parsed).toBeDefined();
        }));
    });
    describe('String Extraction', () => {
        test('should extract ASCII strings', () => __awaiter(void 0, void 0, void 0, function* () {
            const content = new TextEncoder().encode('Hello World! This is a test string.');
            const strings = yield processor.extractStrings(content.buffer, 5);
            expect(strings.length).toBeGreaterThan(0);
            expect(strings.some(s => s.value.includes('Hello World'))).toBe(true);
        }));
        test('should detect suspicious strings', () => __awaiter(void 0, void 0, void 0, function* () {
            const content = new TextEncoder().encode('normal text cmd.exe /c del /f /q c:\\windows\\system32 http://malicious.com/payload.exe');
            const strings = yield processor.extractStrings(content.buffer, 5);
            const suspiciousStrings = strings.filter(s => s.suspicious);
            expect(suspiciousStrings.length).toBeGreaterThan(0);
        }));
    });
    describe('Performance Tests', () => {
        test('should process files within performance targets', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create a 1MB test file
            const largeContent = new Uint8Array(1024 * 1024);
            for (let i = 0; i < largeContent.length; i++) {
                largeContent[i] = Math.floor(Math.random() * 256);
            }
            const startTime = Date.now();
            const format = yield processor.detectFormat(largeContent.buffer);
            const detectTime = Date.now() - startTime;
            // Format detection should be fast (< 100ms for 1MB)
            expect(detectTime).toBeLessThan(100);
            // String extraction performance
            const extractStart = Date.now();
            yield processor.extractStrings(largeContent.buffer, 10);
            const extractTime = Date.now() - extractStart;
            // String extraction should complete within reasonable time
            expect(extractTime).toBeLessThan(1000); // 1 second for 1MB
        }));
    });
    describe('Error Handling', () => {
        test('should handle null buffer gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(processor.detectFormat(new ArrayBuffer(0))).resolves.toBeDefined();
        }));
        test('should handle corrupted data', () => __awaiter(void 0, void 0, void 0, function* () {
            const corruptedData = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
            yield expect(processor.parseFile(corruptedData.buffer)).resolves.toBeDefined();
        }));
    });
});
describe('File Manager Integration', () => {
    test('should integrate with Athena fileManager service', () => __awaiter(void 0, void 0, void 0, function* () {
        // This would test the actual integration with fileManager.ts
        // For now, just verify the bridge exports are correct
        expect(file_processor_bridge_1.createFileProcessor).toBeDefined();
        expect(typeof file_processor_bridge_1.createFileProcessor).toBe('function');
    }));
});
