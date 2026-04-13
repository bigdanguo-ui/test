import { StrictMode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import {
  fetchModelCatalog,
  previewModel,
  type ModelPreview,
  type ModelPreviewRequest,
  type ShapeType
} from "./api/models";
import { materialTexture } from "./assets/materialTexture";
import "./styles.css";

type LoadState =
  | { status: "loading"; models: ModelPreview[]; error?: never }
  | { status: "ready"; models: ModelPreview[]; error?: never }
  | { status: "error"; models: ModelPreview[]; error: string };

type Vector3Value = ModelPreview["center"];
type VectorDelta = { x: number; y: number; z: number };

const MIN_SIZE = 0.1;
const MAX_SIZE = 10;
const PREVIEW_SYNC_MS = 100;
const HANDLE_COLOR = "#1d1d1b";
const CENTER_HANDLE_COLOR = "#f5f6f1";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundValue(value: number) {
  return Number(value.toFixed(4));
}

function roundVector(vector: Vector3Value): Vector3Value {
  return {
    x: roundValue(vector.x),
    y: roundValue(vector.y),
    z: roundValue(vector.z)
  };
}

function addVector(vector: Vector3Value, delta: VectorDelta): Vector3Value {
  return roundVector({
    x: vector.x + delta.x,
    y: vector.y + delta.y,
    z: vector.z + delta.z
  });
}

function toPosition(vector: Vector3Value): [number, number, number] {
  return [vector.x, vector.y, vector.z];
}

function updateModel(models: ModelPreview[], next: ModelPreview) {
  return models.map((model) => (model.id === next.id ? next : model));
}

function modelToRequest(model: ModelPreview): ModelPreviewRequest {
  const base = {
    center: model.center,
    color: model.color,
    label: model.label
  };

  switch (model.shape_type) {
    case "box":
      return {
        ...base,
        shape_type: "box",
        width: model.width,
        height: model.height,
        depth: model.depth
      };
    case "sphere":
      return {
        ...base,
        shape_type: "sphere",
        radius: model.radius
      };
    case "cylinder":
      return {
        ...base,
        shape_type: "cylinder",
        radius: model.radius,
        height: model.height
      };
  }
}

function withCenter(model: ModelPreview, center: Vector3Value): ModelPreview {
  switch (model.shape_type) {
    case "box":
      return { ...model, center };
    case "sphere":
      return { ...model, center };
    case "cylinder":
      return { ...model, center };
  }
}

function withBoxDimensions(
  model: Extract<ModelPreview, { shape_type: "box" }>,
  center: Vector3Value,
  width: number,
  height: number,
  depth: number
): ModelPreview {
  return {
    ...model,
    center,
    width,
    height,
    depth,
    volume: width * height * depth,
    bounding_box: { x: width, y: height, z: depth }
  };
}

function withSphereRadius(
  model: Extract<ModelPreview, { shape_type: "sphere" }>,
  radius: number
): ModelPreview {
  const diameter = radius * 2;

  return {
    ...model,
    radius,
    volume: (4 / 3) * Math.PI * radius ** 3,
    bounding_box: { x: diameter, y: diameter, z: diameter }
  };
}

function withCylinderDimensions(
  model: Extract<ModelPreview, { shape_type: "cylinder" }>,
  radius: number,
  height: number
): ModelPreview {
  const diameter = radius * 2;

  return {
    ...model,
    radius,
    height,
    volume: Math.PI * radius ** 2 * height,
    bounding_box: { x: diameter, y: height, z: diameter }
  };
}

function clampCoordinate(value: number, fixed: number, sign: number) {
  const distance = clamp((value - fixed) * sign, MIN_SIZE, MAX_SIZE);
  return roundValue(fixed + sign * distance);
}

function moveBoxVertex(
  model: Extract<ModelPreview, { shape_type: "box" }>,
  signs: [number, number, number],
  delta: VectorDelta
): ModelPreview {
  const [sx, sy, sz] = signs;
  const current = {
    x: model.center.x + sx * (model.width / 2),
    y: model.center.y + sy * (model.height / 2),
    z: model.center.z + sz * (model.depth / 2)
  };
  const fixed = {
    x: model.center.x - sx * (model.width / 2),
    y: model.center.y - sy * (model.height / 2),
    z: model.center.z - sz * (model.depth / 2)
  };
  const next = {
    x: clampCoordinate(current.x + delta.x, fixed.x, sx),
    y: clampCoordinate(current.y + delta.y, fixed.y, sy),
    z: clampCoordinate(current.z + delta.z, fixed.z, sz)
  };
  const center = roundVector({
    x: (fixed.x + next.x) / 2,
    y: (fixed.y + next.y) / 2,
    z: (fixed.z + next.z) / 2
  });

  return withBoxDimensions(
    model,
    center,
    roundValue(Math.abs(next.x - fixed.x)),
    roundValue(Math.abs(next.y - fixed.y)),
    roundValue(Math.abs(next.z - fixed.z))
  );
}

function moveSphereRadius(
  model: Extract<ModelPreview, { shape_type: "sphere" }>,
  delta: VectorDelta
): ModelPreview {
  const handle = {
    x: model.center.x + model.radius + delta.x,
    y: model.center.y + delta.y,
    z: model.center.z + delta.z
  };
  const radius = clamp(
    Math.hypot(handle.x - model.center.x, handle.y - model.center.y, handle.z - model.center.z),
    MIN_SIZE,
    MAX_SIZE
  );

  return withSphereRadius(model, roundValue(radius));
}

function moveCylinderRadius(
  model: Extract<ModelPreview, { shape_type: "cylinder" }>,
  direction: [number, number],
  delta: VectorDelta
): ModelPreview {
  const [dx, dz] = direction;
  const handle = {
    x: model.center.x + dx * model.radius + delta.x,
    z: model.center.z + dz * model.radius + delta.z
  };
  const radius = clamp(
    Math.hypot(handle.x - model.center.x, handle.z - model.center.z),
    MIN_SIZE,
    MAX_SIZE
  );

  return withCylinderDimensions(model, roundValue(radius), model.height);
}

function moveCylinderHeight(
  model: Extract<ModelPreview, { shape_type: "cylinder" }>,
  sign: number,
  delta: VectorDelta
): ModelPreview {
  const handleY = model.center.y + sign * (model.height / 2) + delta.y;
  const height = clamp(Math.abs(handleY - model.center.y) * 2, MIN_SIZE, MAX_SIZE);

  return withCylinderDimensions(model, model.radius, roundValue(height));
}

function getDimensions(model: ModelPreview) {
  switch (model.shape_type) {
    case "box":
      return `${model.width.toFixed(2)} x ${model.height.toFixed(2)} x ${model.depth.toFixed(2)}`;
    case "sphere":
      return `R ${model.radius.toFixed(2)}`;
    case "cylinder":
      return `R ${model.radius.toFixed(2)} / H ${model.height.toFixed(2)}`;
  }
}

function shapeLabel(shapeType: ShapeType) {
  switch (shapeType) {
    case "box":
      return "Box";
    case "sphere":
      return "Sphere";
    case "cylinder":
      return "Cylinder";
  }
}

function fallbackModels(): ModelPreview[] {
  return [
    {
      id: "box",
      label: "参数盒体",
      color: "#2f8f83",
      center: { x: 0, y: 0, z: 0 },
      shape_type: "box",
      width: 2.4,
      height: 1.2,
      depth: 1.5,
      volume: 4.32,
      bounding_box: { x: 2.4, y: 1.2, z: 1.5 }
    },
    {
      id: "sphere",
      label: "参数球体",
      color: "#c85f4f",
      center: { x: 0, y: 0, z: 0 },
      shape_type: "sphere",
      radius: 1.1,
      volume: 5.575,
      bounding_box: { x: 2.2, y: 2.2, z: 2.2 }
    },
    {
      id: "cylinder",
      label: "参数圆柱",
      color: "#d1a02f",
      center: { x: 0, y: 0, z: 0 },
      shape_type: "cylinder",
      radius: 0.85,
      height: 2.2,
      volume: 4.992,
      bounding_box: { x: 1.7, y: 2.2, z: 1.7 }
    }
  ];
}

function DragHandle({
  color = HANDLE_COLOR,
  label,
  position,
  onDrag,
  onDragStateChange
}: {
  color?: string;
  label: string;
  position: Vector3Value;
  onDrag: (delta: VectorDelta) => void;
  onDragStateChange: (isDragging: boolean) => void;
}) {
  const { camera } = useThree();
  const dragRef = useRef<{ lastPoint: THREE.Vector3; plane: THREE.Plane } | null>(null);

  function getPointerPoint(event: ThreeEvent<PointerEvent>, plane: THREE.Plane) {
    const point = new THREE.Vector3();
    return event.ray.intersectPlane(plane, point) ? point : null;
  }

  function handlePointerDown(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      new THREE.Vector3(position.x, position.y, position.z)
    );
    const point = getPointerPoint(event, plane);

    if (!point) {
      return;
    }

    dragRef.current = { lastPoint: point, plane };
    (event.target as { setPointerCapture?: (id: number) => void } | null)?.setPointerCapture?.(
      event.pointerId
    );
    onDragStateChange(true);
  }

  function handlePointerMove(event: ThreeEvent<PointerEvent>) {
    if (!dragRef.current) {
      return;
    }

    event.stopPropagation();
    const point = getPointerPoint(event, dragRef.current.plane);

    if (!point) {
      return;
    }

    const delta = point.clone().sub(dragRef.current.lastPoint);
    dragRef.current.lastPoint = point;
    onDrag({ x: delta.x, y: delta.y, z: delta.z });
  }

  function handlePointerUp(event: ThreeEvent<PointerEvent>) {
    if (!dragRef.current) {
      return;
    }

    event.stopPropagation();
    dragRef.current = null;
    (event.target as { releasePointerCapture?: (id: number) => void } | null)?.releasePointerCapture?.(
      event.pointerId
    );
    onDragStateChange(false);
  }

  return (
    <mesh
      aria-label={label}
      position={toPosition(position)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      castShadow
    >
      <sphereGeometry args={[0.09, 20, 20]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.05} />
    </mesh>
  );
}

function ModelMesh({ model }: { model: ModelPreview }) {
  return (
    <mesh position={toPosition(model.center)} castShadow receiveShadow>
      {model.shape_type === "box" && (
        <boxGeometry args={[model.width, model.height, model.depth]} />
      )}
      {model.shape_type === "sphere" && <sphereGeometry args={[model.radius, 48, 32]} />}
      {model.shape_type === "cylinder" && (
        <cylinderGeometry args={[model.radius, model.radius, model.height, 48]} />
      )}
      <meshStandardMaterial color={model.color} roughness={0.55} metalness={0.08} />
    </mesh>
  );
}

function ModelHandles({
  model,
  onDragStateChange,
  onModelChange
}: {
  model: ModelPreview;
  onDragStateChange: (isDragging: boolean) => void;
  onModelChange: (model: ModelPreview) => void;
}) {
  const centerHandle = (
    <DragHandle
      color={CENTER_HANDLE_COLOR}
      label="中心点"
      position={model.center}
      onDrag={(delta) => onModelChange(withCenter(model, addVector(model.center, delta)))}
      onDragStateChange={onDragStateChange}
    />
  );

  if (model.shape_type === "box") {
    const signs: [number, number, number][] = [
      [-1, -1, -1],
      [-1, -1, 1],
      [-1, 1, -1],
      [-1, 1, 1],
      [1, -1, -1],
      [1, -1, 1],
      [1, 1, -1],
      [1, 1, 1]
    ];

    return (
      <>
        {centerHandle}
        {signs.map((sign) => (
          <DragHandle
            key={sign.join(":")}
            label="盒体顶点"
            position={{
              x: model.center.x + sign[0] * (model.width / 2),
              y: model.center.y + sign[1] * (model.height / 2),
              z: model.center.z + sign[2] * (model.depth / 2)
            }}
            onDrag={(delta) => onModelChange(moveBoxVertex(model, sign, delta))}
            onDragStateChange={onDragStateChange}
          />
        ))}
      </>
    );
  }

  if (model.shape_type === "sphere") {
    return (
      <>
        {centerHandle}
        <DragHandle
          label="球体半径"
          position={{ x: model.center.x + model.radius, y: model.center.y, z: model.center.z }}
          onDrag={(delta) => onModelChange(moveSphereRadius(model, delta))}
          onDragStateChange={onDragStateChange}
        />
      </>
    );
  }

  const radiusDirections: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  return (
    <>
      {centerHandle}
      {radiusDirections.map((direction) => (
        <DragHandle
          key={direction.join(":")}
          label="圆柱半径"
          position={{
            x: model.center.x + direction[0] * model.radius,
            y: model.center.y,
            z: model.center.z + direction[1] * model.radius
          }}
          onDrag={(delta) => onModelChange(moveCylinderRadius(model, direction, delta))}
          onDragStateChange={onDragStateChange}
        />
      ))}
      {[-1, 1].map((sign) => (
        <DragHandle
          key={sign}
          label="圆柱高度"
          position={{
            x: model.center.x,
            y: model.center.y + sign * (model.height / 2),
            z: model.center.z
          }}
          onDrag={(delta) => onModelChange(moveCylinderHeight(model, sign, delta))}
          onDragStateChange={onDragStateChange}
        />
      ))}
    </>
  );
}

function ModelScene({
  isDragging,
  model,
  onDragStateChange,
  onModelChange
}: {
  isDragging: boolean;
  model: ModelPreview;
  onDragStateChange: (isDragging: boolean) => void;
  onModelChange: (model: ModelPreview) => void;
}) {
  return (
    <Canvas
      camera={{ position: [4, 3.2, 5], fov: 45 }}
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#f5f6f1"]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 5, 4]} intensity={1.8} castShadow />
      <Suspense fallback={null}>
        <ModelMesh model={model} />
        <ModelHandles
          model={model}
          onDragStateChange={onDragStateChange}
          onModelChange={onModelChange}
        />
        <Grid
          args={[8, 8]}
          position={[0, -1.35, 0]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#a7b4a6"
          sectionColor="#6b7868"
          fadeDistance={9}
        />
        <ContactShadows position={[0, -1.34, 0]} opacity={0.35} scale={6} blur={1.8} />
      </Suspense>
      <OrbitControls
        makeDefault
        enabled={!isDragging}
        enablePan={false}
        minDistance={3}
        maxDistance={10}
      />
    </Canvas>
  );
}

function App() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    models: fallbackModels()
  });
  const [selectedId, setSelectedId] = useState("box");
  const [isDragging, setIsDragging] = useState(false);
  const [syncStatus, setSyncStatus] = useState("等待拖动");
  const pendingModelRef = useRef<ModelPreview | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const latestRequestRef = useRef(0);

  const applyModel = useCallback((next: ModelPreview) => {
    setState((current) => ({
      ...current,
      models: updateModel(current.models, next)
    }));
  }, []);

  const requestServerPreview = useCallback(
    (model: ModelPreview) => {
      pendingModelRef.current = model;

      if (syncTimerRef.current !== null) {
        return;
      }

      syncTimerRef.current = window.setTimeout(() => {
        const pendingModel = pendingModelRef.current;
        syncTimerRef.current = null;

        if (!pendingModel) {
          return;
        }

        const requestId = latestRequestRef.current + 1;
        latestRequestRef.current = requestId;
        setSyncStatus("后端计算中");

        previewModel(modelToRequest(pendingModel))
          .then((serverModel) => {
            if (requestId !== latestRequestRef.current) {
              return;
            }

            applyModel(serverModel);
            setSyncStatus("CadQuery 已同步");
          })
          .catch((error: Error) => {
            if (requestId !== latestRequestRef.current) {
              return;
            }

            setSyncStatus(error.message);
          });
      }, PREVIEW_SYNC_MS);
    },
    [applyModel]
  );

  const handleModelChange = useCallback(
    (next: ModelPreview) => {
      applyModel(next);
      requestServerPreview(next);
    },
    [applyModel, requestServerPreview]
  );

  useEffect(() => {
    let alive = true;

    fetchModelCatalog()
      .then((models) => {
        if (!alive) {
          return;
        }

        setState({ status: "ready", models });
        setSelectedId((current) => models.find((model) => model.id === current)?.id ?? models[0].id);
      })
      .catch((error: Error) => {
        if (!alive) {
          return;
        }

        setState({ status: "error", models: fallbackModels(), error: error.message });
      });

    return () => {
      alive = false;

      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  const selectedModel = useMemo(
    () => state.models.find((model) => model.id === selectedId) ?? state.models[0],
    [selectedId, state.models]
  );

  return (
    <main className="appShell">
      <section className="viewerStage" aria-label="三维模型预览">
        <ModelScene
          isDragging={isDragging}
          model={selectedModel}
          onDragStateChange={setIsDragging}
          onModelChange={handleModelChange}
        />

        <div className="statusBar">
          <div>
            <p className="eyebrow">OpenAPI CAD</p>
            <h1>{selectedModel.label}</h1>
          </div>
          <div className={`connection ${state.status}`}>
            {state.status === "ready" && "后端已连接"}
            {state.status === "loading" && "正在连接"}
            {state.status === "error" && "使用本地预览"}
          </div>
        </div>

        <div className="interactionHint">
          拖动黑色小球调整尺寸，拖动白色小球移动中心点
        </div>

        <div className="modelTools" aria-label="模型选择">
          {state.models.map((model) => (
            <button
              key={model.id}
              className={model.id === selectedModel.id ? "active" : ""}
              type="button"
              onClick={() => setSelectedId(model.id)}
            >
              <span aria-hidden="true" style={{ background: model.color }} />
              {shapeLabel(model.shape_type)}
            </button>
          ))}
        </div>
      </section>

      <aside className="dataPanel" aria-label="模型参数">
        <img src={materialTexture} alt="材料网格纹理" className="textureSample" />
        <p className="eyebrow">参数</p>
        <h2>{getDimensions(selectedModel)}</h2>
        <dl>
          <div>
            <dt>中心点</dt>
            <dd>
              {selectedModel.center.x.toFixed(2)}, {selectedModel.center.y.toFixed(2)},{" "}
              {selectedModel.center.z.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt>体积</dt>
            <dd>{selectedModel.volume.toFixed(3)}</dd>
          </div>
          <div>
            <dt>包围盒 X</dt>
            <dd>{selectedModel.bounding_box.x.toFixed(2)}</dd>
          </div>
          <div>
            <dt>包围盒 Y</dt>
            <dd>{selectedModel.bounding_box.y.toFixed(2)}</dd>
          </div>
          <div>
            <dt>包围盒 Z</dt>
            <dd>{selectedModel.bounding_box.z.toFixed(2)}</dd>
          </div>
          <div>
            <dt>同步</dt>
            <dd>{syncStatus}</dd>
          </div>
        </dl>
        {state.status === "error" && <p className="errorText">{state.error}</p>}
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
