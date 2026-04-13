from typing import Annotated

from fastapi import Body, FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware

from .geometry import GeometryKernelError, build_model_preview, get_model_preview, get_model_previews
from .schemas import (
    HealthResponse,
    ModelCatalogResponse,
    ModelPreview,
    ModelPreviewRequest,
    ShapeType,
)


app = FastAPI(
    title="OpenAPI CAD Preview API",
    version="0.1.0",
    description="CadQuery primitives exposed through FastAPI and OpenAPI.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/api/models", response_model=ModelCatalogResponse)
def list_models() -> ModelCatalogResponse:
    try:
        return ModelCatalogResponse(models=get_model_previews())
    except GeometryKernelError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/models/{shape_type}", response_model=ModelPreview)
def read_model(
    shape_type: Annotated[
        ShapeType,
        Path(description="Primitive model type to preview."),
    ],
) -> ModelPreview:
    try:
        preview = get_model_preview(shape_type)
    except GeometryKernelError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if preview is None:
        raise HTTPException(status_code=404, detail=f"Unknown model type: {shape_type}")

    return preview


@app.post("/api/models/preview", response_model=ModelPreview)
def preview_model(
    request: Annotated[
        ModelPreviewRequest,
        Body(description="Primitive parameters to rebuild with CadQuery."),
    ],
) -> ModelPreview:
    try:
        return build_model_preview(request)
    except GeometryKernelError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
