import type { components } from "./schema";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type ModelCatalogResponse = components["schemas"]["ModelCatalogResponse"];
export type ModelPreview = ModelCatalogResponse["models"][number];
export type ModelPreviewRequest =
  | components["schemas"]["BoxPreviewRequest"]
  | components["schemas"]["SpherePreviewRequest"]
  | components["schemas"]["CylinderPreviewRequest"];
export type ShapeType = ModelPreview["shape_type"];

export async function fetchModelCatalog(): Promise<ModelPreview[]> {
  const response = await fetch(`${API_BASE_URL}/api/models`);

  if (!response.ok) {
    throw new Error(`模型目录请求失败：${response.status}`);
  }

  const payload = (await response.json()) as ModelCatalogResponse;
  return payload.models;
}

export async function previewModel(request: ModelPreviewRequest): Promise<ModelPreview> {
  const response = await fetch(`${API_BASE_URL}/api/models/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`模型预览计算失败：${response.status}`);
  }

  return (await response.json()) as ModelPreview;
}
