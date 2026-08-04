import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FilePreview } from "./file-preview";

vi.mock("react-i18next", () => ({
    initReactI18next: {
        type: "3rdParty",
        init: vi.fn(),
    },
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

describe("FilePreview", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders an HTML attachment in a sandboxed iframe", () => {
        const { container } = render(
            <FilePreview
                file={{
                    path: "reports/large-report.html",
                    pathHash: "path-hash",
                    contentHash: "content-hash",
                    size: 10,
                    mtime: 0,
                    ctime: 0,
                    lastTime: 0,
                }}
                url="/api/file/raw"
                onClose={vi.fn()}
            />
        );

        const preview = container.querySelector("iframe")!;
        expect(preview).toHaveAttribute("sandbox", "");
        expect(preview).toHaveAttribute("referrerpolicy", "no-referrer");
    });

    it("renders a PDF attachment in an iframe", () => {
        const { container } = render(
            <FilePreview
                file={{
                    path: "reports/monthly-report.pdf",
                    pathHash: "path-hash",
                    contentHash: "content-hash",
                    size: 10,
                    mtime: 0,
                    ctime: 0,
                    lastTime: 0,
                }}
                url="/api/file/raw"
                onClose={vi.fn()}
            />
        );

        expect(container.querySelector("iframe")).toHaveAttribute("src", "/api/file/raw");
    });

    it("loads text attachments through the raw file API", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('{"ready": true}'),
        });
        vi.stubGlobal("fetch", fetchMock);

        render(
            <FilePreview
                file={{
                    path: "reports/data.json",
                    pathHash: "path-hash",
                    contentHash: "content-hash",
                    size: 10,
                    mtime: 0,
                    ctime: 0,
                    lastTime: 0,
                }}
                url="/api/file/raw"
                onClose={vi.fn()}
            />
        );

        expect(await screen.findByText('{"ready": true}')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith("/api/file/raw", expect.objectContaining({ cache: "no-store" }));
    });

    it("renders as an embedded panel when requested", () => {
        const { container } = render(
            <FilePreview
                file={{
                    path: "reports/large-report.html",
                    pathHash: "path-hash",
                    contentHash: "content-hash",
                    size: 10,
                    mtime: 0,
                    ctime: 0,
                    lastTime: 0,
                }}
                url="/api/file/raw"
                variant="panel"
                onClose={vi.fn()}
            />
        );

        expect(container.querySelector(".fixed")).not.toBeInTheDocument();
        expect(container.querySelector(".h-full")).toBeInTheDocument();
    });
});
