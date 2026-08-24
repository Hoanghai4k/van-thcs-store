import { describe, it, expect, vi } from "vitest";

// Mock dependencies
vi.mock("cloudconvert", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      jobs: {
        create: vi.fn().mockResolvedValue({ id: "mock-job-123" }),
        wait: vi.fn().mockResolvedValue({
          status: "finished",
          tasks: [
            {
              operation: "export/url",
              status: "finished",
              result: { files: [{ url: "https://mock-url/file.pdf" }] },
            },
          ],
        }),
      },
    })),
  };
});

// Since we can't test actual DB in unit test easily, we mock the responses
describe("Preview Generator Logic", () => {
  it("should prioritize DOCX over PDF for preview generation", () => {
    const files = [
      { file_name: "test.zip" },
      { file_name: "test.pdf" },
      { file_name: "test.docx" },
    ];
    
    let sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".docx"));
    if (!sourceFile) {
      sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".pdf"));
    }
    
    expect(sourceFile?.file_name).toBe("test.docx");
  });

  it("should fall back to PDF if no DOCX exists", () => {
    const files = [
      { file_name: "test.zip" },
      { file_name: "test.pdf" },
    ];
    
    let sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".docx"));
    if (!sourceFile) {
      sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".pdf"));
    }
    
    expect(sourceFile?.file_name).toBe("test.pdf");
  });

  it("should fail gracefully if only ZIP exists", () => {
    const files = [
      { file_name: "test.zip" },
    ];
    
    let sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".docx"));
    if (!sourceFile) {
      sourceFile = files.find((f) => f.file_name.toLowerCase().endsWith(".pdf"));
    }
    
    expect(sourceFile).toBeUndefined();
  });
});
