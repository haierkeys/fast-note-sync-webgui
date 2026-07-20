import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteTreeSidebar } from "./note-tree-sidebar";
import type { File as FileDTO } from "@/lib/types/file";
import type { Folder } from "@/lib/types/folder";
import type { Note, NoteListResponse } from "@/lib/types/note";

const mocks = vi.hoisted(() => ({
    handleFolderList: vi.fn(),
    handleFolderNotes: vi.fn(),
    handleNoteList: vi.fn(),
    handleFolderFiles: vi.fn(),
    handleFileList: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("@/components/api-handle/note-handle", () => ({
    useNoteHandle: () => ({
        handleFolderList: mocks.handleFolderList,
        handleFolderNotes: mocks.handleFolderNotes,
        handleNoteList: mocks.handleNoteList,
    }),
}));

vi.mock("@/components/api-handle/file-handle", () => ({
    useFileHandle: () => ({
        handleFolderFiles: mocks.handleFolderFiles,
        handleFileList: mocks.handleFileList,
    }),
}));

function folder(path: string, pathHash: string): Folder {
    return {
        path,
        pathHash,
        ctime: 1,
        mtime: 1,
        lastTime: 1,
    };
}

function note(path: string, pathHash: string): Note {
    return {
        id: pathHash.length,
        action: "",
        path,
        pathHash,
        ctime: 1,
        mtime: 1,
        updatedTimestamp: 1,
        updatedAt: "",
        createdAt: "",
        version: 0,
    };
}

function file(path: string, pathHash: string): FileDTO {
    return {
        path,
        pathHash,
        contentHash: "",
        size: 1,
        ctime: 1,
        mtime: 1,
        lastTime: 1,
    };
}

function noteResponse(list: Note[]): NoteListResponse {
    return {
        list,
        pager: {
            page: 1,
            pageSize: 99999,
            totalRows: list.length,
        },
    };
}

describe("NoteTreeSidebar", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.handleFolderList.mockImplementation((
            _vault: string,
            path: string,
            _pathHash: string,
            callback: (data: Folder[] | null) => void,
        ) => {
            if (path === "") {
                callback([folder("Projects", "folder-projects")]);
                return;
            }

            if (path === "Projects") {
                callback([folder("Projects/Sub", "folder-sub")]);
                return;
            }

            callback([]);
        });

        mocks.handleFolderNotes.mockImplementation((
            _vault: string,
            path: string,
            _pathHash: string,
            _page: number,
            _pageSize: number,
            _sortBy: string,
            _sortOrder: string,
            callback: (data: NoteListResponse | null) => void,
        ) => {
            if (path === "") {
                callback(noteResponse([note("Root.md", "note-root")]));
                return;
            }

            if (path === "Projects") {
                callback(noteResponse([note("Projects/Child.md", "note-child")]));
                return;
            }

            callback(noteResponse([]));
        });

        mocks.handleFolderFiles.mockImplementation((
            _vault: string,
            path: string,
            _pathHash: string,
            _page: number,
            _pageSize: number,
            _sortBy: string,
            _sortOrder: string,
            callback: (data: { list: FileDTO[] } | null) => void,
        ) => {
            if (path === "") {
                callback({ list: [file("Board.canvas", "canvas-root"), file("image.png", "file-image")] });
                return;
            }

            if (path === "Projects") {
                callback({ list: [file("Projects/Map.canvas", "canvas-map")] });
                return;
            }

            callback({ list: [] });
        });

        mocks.handleNoteList.mockImplementation((
            _vault: string,
            _page: number,
            _pageSize: number,
            keyword: string,
            _isRecycle: boolean,
            _searchMode: string,
            _searchContent: boolean,
            _sortBy: string,
            _sortOrder: string,
            callback: (data: NoteListResponse | null) => void,
        ) => {
            if (keyword === "map") {
                callback(noteResponse([note("Projects/Search Result.md", "note-search")]));
                return;
            }

            callback(noteResponse([]));
        });

        mocks.handleFileList.mockImplementation((
            _vault: string,
            _page: number,
            _pageSize: number,
            _isRecycle: boolean,
            keyword: string,
            _sortBy: string,
            _sortOrder: string,
            callback: (data: { list: FileDTO[] } | null) => void,
        ) => {
            if (keyword === "map") {
                callback({ list: [file("Projects/Search Board.canvas", "canvas-search"), file("Projects/image.png", "file-search-image")] });
                return;
            }

            callback({ list: [] });
        });
    });

    it("loads root nodes, lazy-loads child folders, and selects notes or canvas files", async () => {
        const onSelectNote = vi.fn();
        const onFoldersLoaded = vi.fn();

        render(
            <NoteTreeSidebar
                vault="Work"
                selectedPathHash="note-root"
                onSelectNote={onSelectNote}
                onFoldersLoaded={onFoldersLoaded}
            />
        );

        expect(await screen.findByText("Projects")).toBeInTheDocument();
        expect(screen.getByText("Root")).toBeInTheDocument();
        expect(screen.getByText("Board")).toBeInTheDocument();
        expect(screen.queryByText("image.png")).not.toBeInTheDocument();
        expect(onFoldersLoaded).toHaveBeenCalledWith([expect.objectContaining({ path: "Projects" })]);

        fireEvent.click(screen.getByRole("button", { name: "Projects" }));

        await waitFor(() => {
            expect(screen.getByText("Child")).toBeInTheDocument();
            expect(screen.getByText("Map")).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole("button", { name: "Child" }));
        expect(onSelectNote).toHaveBeenLastCalledWith(expect.objectContaining({ path: "Projects/Child.md" }), true);

        fireEvent.click(screen.getByRole("button", { name: "Board" }));
        expect(onSelectNote).toHaveBeenLastCalledWith(expect.objectContaining({ path: "Board.canvas" }), true);
    });

    it("searches notes and canvas files without showing non-canvas attachments", async () => {
        const onSelectNote = vi.fn();

        render(
            <NoteTreeSidebar
                vault="Work"
                selectedPathHash="note-root"
                onSelectNote={onSelectNote}
            />
        );

        expect(await screen.findByText("Projects")).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText("ui.note.treeSearchPlaceholder"), {
            target: { value: "map" },
        });

        await waitFor(() => {
            expect(mocks.handleNoteList).toHaveBeenCalledWith(
                "Work",
                1,
                99999,
                "map",
                false,
                "path",
                false,
                "path",
                "asc",
                expect.any(Function)
            );
        });

        expect(await screen.findByText("Search Result")).toBeInTheDocument();
        expect(screen.getByText("Projects/Search Result.md")).toBeInTheDocument();
        expect(screen.getByText("Search Board")).toBeInTheDocument();
        expect(screen.getByText("Projects/Search Board.canvas")).toBeInTheDocument();
        expect(screen.queryByText("Projects/image.png")).not.toBeInTheDocument();

        const canvasButton = screen.getByText("Search Board").closest("button");
        expect(canvasButton).not.toBeNull();
        fireEvent.click(canvasButton!);
        expect(onSelectNote).toHaveBeenLastCalledWith(expect.objectContaining({ path: "Projects/Search Board.canvas" }), true);

        fireEvent.click(screen.getByLabelText("ui.common.clear"));
        expect(screen.getByText("Projects")).toBeInTheDocument();
    });
});
