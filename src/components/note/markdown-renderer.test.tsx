import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownRenderer } from "./markdown-editor";
import { toast } from "@/components/common/Toast";

vi.mock("katex/dist/katex.min.css", () => ({}));

vi.mock("@/components/common/Toast", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
        info: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn(),
    },
}));

const writeText = vi.fn();

describe("MarkdownRenderer code copy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        writeText.mockResolvedValue(undefined);

        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText,
            },
        });
    });

    it("copies fenced code block content", async () => {
        render(<MarkdownRenderer content={"```ts\nconst value = 1;\n```"} />);

        fireEvent.click(screen.getByRole("button", { name: "Copy" }));

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith("const value = 1;");
        });
        expect(toast.success).toHaveBeenCalledWith("Copied");
        expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });

    it("does not show a copy button for inline code", () => {
        render(<MarkdownRenderer content={"Run `pnpm test` before pushing."} />);

        expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    });

    it("toggles fenced code block line numbers", () => {
        render(<MarkdownRenderer content={"```\nalpha\nbeta\n```"} />);

        fireEvent.click(screen.getByRole("button", { name: "Show line numbers" }));

        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByText("2")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Hide line numbers" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Hide line numbers" }));

        expect(screen.queryByText("1")).not.toBeInTheDocument();
        expect(screen.queryByText("2")).not.toBeInTheDocument();
    });

    it("can disable code copy controls", () => {
        render(<MarkdownRenderer content={"```\nplain text\n```"} enableCodeCopy={false} />);

        expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Show line numbers" })).not.toBeInTheDocument();
    });
});
