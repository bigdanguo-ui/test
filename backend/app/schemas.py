from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


ShapeType = Literal["box", "sphere", "cylinder"]
DIMENSION_FIELD = Field(..., gt=0, le=10)


class HealthResponse(BaseModel):
    status: Literal["ok"]


class Vector3(BaseModel):
    x: float
    y: float
    z: float


class BasePreview(BaseModel):
    id: str
    label: str
    color: str
    center: Vector3
    volume: float = Field(..., ge=0)
    bounding_box: Vector3


class BoxPreview(BasePreview):
    shape_type: Literal["box"] = "box"
    width: float = DIMENSION_FIELD
    height: float = DIMENSION_FIELD
    depth: float = DIMENSION_FIELD


class SpherePreview(BasePreview):
    shape_type: Literal["sphere"] = "sphere"
    radius: float = DIMENSION_FIELD


class CylinderPreview(BasePreview):
    shape_type: Literal["cylinder"] = "cylinder"
    radius: float = DIMENSION_FIELD
    height: float = DIMENSION_FIELD


ModelPreview = Annotated[
    Union[BoxPreview, SpherePreview, CylinderPreview],
    Field(discriminator="shape_type"),
]


class ModelCatalogResponse(BaseModel):
    models: list[ModelPreview]


class BasePreviewRequest(BaseModel):
    center: Vector3
    color: str | None = None
    label: str | None = None


class BoxPreviewRequest(BasePreviewRequest):
    shape_type: Literal["box"] = "box"
    width: float = DIMENSION_FIELD
    height: float = DIMENSION_FIELD
    depth: float = DIMENSION_FIELD


class SpherePreviewRequest(BasePreviewRequest):
    shape_type: Literal["sphere"] = "sphere"
    radius: float = DIMENSION_FIELD


class CylinderPreviewRequest(BasePreviewRequest):
    shape_type: Literal["cylinder"] = "cylinder"
    radius: float = DIMENSION_FIELD
    height: float = DIMENSION_FIELD


ModelPreviewRequest = Annotated[
    Union[BoxPreviewRequest, SpherePreviewRequest, CylinderPreviewRequest],
    Field(discriminator="shape_type"),
]
