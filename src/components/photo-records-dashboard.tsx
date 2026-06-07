"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, CheckCircle2, ChevronRight, ImagePlus, Images, Loader2, Pencil, Trash2 } from "lucide-react";

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
  compareHref?: string;
};

const viewOptions: Array<{ value: DentalPhotoViewType; label: string; helper: string }> = [
  { value: "front", label: "正面", helper: "自然咬合，手机与牙齿正对。" },
  { value: "upper", label: "上牙弓", helper: "拍清上排牙弓，保持光线稳定。" },
  { value: "lower", label: "下牙弓", helper: "拍清下排牙弓，尽量同一距离。" },
  { value: "left", label: "左侧咬合", helper: "左侧咬合关系，避免斜拍。" },
  { value: "right", label: "右侧咬合", helper: "右侧咬合关系，角度和左侧对应。" },
  { value: "bite", label: "咬合面", helper: "上下牙轻咬，记录咬合面变化。" },
  { value: "other", label: "侧颜/其他", helper: "补充侧面观察、医生要求或特殊情况照片。" }
];

const standardViewTypes: DentalPhotoViewType[] = ["front", "upper", "lower", "left", "right", "bite"];
const maxUploadBytes = 650_000;

export function PhotoRecordsDashboard(props: PhotoRecordsDashboardProps = {}) {
  const [photos, setPhotos] = useState<DentalPhotoRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<DentalPhotoRecord | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<DentalPhotoRecord | null>(null);
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
    return payload.photos;
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
      const nextPhotos = await loadPhotos();
      setDraft((current) => ({
        ...current,
        note: "",
        viewType: getNextMissingViewType(nextPhotos, current, props.embeddedDate) ?? current.viewType
      }));
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

  async function updatePhoto(photoId: string, nextDraft: UploadDraft) {
    setPending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: timeZoneHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          date: nextDraft.date,
          stageName: nextDraft.stageName,
          trayNumber: nextDraft.trayNumber ? Number(nextDraft.trayNumber) : null,
          viewType: nextDraft.viewType,
          note: nextDraft.note
        })
      });
      const payload = await response.json() as { photo?: DentalPhotoRecord; error?: string };

      if (!response.ok || !payload.photo) {
        throw new Error(payload.error ?? "无法保存照片信息。");
      }

      setPhotos((current) => current.map((photo) => photo.id === photoId ? payload.photo! : photo));
      setPreviewPhoto((current) => current?.id === photoId ? payload.photo! : current);
      setEditingPhoto(null);
      setMessage("已更新照片信息。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "无法保存照片信息。");
    } finally {
      setPending(false);
    }
  }

  const selectedPhotos = useMemo(() => selectedIds
    .map((id) => photos.find((photo) => photo.id === id))
    .filter((photo): photo is DentalPhotoRecord => Boolean(photo)), [photos, selectedIds]);
  const visiblePhotos = props.embeddedDate ? photos.filter((photo) => photo.date === props.embeddedDate) : photos;
  const standardCoverage = useMemo(() => getStandardCoverage(photos, draft, props.embeddedDate), [draft, photos, props.embeddedDate]);
  const sameViewSuggestions = useMemo(() => getSameViewCompareSuggestions(visiblePhotos), [visiblePhotos]);
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
      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-sm">
        <StandardPhotoChecklist
          coverage={standardCoverage}
          helper={props.helper}
          photoCount={visiblePhotos.length}
          title={props.title}
          compareHref={props.compareHref}
          onPick={(viewType) => {
            setDraft((current) => ({ ...current, viewType }));
            setUploadOpen(true);
          }}
          onOpenUpload={() => setUploadOpen(true)}
        />

        {(!props.deferUploadForm || uploadOpen) ? (
          <div className={props.deferUploadForm ? "fixed inset-0 z-40 flex items-end bg-ink/35 p-3 backdrop-blur-sm" : ""}>
            <div className={props.deferUploadForm ? "max-h-[88vh] w-full overflow-y-auto rounded-xl bg-white p-4 shadow-2xl" : "mt-4"}>
              {props.deferUploadForm ? (
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.16em] text-sage">拍照任务</p>
                    <h3 className="mt-1 font-semibold text-ink">新增{viewLabel(draft.viewType)}照片</h3>
                    <p className="mt-1 text-xs leading-5 text-ink/55">{viewHelper(draft.viewType)}</p>
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
            {visiblePhotos.length ? (
              <div className="grid grid-cols-3 gap-2">
                {visiblePhotos.map((photo) => (
                  <PhotoThumbnail
                    key={photo.id}
                    onOpen={() => setPreviewPhoto(photo)}
                    photo={photo}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-ink/15 bg-mist/50 p-4 text-sm leading-6 text-ink/60">
                这一天还没有照片记录。点击“新增”后可以拍照或从相册选择已有照片。
              </div>
            )}
          </div>
        ) : null}

        {previewPhoto ? (
          <PhotoPreviewModal
            onClose={() => setPreviewPhoto(null)}
            onDelete={() => {
              deletePhoto(previewPhoto.id).then(() => setPreviewPhoto(null)).catch(() => undefined);
            }}
            onEdit={() => setEditingPhoto(previewPhoto)}
            pending={pending}
            photo={previewPhoto}
          />
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
          <>
            {selectedPhotos[0]?.viewType !== selectedPhotos[1]?.viewType ? (
              <p className="mt-4 rounded-md border border-amber/20 bg-amber/10 p-3 text-xs leading-5 text-ink/60">
                两张照片角度不同，建议改选同角度照片再比较。
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-3">
              {selectedPhotos.map((photo) => (
                <PhotoCompareCard key={photo.id} photo={photo} />
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-md bg-mist/70 p-3 text-sm leading-6 text-ink/60">
            当前已选择 {selectedPhotos.length}/2 张。请尽量选择相同角度照片，对比才有意义。
          </p>
        )}
        {sameViewSuggestions.length ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold tracking-[0.16em] text-ink/45">同角度快速对比</p>
            {sameViewSuggestions.map((suggestion) => (
              <button
                className="flex min-h-11 w-full items-center justify-between rounded-md border border-ink/10 bg-mist/50 px-3 text-left text-sm"
                key={suggestion.viewType}
                onClick={() => setSelectedIds(suggestion.photos.map((photo) => photo.id))}
                type="button"
              >
                <span className="font-semibold text-ink">{viewLabel(suggestion.viewType)}</span>
                <span className="text-xs text-ink/55">{suggestion.photos[1].date} → {suggestion.photos[0].date}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>
      ) : null}

      {!showInlinePhotoList ? (
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ink">{props.compact ? "当天照片" : "照片档案"}</h2>
        {visiblePhotos.length ? visiblePhotos.map((photo) => (
          <PhotoCard
            key={photo.id}
            onDelete={() => deletePhoto(photo.id)}
            onEdit={() => setEditingPhoto(photo)}
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

      {editingPhoto ? (
        <PhotoEditModal
          dateLocked={Boolean(props.embeddedDate)}
          message={message}
          onClose={() => setEditingPhoto(null)}
          onSubmit={(nextDraft) => updatePhoto(editingPhoto.id, nextDraft)}
          pending={pending}
          photo={editingPhoto}
        />
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
        <div className="rounded-md border border-[#91cfc3]/25 bg-[#d6f2ec]/45 p-3 text-xs leading-5 text-ink/60">
          当前任务：{viewLabel(props.draft.viewType)}。{viewHelper(props.draft.viewType)}
        </div>
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

function StandardPhotoChecklist(props: {
  coverage: Array<{ viewType: DentalPhotoViewType; label: string; helper: string; captured: boolean }>;
  compareHref?: string;
  helper?: string;
  photoCount: number;
  title?: string;
  onOpenUpload: () => void;
  onPick: (viewType: DentalPhotoViewType) => void;
}) {
  const capturedCount = props.coverage.filter((item) => item.captured).length;
  const nextMissing = props.coverage.find((item) => !item.captured);
  const completionPercent = Math.round((capturedCount / props.coverage.length) * 100);

  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-br from-[#d6f2ec] via-[#f7efe8] to-[#ffe4e7] p-4">
        <div className="pointer-events-none absolute -right-10 top-12 h-32 w-32 rounded-full bg-white/30 blur-xl" />
        <div className="pointer-events-none absolute -left-12 bottom-5 h-28 w-28 rounded-full bg-[#ffeeb3]/45 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-sage">我的整牙日记</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{props.title ?? "阶段照片"}</h2>
            <p className="mt-1 text-sm leading-6 text-ink/60">
              {props.helper ?? "按同一组角度记录变化，照片仅用于自我复盘。"}
            </p>
          </div>
          <div className="shrink-0 rounded-full bg-[#fff6bd] px-3 py-1 text-sm font-semibold text-ink shadow-sm">
            {capturedCount}/6
          </div>
        </div>

        <div className="relative mt-4 rounded-[1.25rem] border border-white/60 bg-white/75 p-3 shadow-sm">
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[#69ad9e]" style={{ width: `${completionPercent}%` }} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-ink/45">下一张建议</p>
              <p className="mt-1 text-lg font-semibold text-ink">{nextMissing ? nextMissing.label : "本组已完整"}</p>
              <p className="mt-1 text-xs leading-5 text-ink/55">
                {nextMissing ? nextMissing.helper : "可以进入阶段对比，查看同角度变化。"}
              </p>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#91cfc3]/25 text-sage">
              {nextMissing ? <Camera className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}
            </div>
          </div>

          <button
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#69ad9e] px-4 text-sm font-semibold text-white shadow-sm disabled:opacity-70"
            onClick={() => nextMissing ? props.onPick(nextMissing.viewType) : props.onOpenUpload()}
            type="button"
          >
            <ImagePlus className="h-4 w-4" />
            {nextMissing ? `拍摄${nextMissing.label}` : "继续新增照片"}
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-ink/10 bg-white/70 px-3 text-xs font-semibold text-ink"
              onClick={props.onOpenUpload}
              type="button"
            >
              <Camera className="h-4 w-4" />
              自选角度
            </button>
            {props.compareHref ? (
              <button
                className="flex min-h-10 items-center justify-center gap-2 rounded-md border border-ink/10 bg-white/70 px-3 text-xs font-semibold text-ink"
                onClick={() => { window.location.href = props.compareHref!; }}
                type="button"
              >
                <Images className="h-4 w-4" />
                阶段对比
              </button>
            ) : (
              <div className="flex min-h-10 items-center justify-center rounded-md border border-ink/10 bg-white/40 px-3 text-xs text-ink/45">
                已有 {props.photoCount} 张
              </div>
            )}
          </div>
        </div>

        <div className="relative mt-3 rounded-xl border border-white/60 bg-white/45 px-3 py-2 text-xs leading-5 text-ink/55">
          想参考侧脸变化时，用“侧颜/其他”记录同光线、同距离照片即可；本应用不做嘴凸角度测量或治疗判断。
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        {props.coverage.map((item) => (
          <button
            className={`min-h-20 rounded-md border px-3 py-2 text-left transition ${item.captured ? "border-mint/25 bg-mint/5 text-ink" : "border-amber/25 bg-white text-ink"}`}
            key={item.viewType}
            onClick={() => props.onPick(item.viewType)}
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{item.label}</span>
              {item.captured ? <CheckCircle2 className="h-4 w-4 text-mint" /> : <ChevronRight className="h-4 w-4 text-amber" />}
            </div>
            <p className="mt-1 text-[0.7rem] leading-4 text-ink/50">{item.helper}</p>
          </button>
        ))}
      </div>
      <p className="px-3 pb-3 text-xs leading-5 text-ink/45">
        侧颜、嘴凸或贴合变化仅做长期观察记录；是否调整牙套请以牙医/正畸医生指导为准。
      </p>
    </div>
  );
}

function PhotoCard(props: {
  photo: DentalPhotoRecord;
  selected: boolean;
  onToggleCompare: () => void;
  onDelete: () => void;
  onEdit: () => void;
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
          <div className="flex shrink-0 gap-2">
            <button
              className="rounded-full border border-ink/10 p-2 text-ink/50"
              onClick={props.onEdit}
              type="button"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-full border border-ink/10 p-2 text-ink/50"
              onClick={props.onDelete}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
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

function PhotoThumbnail(props: {
  photo: DentalPhotoRecord;
  onOpen: () => void;
}) {
  return (
    <button
      className="overflow-hidden rounded-lg border border-ink/10 bg-white text-left shadow-sm"
      onClick={props.onOpen}
      type="button"
    >
      <img alt={photoTitle(props.photo)} className="aspect-square w-full object-cover" src={props.photo.imageDataUrl} />
      <div className="p-2">
        <p className="truncate text-xs font-semibold text-ink">{viewLabel(props.photo.viewType)}</p>
        <p className="mt-0.5 truncate text-[11px] text-ink/50">
          {props.photo.trayNumber ? `第${props.photo.trayNumber}副` : props.photo.stageName || "阶段照片"}
        </p>
      </div>
    </button>
  );
}

function PhotoPreviewModal(props: {
  photo: DentalPhotoRecord;
  pending: boolean;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/35 p-3 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full overflow-y-auto rounded-xl bg-white shadow-2xl">
        <img alt={photoTitle(props.photo)} className="max-h-[56vh] w-full object-contain bg-ink/5" src={props.photo.imageDataUrl} />
        <div className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink">{photoTitle(props.photo)}</h3>
              <p className="mt-1 text-sm text-ink/60">
                {viewLabel(props.photo.viewType)} · {formatSize(props.photo.imageSizeBytes)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
                onClick={props.onEdit}
                type="button"
              >
                编辑
              </button>
              <button
                className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
                onClick={props.onClose}
                type="button"
              >
                关闭
              </button>
            </div>
          </div>
          {props.photo.note ? <p className="rounded-md bg-mist/60 p-3 text-sm leading-6 text-ink/70">{props.photo.note}</p> : null}
          <button
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-coral/25 px-4 text-sm font-semibold text-coral disabled:opacity-60"
            disabled={props.pending}
            onClick={props.onDelete}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            删除这张照片
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoEditModal(props: {
  photo: DentalPhotoRecord;
  pending: boolean;
  message: string | null;
  dateLocked: boolean;
  onClose: () => void;
  onSubmit: (draft: UploadDraft) => void;
}) {
  const [draft, setDraft] = useState<UploadDraft>(() => photoToDraft(props.photo));

  useEffect(() => {
    setDraft(photoToDraft(props.photo));
  }, [props.photo]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/35 p-3 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full overflow-y-auto rounded-xl bg-white p-4 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink">编辑照片信息</h3>
            <p className="mt-1 text-xs leading-5 text-ink/55">可修改日期、阶段、副数、角度和备注；原照片不会被替换。</p>
          </div>
          <button
            className="rounded-full border border-ink/10 px-3 py-1 text-xs font-semibold text-ink"
            onClick={props.onClose}
            type="button"
          >
            关闭
          </button>
        </div>
        <PhotoMetadataForm
          dateLocked={props.dateLocked}
          draft={draft}
          message={props.message}
          onDraftChange={setDraft}
          onSubmit={() => props.onSubmit(draft)}
          pending={props.pending}
          submitLabel="保存修改"
        />
      </div>
    </div>
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

function PhotoMetadataForm(props: {
  draft: UploadDraft;
  message: string | null;
  pending: boolean;
  dateLocked: boolean;
  submitLabel: string;
  onDraftChange: (draft: UploadDraft) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-3">
      <PhotoMetadataFields
        dateLocked={props.dateLocked}
        draft={props.draft}
        onDraftChange={props.onDraftChange}
      />
      <button
        className="w-full rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={props.pending}
        onClick={props.onSubmit}
        type="button"
      >
        {props.pending ? "保存中..." : props.submitLabel}
      </button>
      {props.message ? <p className="text-sm text-ink/60">{props.message}</p> : null}
    </div>
  );
}

function PhotoMetadataFields(props: {
  draft: UploadDraft;
  dateLocked: boolean;
  onDraftChange: (draft: UploadDraft) => void;
}) {
  const selectedView = viewOptions.find((option) => option.value === props.draft.viewType);

  return (
    <>
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
        {selectedView ? <span className="mt-1 block text-xs leading-5 text-ink/50">{selectedView.helper}</span> : null}
      </label>

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
    </>
  );
}

function photoToDraft(photo: DentalPhotoRecord): UploadDraft {
  return {
    date: photo.date,
    stageName: photo.stageName,
    trayNumber: photo.trayNumber ? String(photo.trayNumber) : "",
    viewType: photo.viewType,
    note: photo.note
  };
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

function viewHelper(viewType: DentalPhotoViewType) {
  return viewOptions.find((option) => option.value === viewType)?.helper ?? "";
}

function getStandardCoverage(photos: DentalPhotoRecord[], draft: UploadDraft, embeddedDate?: string) {
  const targetPhotos = photos.filter((photo) => {
    if (embeddedDate && photo.date !== embeddedDate) {
      return false;
    }

    if (draft.trayNumber && photo.trayNumber !== Number(draft.trayNumber)) {
      return false;
    }

    if (draft.stageName && photo.stageName && photo.stageName !== draft.stageName) {
      return false;
    }

    return true;
  });

  return standardViewTypes.map((viewType) => {
    const option = viewOptions.find((item) => item.value === viewType)!;

    return {
      viewType,
      label: option.label,
      helper: option.helper,
      captured: targetPhotos.some((photo) => photo.viewType === viewType)
    };
  });
}

function getNextMissingViewType(photos: DentalPhotoRecord[], draft: UploadDraft, embeddedDate?: string) {
  return getStandardCoverage(photos, draft, embeddedDate).find((item) => !item.captured)?.viewType ?? null;
}

function getSameViewCompareSuggestions(photos: DentalPhotoRecord[]) {
  return standardViewTypes
    .map((viewType) => {
      const sameView = photos
        .filter((photo) => photo.viewType === viewType)
        .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
        .slice(0, 2);

      return sameView.length === 2 ? { viewType, photos: sameView } : null;
    })
    .filter((item): item is { viewType: DentalPhotoViewType; photos: DentalPhotoRecord[] } => Boolean(item));
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
