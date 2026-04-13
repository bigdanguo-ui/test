import type { components } from "./schema";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type ModelCatalogResponse = components["schemas"]["ModelCatalogResponse"];
export type ModelPreview = ModelCatalogResponse["models"][number];
export type ShapeType = ModelPreview["shape_type"];

export async function fetchModelCatalog(): Promise<ModelPreview[]> {
  const response = await fetch(`${API_BASE_URL}/api/models`);

  if (!response.ok) {
    throw new Error(`模型目录请求失败：${response.status}`);
  }

  const payload = (await response.json()) as ModelCatalogResponse;
  return payload.models;
}
