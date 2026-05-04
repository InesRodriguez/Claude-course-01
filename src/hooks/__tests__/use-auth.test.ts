import { vi, test, expect, beforeEach, describe } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock server actions
vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";

const mockSignIn = vi.mocked(signInAction);
const mockSignUp = vi.mocked(signUpAction);
const mockGetProjects = vi.mocked(getProjects);
const mockCreateProject = vi.mocked(createProject);
const mockGetAnonWorkData = vi.mocked(getAnonWorkData);
const mockClearAnonWork = vi.mocked(clearAnonWork);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnonWorkData.mockReturnValue(null);
});

describe("useAuth — initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("signIn", () => {
  describe("happy path — existing projects", () => {
    test("returns success result and redirects to most recent project", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([
        { id: "proj-1", name: "Project 1", createdAt: new Date(), updatedAt: new Date() },
        { id: "proj-2", name: "Project 2", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const { result } = renderHook(() => useAuth());

      let returnValue: Awaited<ReturnType<typeof result.current.signIn>>;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "password123");
      });

      expect(returnValue!).toEqual({ success: true });
      expect(mockPush).toHaveBeenCalledWith("/proj-1");
    });
  });

  describe("happy path — no existing projects", () => {
    test("creates a new project and redirects to it", async () => {
      mockSignIn.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([]);
      mockCreateProject.mockResolvedValue({
        id: "new-proj",
        name: "New Design #12345",
        userId: "user-1",
        messages: "[]",
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [], data: {} })
      );
      expect(mockPush).toHaveBeenCalledWith("/new-proj");
    });
  });

  describe("happy path — anonymous work exists", () => {
    test("migrates anon work into a new project and redirects", async () => {
      const anonMessages = [{ role: "user", content: "Build a button" }];
      const anonData = { "/App.jsx": "export default () => <button />" };

      mockSignIn.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: anonMessages,
        fileSystemData: anonData,
      });
      mockCreateProject.mockResolvedValue({
        id: "migrated-proj",
        name: "Design from 12:00:00",
        userId: "user-1",
        messages: JSON.stringify(anonMessages),
        data: JSON.stringify(anonData),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: anonMessages,
          data: anonData,
        })
      );
      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/migrated-proj");
    });
  });

  describe("error state — sign in fails", () => {
    test("returns error result without redirecting", async () => {
      mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

      const { result } = renderHook(() => useAuth());

      let returnValue: Awaited<ReturnType<typeof result.current.signIn>>;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrongpassword");
      });

      expect(returnValue!).toEqual({ success: false, error: "Invalid credentials" });
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockGetProjects).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    test("isLoading is true during sign in and false after", async () => {
      let resolveSignIn!: (value: { success: boolean }) => void;
      mockSignIn.mockReturnValue(new Promise((res) => { resolveSignIn = res; }));
      mockGetProjects.mockResolvedValue([
        { id: "p1", name: "P1", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@example.com", "password123");
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolveSignIn({ success: true });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("isLoading resets to false even when sign in throws", async () => {
      mockSignIn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe("signUp", () => {
  describe("happy path — existing projects", () => {
    test("returns success result and redirects to most recent project", async () => {
      mockSignUp.mockResolvedValue({ success: true });
      mockGetProjects.mockResolvedValue([
        { id: "proj-1", name: "Project 1", createdAt: new Date(), updatedAt: new Date() },
      ]);

      const { result } = renderHook(() => useAuth());

      let returnValue: Awaited<ReturnType<typeof result.current.signUp>>;
      await act(async () => {
        returnValue = await result.current.signUp("new@example.com", "password123");
      });

      expect(returnValue!).toEqual({ success: true });
      expect(mockPush).toHaveBeenCalledWith("/proj-1");
    });
  });

  describe("happy path — anonymous work exists", () => {
    test("migrates anon work and clears it after sign up", async () => {
      const anonMessages = [{ role: "user", content: "Make a form" }];
      mockSignUp.mockResolvedValue({ success: true });
      mockGetAnonWorkData.mockReturnValue({
        messages: anonMessages,
        fileSystemData: {},
      });
      mockCreateProject.mockResolvedValue({
        id: "new-from-anon",
        name: "Design from 10:30:00",
        userId: "user-2",
        messages: JSON.stringify(anonMessages),
        data: "{}",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(mockClearAnonWork).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/new-from-anon");
    });
  });

  describe("error state — sign up fails", () => {
    test("returns error result without redirecting", async () => {
      mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

      const { result } = renderHook(() => useAuth());

      let returnValue: Awaited<ReturnType<typeof result.current.signUp>>;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "password123");
      });

      expect(returnValue!).toEqual({ success: false, error: "Email already registered" });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("loading state", () => {
    test("isLoading resets to false even when sign up throws", async () => {
      mockSignUp.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});

describe("edge cases", () => {
  test("anon work with empty messages list is ignored", async () => {
    mockSignIn.mockResolvedValue({ success: true });
    mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
    mockGetProjects.mockResolvedValue([
      { id: "proj-1", name: "Project 1", createdAt: new Date(), updatedAt: new Date() },
    ]);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signIn("user@example.com", "password123");
    });

    // Should fall through to getProjects, not createProject with anon data
    expect(mockGetProjects).toHaveBeenCalled();
    expect(mockClearAnonWork).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/proj-1");
  });
});
