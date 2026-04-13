from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


ShapeType = Literal["box", "sphere", "cylinder"]


class HealthResponse(BaseModel):
    status: Literal["ok"]


class Vector3(BaseModel):
    x: float = Field(..., ge=0)
    y: float = Field(..., ge=0)
    z: float = Field(..., ge=0)


class BasePreview(BaseModel):
    id: str
    label: str
    color: str
    volume: float = Field(..., ge=0)
    bounding_box: Vector3


class BoxPreview(BasePreview):
    shape_type: Literal["box"] = "box"
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    depth: float = Field(..., gt=0)


class SpherePreview(BasePreview):
    shape_type: Literal["sphere"] = "sphere"
    radius: float = Field(..., gt=0)


class CylinderPreview(BasePreview):
    shape_type: Literal["cylinder"] = "cylinder"
    radius: float = Field(..., gt=0)
    height: float = Field(..., gt=0)


ModelPreview = Annotated[
    Union[BoxPreview, SpherePreview, CylinderPreview],
    Field(discriminator="shape_type"),
]


class ModelCatalogResponse(BaseModel):
    models: list[ModelPreview]
