"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { getClientDateKey, timeZoneHeaders } from "@/lib/client-time-zone";
import type { DentalPhotoRecord, DentalPhotoViewType, PlanProgress, TreatmentSeries } from "@/lib/types";

import { SetupWarning } from "./setup-warning";

type PhotosPayload = {
  photos: DentalPhotoRecord[];
};

type SettingsPayload = {
  activeSeries: TreatmentSeries | null;
  planProgress: PlanProgress | null;
};

type UploadDraft = {
  date: string;
  stageName: string;
  trayNumber: string;
  viewType: DentalPhotoViewType;
  note: string;
};

type PhotoRecordsDashboardProps = {
  embeddedDate?: string;
  compact?: boolean;
  title?: string;
  helper?: string;
  deferUploadForm?: boolean;
  hideCompare?: boolean;
};

const viewOptions: Array<{ value: DentalPhotoViewType; label: string }> = [
  { value: "front", label: "正面" },
  { value: "upper", label: "上牙弓" },
  { value: "lower", label: "下牙弓" },
  { value: "left", label: "左侧咬合" },
  { value: "right", label: "右侧咬合" },
  { value: "bite", label: "咬合面" },
  { value: "other", label: "其他" }
];

const maxUploadBytes = 650_000;

export function PhotoRecordsDashboard(props: PhotoRecordsDashboardProps = {}) {
  const [photos, setPhotos] = useState<DentalPhotoRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<UploadDraft>(() => ({
    date: props.embeddedDate ?? getClientDateKey(),
    stageName: "",
    trayNumber: "",
    viewType: "front",
    note: ""
  }));

  useEffect(() => {
    if (!props.embeddedDate) {
      return;
    }

    setDraft((current) => ({ ...current, date: props.embeddedDate ?? current.date }));
  }, [props.embeddedDate]);

  useEffect(() => {
    Promise.all([loadPhotos(), loadPlanDefaults()]).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  async function loadPhotos() {
    const response = await fetch("/api/photos", { headers: timeZoneHeaders() });
    const payload = await response.json() as PhotosPayload & { error?: string };

    if (!response.ok) {
      throw new Error(payload.error ?? "无法载入照片记录。");
    }

    setPhotos(payload.photos);
  }

  async function loadPlanDefaults() {
    const response = await fetch("/api/settings", { headers: timeZoneHeaders() });
    const payload = await response.json() as SettingsPayload & { error?: string };

    if (!response.ok) {
      return;
    }

    setDraft((current) => ({
      ...current,
      stageName: current.stageName || payload.activeSeries?.name || "",
      trayNumber: current.trayNumber || (payload.planProgress?.currentTrayNumber ? String(payload.planProgress.currentTrayNumber) : "")
    }));
  }

  async function uploadPhoto() {
    if (!selectedFile) {
      setMessage("请先选择或拍摄一张照片。");
      return;
    }

    setPending(true);
    setMessage(null);

    try {
      const image = await compressImage(selectedFile);
      const response = await fetch("/api/photos", {
        method: "POST",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          date: draft.date,
          stageName: draft.stageName,
          trayNumber: draft.trayNumber ? Number(draft.trayNumber) : null,
          viewType: draft.viewType,
          note: draft.note,
          imageDataUrl: image.dataUrl,
          imageMimeType: image.mimeType,
          imageSizeBytes: image.sizeBytes
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法保存照片记录。");
      }

      setSelectedFile(null);
      setDraft((current) => ({ ...current, note: "" }));
      await loadPhotos();
      setMessage("已保存照片记录。");
      setUploadOpen(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "无法保存照片记录。");
    } finally {
      setPending(false);
    }
  }

  async function deletePhoto(photoId: string) {
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: "DELETE",
        headers: timeZoneHeaders()
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "无法删除照片记录。");
      }

      setSelectedIds((ids) => ids.filter((id) => id !== photoId));
      await loadPhotos();
      setMessage("已删除照片记录。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "无法删除照片记录。");
    } finally {
      setPending(false);
    }
  }

  const selectedPhotos = useMemo(() => selectedIds
    .map((id) => photos.find((photo) => photo.id === id))
    .filter((photo): photo is DentalPhotoRecord => Boolean(photo)), [photos, selectedIds]);
  const visiblePhotos = props.embeddedDate ? photos.filter((photo) => photo.date === props.embeddedDate) : photos;
  const showInlinePhotoList = Boolean(props.compact && props.deferUploadForm);

  if (error) {
    return <SetupWarning message={error} />;
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-md border border-ink/10 bg-white/75">
        <Loader2 className="h-6 w-6 animate-spin text-sage" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-full bg-rose/15 p-2 text-rose">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">{props.title ?? "新增阶段照片"}</h2>
              <p className="mt-1 text-sm leading-6 text-ink/60">
                {props.helper ?? "建议在相同角度、光线和距离下拍摄。照片仅用于自我记录，不提供诊断或换牙套建议。"}
              </p>
            </div>
          </div>
          {props.deferUploadForm ? (
            <button
              className="shrink-0 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white"
              onClick={() => setUploadOpen(true)}
              type="button"
            >
              新增
            </button>
          ) : null}
        </div>

        {props.deferUploadForm && !uploadOpen ? (
          <p className="mt-3 text-xs leading-5 text-ink/50">
            {visiblePhotos.length ? `已有 ${visiblePhotos.length} 张照片。` : "还没有照片记录。点击“新增”后再填写照片信息。"}
          </p>
        ) : null}

        {(!props.deferUploadForm || uploadOpen) ? (
          <div className={props.deferUploadForm ? "fixed inset-0 z-40 flex items-end bg-ink/35 p-3 backdrop-blur-sm" : ""}>
            <div className={props.deferUploadForm ? "max-h-[88vh] w-full overflow-y-auto rounded-xl bg-white p-4 shadow-2xl" : "mt-4"}>
              {props.deferUploadForm ? (
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">新增阶段照片</h3>
                    <p className="mt-1 text-xs leading-5 text-ink/55">保存后会变成独立照片卡片。</p>
                  </div>
                  <button
                    className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
                    onClick={() => setUploadOpen(false)}
                    type="button"
                  >
                    关闭
                  </button>
                </div>
              ) : null}
              <PhotoUploadForm
                draft={draft}
                message={message}
                onDraftChange={setDraft}
                onFileChange={setSelectedFile}
                onSubmit={uploadPhoto}
                pending={pending}
                selectedFile={selectedFile}
                dateLocked={Boolean(props.embeddedDate)}
              />
            </div>
          </div>
        ) : null}

        {showInlinePhotoList ? (
          <div className="mt-4 space-y-3">
            {visiblePhotos.length ? visiblePhotos.map((photo) => (
              <PhotoCard
                key={photo.id}
                onDelete={() => deletePhoto(photo.id)}
                onToggleCompare={() => toggleCompare(photo.id, selectedIds, setSelectedIds)}
                photo={photo}
                selected={selectedIds.includes(photo.id)}
                showCompareAction={!props.hideCompare}
              />
            )) : (
              <div className="rounded-lg border border-dashed border-ink/15 bg-mist/50 p-4 text-sm leading-6 text-ink/60">
                这一天还没有照片记录。点击“新增”后可以拍照或从相册选择已有照片。
              </div>
            )}
          </div>
        ) : null}
      </section>

      {!props.hideCompare ? (
      <section className="rounded-lg border border-ink/10 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">阶段对比</h2>
            <p className="mt-1 text-sm text-ink/60">选择两张照片后可并排查看。</p>
          </div>
          <button
            className="rounded-full border border-ink/10 px-3 py-1 text-xs font-medium text-ink/60"
            onClick={() => setSelectedIds([])}
            type="button"
          >
            清空
          </button>
        </div>

        {selectedPhotos.length === 2 ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {selectedPhotos.map((photo) => (
              <PhotoCompareCard key={photo.id} photo={photo} />
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-md bg-mist/70 p-3 text-sm leading-6 text-ink/60">
            当前已选择 {selectedPhotos.length}/2 张。请尽量选择相同角度照片，对比才有意义。
          </p>
        )}
      </section>
      ) : null}

      {!showInlinePhotoList ? (
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">{props.compact ? "当天照片" : "照片档案"}</h2>
        {visiblePhotos.length ? visiblePhotos.map((photo) => (
          <PhotoCard
            key={photo.id}
            onDelete={() => deletePhoto(photo.id)}
            onToggleCompare={() => toggleCompare(photo.id, selectedIds, setSelectedIds)}
            photo={photo}
            selected={selectedIds.includes(photo.id)}
          />
        )) : (
          <div className="rounded-lg border border-ink/10 bg-white/80 p-4 text-sm leading-6 text-ink/60">
            {props.embeddedDate ? "这一天还没有照片记录。" : "还没有照片记录。可以从当前阶段开始拍一张正面照，后续每次换期或复诊前补充同角度照片。"}
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
}

function PhotoUploadForm(props: {
  draft: UploadDraft;
  selectedFile: File | null;
  message: string | null;
  pending: boolean;
  dateLocked: boolean;
  onDraftChange: (draft: UploadDraft) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-ink">
        拍摄日期
        <input
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
          disabled={props.dateLocked}
          onChange={(event) => props.onDraftChange({ ...props.draft, date: event.target.value })}
          type="date"
          value={props.draft.date}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-ink">
          阶段
          <input
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            maxLength={80}
            onChange={(event) => props.onDraftChange({ ...props.draft, stageName: event.target.value })}
            placeholder="如：第一阶段"
            value={props.draft.stageName}
          />
        </label>
        <label className="block text-sm font-medium text-ink">
          当前副数
          <input
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            inputMode="numeric"
            min={1}
            onChange={(event) => props.onDraftChange({ ...props.draft, trayNumber: event.target.value })}
            placeholder="如：12"
            type="number"
            value={props.draft.trayNumber}
          />
        </label>
      </div>

      <label className="block text-sm font-medium text-ink">
        拍摄角度
        <select
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
          onChange={(event) => props.onDraftChange({ ...props.draft, viewType: event.target.value as DentalPhotoViewType })}
          value={props.draft.viewType}
        >
          {viewOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <div className="space-y-2">
        <p className="text-sm font-medium text-ink">照片</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-dashed border-ink/20 bg-mist/50 px-3 text-sm font-semibold text-ink">
            拍照上传
            <input
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-md border border-ink/15 bg-white px-3 text-sm font-semibold text-ink">
            从相册选择
            <input
              accept="image/*"
              className="sr-only"
              onChange={(event) => props.onFileChange(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
        </div>
        <p className="text-xs leading-5 text-ink/50">
          {props.selectedFile ? `已选择：${props.selectedFile.name}` : "可以现场拍照，也可以从手机相册选择已有照片。"}
        </p>
      </div>

      <label className="block text-sm font-medium text-ink">
        备注
        <textarea
          className="mt-1 min-h-20 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
          maxLength={1000}
          onChange={(event) => props.onDraftChange({ ...props.draft, note: event.target.value })}
          placeholder="如：第12副第3天，感觉右侧咬合更贴合。"
          value={props.draft.note}
        />
      </label>

      <button
        className="w-full rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={props.pending}
        onClick={props.onSubmit}
        type="button"
      >
        {props.pending ? "保存中..." : "保存照片记录"}
      </button>
      {props.message ? <p className="text-sm text-ink/60">{props.message}</p> : null}
    </div>
  );
}

function PhotoCard(props: {
  photo: DentalPhotoRecord;
  selected: boolean;
  onToggleCompare: () => void;
  onDelete: () => void;
  showCompareAction?: boolean;
}) {
  return (
    <article className={`overflow-hidden rounded-lg border bg-white shadow-sm ${props.selected ? "border-rose ring-2 ring-rose/20" : "border-ink/10"}`}>
      <img alt={photoTitle(props.photo)} className="h-56 w-full object-cover" src={props.photo.imageDataUrl} />
      <div className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-ink">{photoTitle(props.photo)}</p>
            <p className="text-sm text-ink/60">{viewLabel(props.photo.viewType)} · {formatSize(props.photo.imageSizeBytes)}</p>
          </div>
          <button
            className="rounded-full border border-ink/10 p-2 text-ink/50"
            onClick={props.onDelete}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {props.photo.note ? <p className="rounded-md bg-mist/60 p-3 text-sm leading-6 text-ink/70">{props.photo.note}</p> : null}
        {props.showCompareAction === false ? null : (
          <button
            className={`w-full rounded-md px-3 py-2 text-sm font-semibold ${props.selected ? "bg-rose/15 text-rose" : "bg-mist text-ink"}`}
            onClick={props.onToggleCompare}
            type="button"
          >
            {props.selected ? "已加入对比" : "选择对比"}
          </button>
        )}
      </div>
    </article>
  );
}

function PhotoCompareCard({ photo }: { photo: DentalPhotoRecord }) {
  return (
    <div className="overflow-hidden rounded-md border border-ink/10 bg-mist/40">
      <img alt={photoTitle(photo)} className="h-44 w-full object-cover" src={photo.imageDataUrl} />
      <div className="p-2">
        <p className="text-sm font-semibold text-ink">{photo.date}</p>
        <p className="text-xs leading-5 text-ink/60">{viewLabel(photo.viewType)} · {photo.trayNumber ? `第${photo.trayNumber}副` : "未填副数"}</p>
      </div>
    </div>
  );
}

function toggleCompare(photoId: string, selectedIds: string[], setSelectedIds: (ids: string[]) => void) {
  if (selectedIds.includes(photoId)) {
    setSelectedIds(selectedIds.filter((id) => id !== photoId));
    return;
  }

  setSelectedIds([...selectedIds.slice(-1), photoId]);
}

function photoTitle(photo: DentalPhotoRecord) {
  const tray = photo.trayNumber ? ` · 第${photo.trayNumber}副` : "";
  const stage = photo.stageName ? ` · ${photo.stageName}` : "";

  return `${photo.date}${stage}${tray}`;
}

function viewLabel(viewType: DentalPhotoViewType) {
  return viewOptions.find((option) => option.value === viewType)?.label ?? "其他";
}

function formatSize(bytes: number) {
  return `${Math.round(bytes / 1024)}KB`;
}

async function compressImage(file: File): Promise<{ dataUrl: string; mimeType: "image/jpeg"; sizeBytes: number }> {
  const bitmap = await loadBitmap(file);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("当前浏览器无法处理这张照片。");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.76, 0.68, 0.58, 0.48]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const sizeBytes = estimateDataUrlBytes(dataUrl);

    if (sizeBytes <= maxUploadBytes) {
      return { dataUrl, mimeType: "image/jpeg", sizeBytes };
    }
  }

  throw new Error("照片压缩后仍过大，请裁剪或换一张更小的照片。");
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("无法读取这张照片。"));
    img.src = URL.createObjectURL(file);
  });
}

function estimateDataUrlBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";

  return Math.ceil((base64.length * 3) / 4);
}
