'use client';

import { useEffect, useRef, useState } from 'react';
import { RenderingEngine, Enums, init as coreInit, type Types } from '@cornerstonejs/core';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import {
  init as toolsInit,
  addTool,
  ToolGroupManager,
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  Enums as ToolEnums,
} from '@cornerstonejs/tools';
import styles from './DicomViewer.module.css';

let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  coreInit();
  dicomImageLoader.init({ maxWebWorkers: 1 });
  toolsInit();
  addTool(PanTool);
  addTool(ZoomTool);
  addTool(WindowLevelTool);
  addTool(StackScrollTool);
  initialized = true;
}

const RENDERING_ENGINE_ID = 'dicom-rendering-engine';
const VIEWPORT_ID = 'dicom-viewport';
const TOOL_GROUP_ID = 'dicom-tool-group';

type Props = { shareId: string; viewerToken: string };

type StudyMeta = { modality: string | null; studyDescription: string | null };

export default function DicomViewer({ shareId, viewerToken }: Props) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [sliceCount, setSliceCount] = useState(0);
  const [studyMeta, setStudyMeta] = useState<StudyMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderingEngine: RenderingEngine | null = null;

    async function setup() {
      try {
        const manifestRes = await fetch(
          `/api/studies/${shareId}/manifest?token=${encodeURIComponent(viewerToken)}`
        );
        const manifestData = await manifestRes.json();
        if (!manifestRes.ok || !manifestData.ok) {
          throw new Error(manifestData.error || 'No se pudo cargar el estudio.');
        }
        if (cancelled) return;
        setStudyMeta(manifestData.study);

        const imageIds: string[] = manifestData.instances.map(
          (instance: { id: string }) =>
            `wadouri:/api/studies/${shareId}/instances/${instance.id}?token=${encodeURIComponent(viewerToken)}`
        );

        if (imageIds.length === 0) {
          throw new Error('El estudio no tiene imágenes.');
        }

        ensureInitialized();

        if (!elementRef.current || cancelled) return;

        renderingEngine = new RenderingEngine(RENDERING_ENGINE_ID);
        renderingEngine.enableElement({
          viewportId: VIEWPORT_ID,
          type: Enums.ViewportType.STACK,
          element: elementRef.current,
        });

        const viewport = renderingEngine.getViewport(VIEWPORT_ID) as Types.IStackViewport;
        await viewport.setStack(imageIds, 0);
        viewport.render();

        const toolGroup = ToolGroupManager.getToolGroup(TOOL_GROUP_ID) ?? ToolGroupManager.createToolGroup(TOOL_GROUP_ID);
        if (toolGroup) {
          toolGroup.addTool(WindowLevelTool.toolName);
          toolGroup.addTool(ZoomTool.toolName);
          toolGroup.addTool(PanTool.toolName);
          toolGroup.addTool(StackScrollTool.toolName);
          toolGroup.addViewport(VIEWPORT_ID, RENDERING_ENGINE_ID);

          toolGroup.setToolActive(WindowLevelTool.toolName, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
          });
          toolGroup.setToolActive(ZoomTool.toolName, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }],
          });
          toolGroup.setToolActive(PanTool.toolName, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }],
          });
          toolGroup.setToolActive(StackScrollTool.toolName, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Wheel }],
          });
        }

        if (!cancelled) {
          setSliceCount(imageIds.length);
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : 'No se pudo cargar el visor.');
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      try {
        ToolGroupManager.destroyToolGroup(TOOL_GROUP_ID);
      } catch {
        /* el grupo de herramientas no llegó a crearse */
      }
      renderingEngine?.destroy();
    };
  }, [shareId, viewerToken]);

  return (
    <div className={styles.wrap}>
      {studyMeta && (
        <div className={styles.header}>
          <span>{studyMeta.studyDescription || 'Estudio DICOM'}</span>
          {studyMeta.modality && <span className={styles.modality}>{studyMeta.modality}</span>}
        </div>
      )}

      <div ref={elementRef} className={styles.viewport} />

      {status === 'loading' && <p className={styles.status}>Cargando estudio…</p>}
      {status === 'error' && <p className={styles.statusError}>{errorMsg}</p>}
      {status === 'ready' && (
        <p className={styles.hint}>
          Clic izquierdo: brillo/contraste · Clic derecho: zoom · Clic central: mover
          {sliceCount > 1 ? ' · Rueda del mouse: cambiar corte' : ''}
        </p>
      )}
    </div>
  );
}
