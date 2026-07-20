import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizarImagemParaPptx } from "@/services/pptx/normalizarImagemParaPptx";

interface FakeCanvas {
  width: number;
  height: number;
  getContext: (t: string) => { drawImage: (...a: unknown[]) => void } | null;
  toDataURL: (mime?: string, q?: number) => string;
}

function instalarMocks(imgW: number, imgH: number, opts?: { failLoad?: boolean; failCanvas?: boolean }) {
  const fakeCtx = { drawImage: vi.fn() };
  const fakeCanvas: FakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => (opts?.failCanvas ? null : fakeCtx),
    toDataURL: (mime = "image/jpeg", _q?: number) =>
      `data:${mime};base64,AAAA`,
  };
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag === "canvas") return fakeCanvas as unknown as HTMLCanvasElement;
    return originalCreateElement(tag);
  }) as typeof document.createElement);

  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = imgW;
    height = imgH;
    set src(_v: string) {
      queueMicrotask(() => {
        if (opts?.failLoad) this.onerror?.();
        else this.onload?.();
      });
    }
  }
  (globalThis as unknown as { Image: typeof FakeImage }).Image = FakeImage;
  return fakeCanvas;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("normalizarImagemParaPptx", () => {
  it("4000×3000 → ≤ 1600×1200 preservando proporção, JPEG válido", async () => {
    const canvas = instalarMocks(4000, 3000);
    const out = await normalizarImagemParaPptx("data:image/jpeg;base64,ZZ", {
      maxWidthPx: 1600,
      maxHeightPx: 1200,
      quality: 0.82,
    });
    expect(out.startsWith("data:image/jpeg")).toBe(true);
    expect(canvas.width).toBeLessThanOrEqual(1600);
    expect(canvas.height).toBeLessThanOrEqual(1200);
    // proporção 4:3
    expect(canvas.width / canvas.height).toBeCloseTo(4 / 3, 2);
  });

  it("imagem menor que o teto — mantém dimensões originais", async () => {
    const canvas = instalarMocks(800, 600);
    await normalizarImagemParaPptx("data:image/jpeg;base64,ZZ", {
      maxWidthPx: 1600,
      maxHeightPx: 1200,
      quality: 0.82,
    });
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it("Image.onerror → devolve dataUrl original sem lançar", async () => {
    instalarMocks(4000, 3000, { failLoad: true });
    const original = "data:image/jpeg;base64,ORIG";
    const out = await normalizarImagemParaPptx(original, {
      maxWidthPx: 1600,
      maxHeightPx: 1200,
      quality: 0.82,
    });
    expect(out).toBe(original);
  });

  it("canvas 2d indisponível → devolve original", async () => {
    instalarMocks(4000, 3000, { failCanvas: true });
    const original = "data:image/jpeg;base64,ORIG";
    const out = await normalizarImagemParaPptx(original, {
      maxWidthPx: 1600,
      maxHeightPx: 1200,
      quality: 0.82,
    });
    expect(out).toBe(original);
  });

  it("logs de warn NÃO contêm dataUrl", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    instalarMocks(4000, 3000, { failLoad: true });
    const url = "data:image/jpeg;base64,SENSIVEL_LONGA_" + "X".repeat(1000);
    await normalizarImagemParaPptx(url, {
      maxWidthPx: 1600,
      maxHeightPx: 1200,
      quality: 0.82,
    });
    for (const call of spy.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain("SENSIVEL_LONGA_");
      expect(serialized).not.toContain("data:image/");
    }
    spy.mockRestore();
  });
});
