import { addDaysToDateKey, todayKey } from "@/lib/dates";
import { calculateDailySummaries, calculateHistoryMetrics } from "@/lib/summaries";
import { calculatePlanProgress } from "@/lib/treatment-plan";
import type { DailySummary, OffTraySession, PlanProgress, ReminderSettings, TreatmentExceptionEvent, TreatmentPlan, TreatmentSeries, WearState } from "@/lib/types";
import {
  createLooDentalAiUsageLog,
  getActiveSession,
  getActiveTreatmentSeries,
  getOrCreateReminderSettings,
  getOrCreateTreatmentPlan,
  getTrackingStartedAt,
  getWearState,
  listActiveTreatmentExceptionEvents,
  listPlannedTraysForSeries,
  listSessionsForRange
} from "@/server/repository";

const model = "gpt-5.5";
const defaultBaseUrl = "https://openrouter.icu/v1/responses";

export type LooDentalMinisterContext = {
  today: string;
  timeZone: string;
  treatmentPlan: TreatmentPlan;
  activeSeries: TreatmentSeries | null;
  wearState: WearState | null;
  activeSession: OffTraySession | null;
  todaySummary: DailySummary;
  recentSummaries: DailySummary[];
  planProgress: PlanProgress | null;
  activeExceptions: TreatmentExceptionEvent[];
  reminderSettings: ReminderSettings;
};

export async function buildLooDentalMinisterContext(userId: string, timeZone: string): Promise<LooDentalMinisterContext> {
  const now = new Date();
  const today = todayKey(now, timeZone);
  const treatmentPlan = await getOrCreateTreatmentPlan(userId);
  const reminderSettings = await getOrCreateReminderSettings(userId);
  const wearState = await getWearState(userId);
  const activeSession = await getActiveSession(userId);
  const trackingStartedAt = await getTrackingStartedAt(userId);
  const activeSeries = await getActiveTreatmentSeries(userId);
  const plannedTrays = activeSeries ? await listPlannedTraysForSeries(userId, activeSeries.id) : [];
  const recentStart = addDaysToDateKey(today, -13);
  const sessions = await listSessionsForRange(userId, recentStart, today, timeZone);
  const recentSummaries = calculateDailySummaries({
    startDate: recentStart,
    endDate: today,
    sessions,
    treatmentPlan,
    now,
    timeZone,
    hasTrackingStarted: Boolean(trackingStartedAt),
    trackingStartedAt
  });
  const planProgress = activeSeries ? calculatePlanProgress({
    status: activeSeries.status,
    currentTrayNumber: activeSeries.currentTrayNumber,
    totalTrays: activeSeries.totalTrays,
    overallTotalTrays: activeSeries.overallTotalTrays,
    overallTreatmentDays: activeSeries.overallTreatmentDays,
    trayIntervalDays: activeSeries.trayIntervalDays,
    currentTrayStartDate: activeSeries.currentTrayStartDate,
    nextChangeDate: activeSeries.nextChangeDate,
    trays: plannedTrays,
    todayKey: today,
    timeZone
  }) : null;
  const activeExceptions = activeSeries ? await listActiveTreatmentExceptionEvents(userId, activeSeries.id, 5) : [];

  return {
    today,
    timeZone,
    treatmentPlan,
    activeSeries,
    wearState,
    activeSession,
    todaySummary: recentSummaries[recentSummaries.length - 1],
    recentSummaries,
    planProgress,
    activeExceptions,
    reminderSettings
  };
}

