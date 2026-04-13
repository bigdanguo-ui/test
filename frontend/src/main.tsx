import { StrictMode, Suspense, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";

import { fetchModelCatalog, type ModelPreview, type ShapeType } from "./api/models";
import { materialTexture } from "./assets/materialTexture";
import "./styles.css";

type LoadState =
  | { status: "loading"; models: ModelPreview[]; error?: never }
  | { status: "ready"; models: ModelPreview[]; error?: never }
  | { status: "error"; models: ModelPreview[]; error: string };

function ModelMesh({ model }: { model: ModelPreview }) {
  const scale = 1.15;

  return (
    <mesh rotation={[0.15, -0.45, 0]} castShadow receiveShadow scale={scale}>
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

function ModelScene({ model }: { model: ModelPreview }) {
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
        <Grid
          args={[6, 6]}
          position={[0, -1.35, 0]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#a7b4a6"
          sectionColor="#6b7868"
          fadeDistance={8}
        />
        <ContactShadows position={[0, -1.34, 0]} opacity={0.35} scale={6} blur={1.8} />
      </Suspense>
      <OrbitControls makeDefault enablePan={false} minDistance={3} maxDistance={8} />
    </Canvas>
  );
}

function getDimensions(model: ModelPreview) {
  switch (model.shape_type) {
    case "box":
      return `${model.width} x ${model.height} x ${model.depth}`;
    case "sphere":
      return `R ${model.radius}`;
    case "cylinder":
      return `R ${model.radius} / H ${model.height}`;
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
      shape_type: "sphere",
      radius: 1.1,
      volume: 5.575,
      bounding_box: { x: 2.2, y: 2.2, z: 2.2 }
    },
    {
      id: "cylinder",
      label: "参数圆柱",
      color: "#d1a02f",
      shape_type: "cylinder",
      radius: 0.85,
      height: 2.2,
      volume: 4.992,
      bounding_box: { x: 1.7, y: 1.7, z: 2.2 }
    }
  ];
}

function App() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    models: fallbackModels()
  });
  const [selectedId, setSelectedId] = useState("box");

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
    };
  }, []);

  const selectedModel = useMemo(
    () => state.models.find((model) => model.id === selectedId) ?? state.models[0],
    [selectedId, state.models]
  );

  return (
    <main className="appShell">
      <section className="viewerStage" aria-label="三维模型预览">
        <ModelScene model={selectedModel} />

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