export async function askLooDentalMinister(params: {
  userId: string;
  question: string;
  timeZone: string;
}) {
  const startedAt = Date.now();
  const question = params.question.trim().slice(0, 1200);

  if (!question) {
    throw new Error("请先输入你想问 Loo牙大臣的问题。");
  }

  const context = await buildLooDentalMinisterContext(params.userId, params.timeZone);

  try {
    const answer = await callResponsesApi({
      input: buildPrompt({ question, context })
    });
    const cleaned = normalizeAnswer(answer);

    await createLooDentalAiUsageLog({
      userId: params.userId,
      questionLength: question.length,
      status: "ok",
      latencyMs: Date.now() - startedAt,
      model
    });

    return {
      answer: cleaned,
      contextSummary: summarizeContextForClient(context),
      model,
      safetyNote: safetyNote()
    };
  } catch (error) {
    await createLooDentalAiUsageLog({
      userId: params.userId,
      questionLength: question.length,
      status: "failed",
      failureKind: classifyFailure(error),
      errorMessage: error instanceof Error ? error.message : "AI request failed.",
      latencyMs: Date.now() - startedAt,
      model
    });

    throw error;
  }
}

function buildPrompt(params: {
  question: string;
  context: LooDentalMinisterContext;
}) {
  return [
    "你是 Loo牙大臣，一个中文隐形牙套/隐适美佩戴管理助手。",
    "你只能基于用户导入的计划、佩戴打卡、异常记录和提醒设置做解释、总结、复盘和提问准备。",
    "你不是医生，不能诊断，不能判断牙齿移动是否成功，不能告诉用户提前换下一副、跳过某副、回退上一副、忽略疼痛/不贴合/损坏/丢失。",
    "涉及疼痛、不贴合、牙套损坏/丢失、是否换期、是否继续当前副时，必须建议以牙医或正畸医生指示为准。",
    "回答要简洁、产品化、中文，优先给结论，然后给依据。不要提 DTO、API、provider、fallback、模型等内部词。",
    "如果数据不足，要明确说明缺少哪些记录，不要编造。",
    "",
    "用户当前上下文：",
    JSON.stringify(serializeContext(params.context), null, 2),
    "",
    `用户问题：${params.question}`,
    "",
    "请输出 2-5 段中文短回答。"
  ].join("\n");
}

function serializeContext(context: LooDentalMinisterContext) {
  const recordedSummaries = context.recentSummaries.filter((summary) => summary.hasData);
  const metrics = calculateHistoryMetrics(context.recentSummaries, { today: context.today });

  return {
    today: context.today,
    timeZone: context.timeZone,
    status: context.wearState?.isWearing === false ? "已取下" : "佩戴中或尚未开始打卡",
    activeOffTraySessionStart: context.activeSession?.startAt ?? null,
    treatmentPlan: {
      dailyGoalMinutes: context.treatmentPlan.dailyGoalMinutes,
      legacyStartDate: context.treatmentPlan.startDate
    },
    activeSeries: context.activeSeries ? {
      name: context.activeSeries.name,
      status: context.activeSeries.status,
      seriesType: context.activeSeries.seriesType,
      currentTrayNumber: context.activeSeries.currentTrayNumber,
      totalTrays: context.activeSeries.totalTrays,
      overallTotalTrays: context.activeSeries.overallTotalTrays,
      trayIntervalDays: context.activeSeries.trayIntervalDays,
      currentTrayStartDate: context.activeSeries.currentTrayStartDate,
      nextChangeDate: context.activeSeries.nextChangeDate,
      appointmentDate: context.activeSeries.appointmentDate
    } : null,
    planProgress: context.planProgress,
    todaySummary: context.todaySummary,
    recentRecordedDays: recordedSummaries.slice(-7).map((summary) => ({
      date: summary.date,
      wearMinutes: summary.wearMinutes,
      offMinutes: summary.offMinutes,
      sessionCount: summary.sessionCount,
      goalMet: summary.goalMet
    })),
    recentMetrics: metrics,
    activeExceptions: context.activeExceptions.map((event) => ({
      type: event.eventType,
      date: event.eventDate,
      trayNumber: event.trayNumber,
      extensionDays: event.extensionDays,
      note: event.note
    })),
    reminders: {
      mealReminderEnabled: context.reminderSettings.enableMealReminder,
      mealReminderMinutes: context.reminderSettings.mealReminderMinutes,
      bedtimeReminderEnabled: context.reminderSettings.enableBedtimeReminder,
      bedtimeReminderTime: context.reminderSettings.bedtimeReminderTime,
      trayChangeReminderEnabled: context.reminderSettings.enableTrayChangeReminder
    }
  };
}

function summarizeContextForClient(context: LooDentalMinisterContext) {
  const planLabel = context.planProgress
    ? `第 ${context.planProgress.currentTrayNumber}${context.planProgress.totalTrays ? ` / ${context.planProgress.totalTrays}` : ""} 副`
    : "未导入计划";
  const todayWearHours = Math.round((context.todaySummary.wearMinutes / 60) * 10) / 10;

  return `${planLabel} · 今日已戴约 ${todayWearHours} 小时 · ${context.activeExceptions.length ? "有进行中的异常记录" : "暂无进行中的异常记录"}`;
}

async function callResponsesApi(params: { input: string }) {
  if (process.env.LOO_DENTAL_PROVIDER_ENABLED === "false") {
    throw new Error("Loo牙大臣当前未启用。");
  }

  const apiKey = process.env.LOO_DENTAL_OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Loo牙大臣还没有配置 API key。");
  }

  const response = await fetch(normalizeResponsesUrl(process.env.LOO_DENTAL_OPENROUTER_BASE_URL ?? defaultBaseUrl), {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: params.input,
      reasoning: { effort: "medium" },
      text: { verbosity: "low" },
      max_output_tokens: 900,
      store: false
    })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(providerErrorMessage(response.status, payload));
  }

  return extractOutputText(payload);
}

function extractOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Loo牙大臣返回为空。");
  }

  const maybeOutputText = (payload as { output_text?: unknown }).output_text;

  if (typeof maybeOutputText === "string" && maybeOutputText.trim()) {
    return maybeOutputText;
  }

  const output = (payload as { output?: unknown }).output;

  if (Array.isArray(output)) {
    const text = output.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const content = (item as { content?: unknown }).content;

      if (!Array.isArray(content)) {
        return [];
      }

      return content.map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }

        const record = part as { text?: unknown; type?: unknown };

        return typeof record.text === "string" ? record.text : "";
      });
    }).join("\n").trim();

    if (text) {
      return text;
    }
  }

  throw new Error("Loo牙大臣没有返回可显示的回答。");
}

function normalizeAnswer(answer: string) {
  const trimmed = answer.trim();

  if (!trimmed) {
    throw new Error("Loo牙大臣返回为空。");
  }

  return trimmed.length > 1800 ? `${trimmed.slice(0, 1800)}...` : trimmed;
}

function normalizeResponsesUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");

  if (trimmed.endsWith("/responses")) {
    return trimmed;
  }

  if (trimmed.endsWith("/v1")) {
    return `${trimmed}/responses`;
  }

  return `${trimmed}/v1/responses`;
}

function providerErrorMessage(status: number, payload: unknown) {
  const message = payload && typeof payload === "object"
    ? (payload as { error?: { message?: unknown }; message?: unknown }).error?.message ?? (payload as { message?: unknown }).message
    : null;

  return `Loo牙大臣暂时无法回答（${status}${typeof message === "string" ? `: ${message}` : ""}）。`;
}

function classifyFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("API key")) {
    return "missing_api_key";
  }

  if (message.includes("401") || message.includes("403")) {
    return "auth";
  }

  if (message.includes("429")) {
    return "rate_limit";
  }

  if (message.includes("返回为空") || message.includes("没有返回")) {
    return "empty_output";
  }

  return "provider_error";
}

function safetyNote() {
  return "Loo牙管理器用于记录和理解佩戴计划，不提供诊断或医疗决策。牙套不贴合、疼痛、损坏、丢失或是否换下一副，请以牙医/正畸医生指导为准。";
}
